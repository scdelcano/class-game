import { h, uiRoot } from './dom.js';
import { sfx } from '../audio/sfx.js';
import { confirmDialog } from './dialog.js';
import { showToast } from './toast.js';
import { GRADES } from '../learning/math-facts.js';
import { LEVELS } from '../learning/mastery.js';
import { CUSTOM_GROUP } from '../learning/reading-words.js';
import { profileForm, ordinal } from './profile-form.js';
import { createLearning } from '../learning/store.js';
import { createRoster } from '../students/roster.js';
import { saveKeyFor } from '../core/storage.js';

const HOLD_MS = 2000;

/**
 * "Press and hold" gate, so little fingers don't wander into settings.
 * Calls onOpen after the button is held for 2 seconds.
 */
export function holdToOpen(button, onOpen) {
  let timer = 0;
  const start = (e) => {
    e.preventDefault();
    button.classList.add('holding');
    timer = setTimeout(() => {
      button.classList.remove('holding');
      sfx.pop();
      onOpen();
    }, HOLD_MS);
  };
  const cancel = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = 0;
    if (button.classList.contains('holding')) showToast('Grown-ups: press and hold.', { icon: '⚙️', seconds: 2 });
    button.classList.remove('holding');
  };
  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', cancel);
  button.addEventListener('pointerleave', cancel);
  button.addEventListener('pointercancel', cancel);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * Grown-ups: learning settings, progress, and tools, split into tabs.
 *
 * To add a tab (e.g. a new subject), add an entry to `tabs` below: an id,
 * an icon, a label, and a `sections()` function that returns the cards to
 * show. Everything else (tab bar, switching, re-rendering) is shared.
 *
 * The "Viewing" chips at the top pick which player the page is about, and
 * "+ Add player" adds one. It opens on the player who's playing; looking at
 * someone else doesn't change who's playing. Every card below, including
 * Change, Reset and Remove in Tools, is about the player being viewed.
 */
