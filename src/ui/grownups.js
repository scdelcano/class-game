import { h, uiRoot } from './dom.js';
import { sfx } from '../audio/sfx.js';
import { confirmDialog } from './dialog.js';
import { showToast } from './toast.js';
import { GRADES } from '../learning/math-facts.js';
import { LEVELS } from '../learning/mastery.js';
import { CUSTOM_GROUP } from '../learning/reading-words.js';

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
 * Grown-ups: learning settings (grade, which facts, division, how often
 * students make mistakes), progress, and tools.
 */
export function createGrownups({ learning, onClose }) {
  const body = h('div', { class: 'grownups-body' });
  const el = h('div', { class: 'screen grownups', hidden: true },
    h('header', { class: 'screen-header' },
      h('h1', {}, h('span', { 'aria-hidden': 'true' }, '⚙️ '), 'Grown-ups'),
      h('span', { class: 'roster-count' }, 'Everything stays on this tablet.'),
      h('button', { class: 'big-button primary', type: 'button', onclick: close }, '✓ Done'),
    ),
    body,
  );
  uiRoot().append(el);

  const chip = (label, selected, onclick, extra = '') => h('button', {
    class: `chip${selected ? ' selected' : ''} ${extra}`,
    type: 'button',
    'aria-pressed': String(selected),
    onclick: () => { sfx.pop(); onclick(); },
  }, label);
  const section = (title, note, ...content) => h('section', { class: 'card gu-section' }, h('h2', {}, title), note ? h('p', { class: 'gu-note' }, note) : null, ...content);

  function render() {
    const st = learning.settings;
    const math = learning.math();
    const pack = math.pack;
    const auto = !Array.isArray(st.tables);
    const inverseName = pack.kind === 'mult' ? 'division (÷)' : 'subtraction (−)';

    const recent = learning.recent(7);
    const minutes = Math.round(recent.seconds / 60);
    const accuracy = recent.problems ? Math.round((recent.right / recent.problems) * 100) : null;

    body.replaceChildren(
      section('Grade level', 'Pick her grade (math and reading). Each grade keeps its own progress.',
        h('div', { class: 'chip-row' }, ...GRADES.map((g) => chip(`${ordinal(g)} grade`, st.grade === g, () => { learning.setSettings({ grade: g, tables: 'auto', readingGroups: 'auto' }); render(); }))),
        h('p', { class: 'gu-detail' }, `Math: ${pack.title}${pack.standard ? ` · ${pack.standard}` : ''}`),
        h('p', { class: 'gu-detail' }, `Reading: ${learning.reading().pack.title} · ${learning.reading().pack.standard}`),
      ),

      section('Math: which facts', auto
        ? 'The game starts easy and opens the next group when she knows most of the current ones.'
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
      h('p', { class: 'gu-detail' }, `${inverseName[0].toUpperCase()}${inverseName.slice(1)} for a fact appears once she knows the matching ${pack.kind === 'mult' ? 'times' : 'plus'} fact.`),
      ),

      section('Student mistakes', 'How often students answer wrong on purpose, for her to catch.',
        h('div', { class: 'chip-row' },
          chip('A few', st.mistakes === 'few', () => { learning.setSettings({ mistakes: 'few' }); render(); }),
          chip('Some', st.mistakes === 'some', () => { learning.setSettings({ mistakes: 'some' }); render(); }),
          chip('Lots', st.mistakes === 'lots', () => { learning.setSettings({ mistakes: 'lots' }); render(); }),
        ),
      ),

      section('Math progress', `${ordinal(st.grade)} grade · all subjects, last 7 days`,
        h('div', { class: 'tiles' },
          tile(String(learning.history.lessons), 'lessons'),
          tile(String(recent.problems), 'problems'),
          tile(accuracy === null ? '–' : `${accuracy}%`, 'right'),
          tile(`${minutes} min`, 'practice'),
        ),
        factGrid(pack, math),
        h('div', { class: 'legend' }, ...LEVELS.map((l) => h('span', {}, h('i', { style: { background: l.color } }), l.label))),
        trickyList(math),
      ),

      weekWordsSection(),
      readingSection(),
      readingProgress(),

      section('Tools', null,
        h('div', { class: 'chip-row' },
          h('a', { class: 'big-button', href: './mic-test.html' }, '🎤 Microphone test'),
          h('button', {
            class: 'big-button danger',
            type: 'button',
            onclick: async () => {
              const yes = await confirmDialog({ text: 'Erase all learning progress and stars?', yes: 'Erase', no: 'Keep', icon: '⚠️' });
              if (!yes) return;
              learning.resetProgress();
              showToast('Learning progress erased.', { icon: '🧹' });
              render();
            },
          }, '🧹 Reset learning progress'),
        ),
      ),
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
    return section('This week\u2019s words', 'Type her school\u2019s spelling or reading words (commas or new lines). They come up first in reading lessons.',
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
    return section('Reading: which words', auto
      ? 'Word groups open one at a time as she reads the earlier ones well.'
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
    h('p', { class: 'gu-detail' }, 'Spelling a word comes after she can read it.'),
    );
  }

  function readingProgress() {
    const rd = learning.reading();
    const color = Object.fromEntries(LEVELS.map((l) => [l.id, l.color]));
    const shown = rd.activeFamilies();
    const reads = rd.pack.facts.filter((f) => f.mode === 'read');
    const count = (mode, level) => rd.pack.facts.filter((f) => f.mode === mode && rd.level(f.key) === level).length;
    const tricky = rd.tricky(8);
    return section('Reading progress', 'Colors: how well she reads each word in the groups in play (underline = spelling).',
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

function ordinal(n) {
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n] ?? 'th'}`;
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