export function createGrownups({ learning: playingLearning, profile: playing, profiles, onProfilesChange = () => {}, onClose }) {
  let viewId = playing.id;
  let profile = playing; // the player being looked at
  let learning = playingLearning; // their learning data
  const others = new Map(); // other players' learning, loaded from their saves while Grown-ups is open

  function learningFor(id) {
    if (id === playing.id) return playingLearning;
    if (!others.has(id)) others.set(id, createLearning(createRoster({ saveKey: saveKeyFor(id) })));
    return others.get(id);
  }

  const playerBar = h('div', { class: 'player-bar' });
  const tabBar = h('nav', { class: 'tabs grownups-tabs', role: 'tablist' });
  const body = h('div', { class: 'grownups-body', role: 'tabpanel' });
  const whose = h('span', { class: 'roster-count' });
  const el = h('div', { class: 'screen grownups', hidden: true },
    h('header', { class: 'screen-header' },
      h('h1', {}, h('span', { 'aria-hidden': 'true' }, '⚙️ '), 'Grown-ups'),
      whose,
      h('button', { class: 'big-button primary', type: 'button', onclick: close }, '✓ Done'),
    ),
    playerBar,
    tabBar,
    body,
  );
  uiRoot().append(el);

  const tabs = [
    { id: 'general', icon: '🏫', label: 'General', sections: () => [gradeSection(), mistakesSection(), weekSection(), allTimeSection(), toolsSection()] },
    { id: 'math', icon: '🔢', label: 'Math', sections: () => [mathFactsSection(), mathProgress()] },
    { id: 'reading', icon: '📖', label: 'Reading', sections: () => [weekWordsSection(), readingSection(), readingProgress()] },
  ];
  let activeTab = tabs[0].id;

  const chip = (label, selected, onclick, extra = '') => h('button', {
    class: `chip${selected ? ' selected' : ''} ${extra}`,
    type: 'button',
    'aria-pressed': String(selected),
    onclick: () => { sfx.pop(); onclick(); },
  }, label);
  const section = (title, note, ...content) => h('section', { class: 'card gu-section' }, h('h2', {}, title), note ? h('p', { class: 'gu-note' }, note) : null, ...content);

  function render() {
    if (!profiles.get(viewId)) viewId = playing.id; // they were removed
    profile = profiles.get(viewId) ?? playing; // the name or emoji may have changed
    learning = learningFor(viewId);
    const other = viewId !== playing.id;
    el.classList.toggle('viewing-other', other);
    whose.textContent = `Settings for ${profile.emoji} ${profile.name}${other ? ' (not playing now)' : ''} · everything stays on this tablet.`;
    playerBar.replaceChildren(
      h('span', { class: 'player-bar-label' }, 'Viewing:'),
      ...profiles.list.map((p) => chip(
        h('span', {}, `${p.emoji} ${p.name}`, p.id === playing.id ? h('small', {}, ' · playing') : null),
        p.id === viewId,
        () => {
          viewId = p.id;
          render();
          el.scrollTop = 0;
        },
      )),
      chip('+ Add player', false, addPlayer, 'add-player'),
    );
    const tab = tabs.find((t) => t.id === activeTab) ?? tabs[0];
    tabBar.replaceChildren(...tabs.map((t) => h('button', {
      class: `tab${t === tab ? ' active' : ''}`,
      type: 'button',
      role: 'tab',
      'aria-selected': String(t === tab),
      onclick: () => {
        if (t === tab) return;
        sfx.pop();
        activeTab = t.id;
        render();
        el.scrollTop = 0;
      },
    }, h('span', { class: 'tab-icon', 'aria-hidden': 'true' }, t.icon), t.label)));
    body.replaceChildren(...tab.sections());
  }

  // ---------------------------------------------------------------- general
  function gradeSection() {
    const st = learning.settings;
    const pack = learning.math().pack;
    return section('Grade level', 'Pick your child\u2019s grade (math and reading). Each grade keeps its own progress.',
      h('div', { class: 'chip-row' }, ...GRADES.map((g) => chip(`${ordinal(g)} grade`, st.grade === g, () => { learning.setSettings({ grade: g, tables: 'auto', readingGroups: 'auto' }); render(); }))),
      h('p', { class: 'gu-detail' }, `Math: ${pack.title}${pack.standard ? ` · ${pack.standard}` : ''}`),
      h('p', { class: 'gu-detail' }, `Reading: ${learning.reading().pack.title} · ${learning.reading().pack.standard}`),
    );
  }

  function weekSection() {
    return section('This week', 'All subjects, last 7 days (today included).', statTiles(learning.recent(7)));
  }

  function allTimeSection() {
    const all = learning.allTime();
    return section('All time', 'All subjects and grades, since the start or the last progress reset.',
      statTiles(all),
      h('p', { class: 'gu-detail' }, all.days
        ? `Practiced on ${all.days} ${all.days === 1 ? 'day' : 'days'} since ${shortDate(all.since)} · ${all.stars} gold ${all.stars === 1 ? 'star' : 'stars'} given to students`
        : 'No practice yet.'),
    );
  }

  function mistakesSection() {
    const st = learning.settings;
    return section('Student mistakes', 'How often students answer wrong on purpose, for your child to catch.',
      h('div', { class: 'chip-row' },
        chip('A few', st.mistakes === 'few', () => { learning.setSettings({ mistakes: 'few' }); render(); }),
        chip('Some', st.mistakes === 'some', () => { learning.setSettings({ mistakes: 'some' }); render(); }),
        chip('Lots', st.mistakes === 'lots', () => { learning.setSettings({ mistakes: 'lots' }); render(); }),
      ),
    );
  }

  async function addPlayer() {
    const added = await profileForm({ profiles });
    if (!added) return;
    showToast(`${added.name} was added!`, { icon: added.emoji });
    viewId = added.id; // show the new player, ready for their weekly words
    onProfilesChange();
    render();
    el.scrollTop = 0;
  }

  function toolsSection() {
    const isPlaying = profile.id === playing.id;
    const canRemove = !isPlaying && profiles.count > 1;
    return section('Tools', null,
      h('div', { class: 'chip-row' },
        h('a', { class: 'big-button', href: './mic-test.html' }, '🎤 Microphone test'),
        h('button', {
          class: 'big-button',
          type: 'button',
          onclick: async () => {
            sfx.pop();
            if (!(await profileForm({ profiles, profile }))) return;
            onProfilesChange();
            render();
          },
        }, `✏️ Change ${profile.name}\u2019s name or picture`),
        h('button', {
          class: 'big-button danger',
          type: 'button',
          onclick: async () => {
            const yes = await confirmDialog({ text: `Erase ${profile.name}\u2019s learning progress and stars?`, yes: 'Erase', no: 'Keep', icon: '⚠️' });
            if (!yes) return;
            learning.resetProgress();
            showToast('Learning progress erased.', { icon: '🧹' });
            render();
          },
        }, `🧹 Reset ${profile.name}\u2019s learning progress`),
        h('button', {
          class: 'big-button danger',
          type: 'button',
          disabled: !canRemove,
          onclick: async () => {
            const yes = await confirmDialog({ text: `Remove ${profile.name}? This erases their class, stars and progress.`, yes: 'Remove', no: 'Keep', icon: '⚠️' });
            if (!yes) return;
            const name = profile.name;
            profiles.remove(profile.id);
            showToast(`${name} was removed.`, { icon: '🧹' });
            viewId = playing.id;
            onProfilesChange();
            render();
            el.scrollTop = 0;
          },
        }, `🗑️ Remove ${profile.name}`),
      ),
      canRemove ? null : h('p', { class: 'gu-detail' }, isPlaying
        ? `${profile.name} is playing now. To remove ${profile.name}, switch to another player first.`
        : `${profile.name} is the only player, so they can\u2019t be removed.`),
    );
  }

  // ---------------------------------------------------------------- math
  function mathFactsSection() {
    const st = learning.settings;
    const math = learning.math();
    const pack = math.pack;
    const auto = !Array.isArray(st.tables);
    const inverseName = pack.kind === 'mult' ? 'division (÷)' : 'subtraction (−)';
    return section('Which facts', auto
      ? 'The game starts easy and opens the next group when your child knows most of the current ones.'
      : 'Only the groups you pick will be practiced.',
    h('div', { class: 'chip-row' },
      chip('✨ Let the game choose', auto, () => { learning.setSettings({ tables: 'auto' }); render(); }, 'wide-chip'),
    ),
    h('div', { class: 'chip-row' }, ...pack.families.map((f) => {
      const on = !auto && st.tables.includes(f.id);
      const unlocked = auto && math.activeFamilies().some((a) => a.id === f.id);
      return chip(f.label, on || unlocked, () => {
        const current = auto ? math.activeFamilies().map((a) => a.id) : [...st.tables];
        const next = current.includes(f.id) ? current.filter((id) => id !== f.id) : [...current, f.id];
        learning.setSettings({ tables: next.length ? next : 'auto' });
        render();
      }, auto ? 'soft' : '');
    })),
    h('div', { class: 'chip-row' },
      chip(`Include ${inverseName}`, st.division, () => { learning.setSettings({ division: !st.division }); render(); }),
    ),
    h('p', { class: 'gu-detail' }, `${inverseName[0].toUpperCase()}${inverseName.slice(1)} for a fact appears once your child knows the matching ${pack.kind === 'mult' ? 'times' : 'plus'} fact.`),
    );
  }

  function mathProgress() {
    const math = learning.math();
    return section('Math progress', `${math.pack.title} · colors show how well your child knows each fact.`,
      factGrid(math.pack, math),
      h('div', { class: 'legend' }, ...LEVELS.map((l) => h('span', {}, h('i', { style: { background: l.color } }), l.label))),
      trickyList(math),
    );
  }

  // ---------------------------------------------------------------- reading
  function weekWordsSection() {
    const box = h('textarea', {
      class: 'week-words',
      rows: 4,
      placeholder: 'because, friend, beautiful, answer…',
      spellcheck: 'false',
      autocapitalize: 'off',
    });
    box.value = learning.settings.weekWords.join(', ');
    return section('This week\u2019s words', 'Type your child\u2019s school spelling or reading words (commas or new lines). They come up first in reading lessons.',
      box,
      h('div', { class: 'chip-row' },
        h('button', {
          class: 'big-button primary',
          type: 'button',
          onclick: () => {
            learning.setSettings({ weekWords: box.value });
            const n = learning.settings.weekWords.length;
            showToast(n ? `${n} words saved for this week.` : 'Weekly words cleared.', { icon: '📝' });
            render();
          },
        }, '💾 Save words'),
        h('button', {
          class: 'big-button',
          type: 'button',
          onclick: () => {
            learning.setSettings({ weekWords: [] });
            render();
          },
        }, 'Clear'),
      ),
    );
  }

  function readingSection() {
    const st = learning.settings;
    const rd = learning.reading();
    const auto = !Array.isArray(st.readingGroups);
    const groups = rd.pack.families.filter((f) => f.id !== CUSTOM_GROUP);
    return section('Which words', auto
      ? 'Word groups open one at a time as your child reads the earlier ones well.'
      : 'Only the groups you pick will be practiced.',
    h('div', { class: 'chip-row' },
      chip('✨ Let the game choose', auto, () => { learning.setSettings({ readingGroups: 'auto' }); render(); }, 'wide-chip'),
    ),
    h('div', { class: 'chip-row' }, ...groups.map((f) => {
      const on = !auto && st.readingGroups.includes(f.id);
      const open = auto && rd.activeFamilies().some((a) => a.id === f.id);
      return chip(f.label, on || open, () => {
        const current = auto ? rd.activeFamilies().filter((a) => a.id !== CUSTOM_GROUP).map((a) => a.id) : [...st.readingGroups];
        const next = current.includes(f.id) ? current.filter((id) => id !== f.id) : [...current, f.id];
        learning.setSettings({ readingGroups: next.length ? next : 'auto' });
        render();
      }, auto ? 'soft' : '');
    })),
    h('div', { class: 'chip-row' },
      chip('Include spelling', st.spelling, () => { learning.setSettings({ spelling: !st.spelling }); render(); }),
    ),
    h('p', { class: 'gu-detail' }, 'Spelling a word comes after your child can read it.'),
    );
  }

  function readingProgress() {
    const rd = learning.reading();
    const color = Object.fromEntries(LEVELS.map((l) => [l.id, l.color]));
    const shown = rd.activeFamilies();
    const reads = rd.pack.facts.filter((f) => f.mode === 'read');
    const count = (mode, level) => rd.pack.facts.filter((f) => f.mode === mode && rd.level(f.key) === level).length;
    const tricky = rd.tricky(8);
    return section('Reading progress', 'Colors: how well your child reads each word in the groups in play (underline = spelling).',
      h('div', { class: 'tiles' },
        tile(`${count('read', 'mastered')}/${reads.length}`, 'read ✓'),
        tile(String(count('read', 'almost') + count('read', 'learning')), 'reading now'),
        tile(String(count('spell', 'mastered')), 'spelled ✓'),
        tile(String(rd.pack.families.length), 'word groups'),
      ),
      ...shown.map((fam) => h('div', { class: 'word-group' },
        h('h3', {}, fam.label),
        h('div', { class: 'chip-row' }, ...rd.pack.facts.filter((f) => f.family === fam.id && f.mode === 'read').map((f) => {
          const spellLevel = rd.level(`s:${f.text}`);
          return h('span', {
            class: 'word-chip',
            style: { background: color[rd.level(f.key)], borderBottomColor: color[spellLevel] },
            title: f.kind === 'sentence' ? f.text : `read: ${rd.level(f.key)} · spell: ${spellLevel}`,
          }, f.kind === 'sentence' ? `“${f.text.slice(0, 22)}…”` : f.text);
        })),
      )),
      h('div', { class: 'legend' }, ...LEVELS.map((l) => h('span', {}, h('i', { style: { background: l.color } }), l.label))),
      tricky.length
        ? h('div', {}, h('h3', {}, 'Trickiest words'), h('div', { class: 'chip-row' }, ...tricky.map((f) => {
          const st2 = rd.stat(f.key);
          return h('span', { class: 'chip static' }, `${f.mode === 'spell' ? '✏️ ' : '📖 '}${f.kind === 'sentence' ? 'sentence' : f.text}`, h('small', {}, ` ✓${st2.right} ✗${st2.wrong}`));
        })))
        : h('p', { class: 'gu-detail' }, 'No tricky words yet.'),
    );
  }

  function open() {
    others.clear(); // read fresh from the saves
    viewId = playing.id;
    render();
    el.hidden = false;
  }

  function close() {
    sfx.pop();
    el.hidden = true;
    onClose();
  }

  return { open };
}

/** Lessons, problems, % right and practice time. */
function statTiles({ lessons, problems, right, seconds }) {
  return h('div', { class: 'tiles' },
    tile(String(lessons), lessons === 1 ? 'lesson' : 'lessons'),
    tile(String(problems), problems === 1 ? 'problem' : 'problems'),
    tile(problems ? `${Math.round((right / problems) * 100)}%` : '–', 'right'),
    tile(practiceTime(seconds), 'practice'),
  );
}

/** "25 min" under an hour, then "1.5 h". */
function practiceTime(seconds) {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 6) / 10} h`;
}

/** '2026-09-20' -> 'Sep 20' (with the year if it isn't this year). */
function shortDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const opts = { month: 'short', day: 'numeric' };
  if (y !== new Date().getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString(undefined, opts);
}

function tile(big, small) {
  return h('div', { class: 'tile' }, h('b', {}, big), h('span', {}, small));
}

/** A colored grid of every fact: times table (or addition table) layout. */
function factGrid(pack, math) {
  const { max } = pack;
  const op = pack.kind === 'mult' ? '×' : '+';
  const color = Object.fromEntries(LEVELS.map((l) => [l.id, l.color]));
  const cells = [h('div', { class: 'fg-head' }, op)];
  for (let c = 0; c <= max; c++) cells.push(h('div', { class: 'fg-head' }, String(c)));
  for (let r = 0; r <= max; r++) {
    cells.push(h('div', { class: 'fg-head' }, String(r)));
    for (let c = 0; c <= max; c++) {
      const [lo, hi] = [Math.min(r, c), Math.max(r, c)];
      const key = pack.kind === 'mult' ? `m:${lo}x${hi}` : `a:${lo}+${hi}`;
      const fact = pack.byKey.get(key);
      const level = fact ? math.level(key) : null;
      cells.push(h('div', {
        class: 'fg-cell',
        style: { background: level ? color[level] : 'transparent' },
        title: fact ? `${r} ${op} ${c} = ${fact.answer}` : '',
      }));
    }
  }
  const grid = h('div', { class: 'fact-grid' }, ...cells);
  grid.style.gridTemplateColumns = `repeat(${max + 2}, 1fr)`;
  return grid;
}

function trickyList(math) {
  const tricky = math.tricky(6);
  if (!tricky.length) return h('p', { class: 'gu-detail' }, 'No tricky facts yet.');
  return h('div', {},
    h('h3', {}, 'Trickiest facts'),
    h('div', { class: 'chip-row' }, ...tricky.map((f) => {
      const s = math.stat(f.key);
      return h('span', { class: 'chip static' }, `${f.a} ${f.op} ${f.b} = ${f.answer}`, h('small', {}, ` ✓${s.right} ✗${s.wrong}`));
    })),
  );
}
