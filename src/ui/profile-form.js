import { h, uiRoot } from './dom.js';
import { sfx } from '../audio/sfx.js';
import { confirmDialog } from './dialog.js';
import { showToast } from './toast.js';
import { PROFILE_EMOJI, MAX_PROFILE_NAME } from '../core/profiles.js';
import { GRADES } from '../learning/math-facts.js';
import { DEFAULT_SETTINGS } from '../learning/store.js';

/**
 * Add or change a player (grown-ups only): name, emoji, and, for a new
 * player, their grade. Uses the tablet's own keyboard, like the weekly words.
 * @returns {Promise<object|null>} the saved profile, or null if cancelled
 */
export function profileForm({ profiles, profile = null }) {
  return new Promise((resolve) => {
    const draft = { name: profile?.name ?? '', emoji: profile?.emoji ?? PROFILE_EMOJI[profiles.count % PROFILE_EMOJI.length], grade: DEFAULT_SETTINGS.grade };
    const input = h('input', {
      class: 'text-input',
      type: 'text',
      maxlength: MAX_PROFILE_NAME,
      placeholder: 'Name',
      autocapitalize: 'words',
      spellcheck: 'false',
      oninput: () => { draft.name = input.value; },
    });
    input.value = draft.name;
    const emojiRow = h('div', { class: 'chip-row emoji-row' });
    const gradeRow = h('div', { class: 'chip-row' });

    const renderChips = () => {
      emojiRow.replaceChildren(...PROFILE_EMOJI.map((e) => h('button', {
        class: `chip emoji-chip${draft.emoji === e ? ' selected' : ''}`,
        type: 'button',
        'aria-pressed': String(draft.emoji === e),
        onclick: () => { sfx.pop(); draft.emoji = e; renderChips(); },
      }, e)));
      gradeRow.replaceChildren(...GRADES.map((g) => h('button', {
        class: `chip${draft.grade === g ? ' selected' : ''}`,
        type: 'button',
        'aria-pressed': String(draft.grade === g),
        onclick: () => { sfx.pop(); draft.grade = g; renderChips(); },
      }, `${ordinal(g)} grade`)));
    };
    renderChips();

    const done = (result) => {
      backdrop.classList.add('closing');
      setTimeout(() => backdrop.remove(), 180);
      resolve(result);
    };
    const save = () => {
      const name = draft.name.trim();
      if (!name) {
        sfx.squeak();
        showToast('Type a name first.', { icon: '✏️' });
        input.focus();
        return;
      }
      if (profiles.nameTaken(name, profile?.id)) {
        sfx.squeak();
        showToast(`There's already a ${name}.`, { icon: '👯' });
        return;
      }
      sfx.pop();
      done(profile ? profiles.update(profile.id, draft) : profiles.add(draft));
    };

    const backdrop = h('div', { class: 'dialog-backdrop' },
      h('div', { class: 'dialog card profile-form', role: 'dialog', 'aria-modal': 'true' },
        h('h2', {}, profile ? `Change ${profile.name}` : 'Add a player'),
        input,
        h('h3', {}, 'Picture'),
        emojiRow,
        profile ? null : h('h3', {}, 'Grade'),
        profile ? null : gradeRow,
        h('div', { class: 'dialog-buttons' },
          h('button', { class: 'big-button', type: 'button', onclick: () => { sfx.pop(); done(null); } }, 'Cancel'),
          h('button', { class: 'big-button primary', type: 'button', onclick: save }, profile ? '✓ Save' : '+ Add'),
        ),
      ),
    );
    uiRoot().append(backdrop);
  });
}

/**
 * The "Players" card for the start screen (nobody is playing yet): every
 * player with Change and Remove, plus "Add a player". Calls onChange after
 * anything changes, so the caller can re-render.
 */
export function playersCard({ profiles, onChange }) {
  const row = (p) => {
    const canRemove = profiles.count > 1;
    return h('div', { class: 'player-row' },
      h('span', { class: 'player-emoji', 'aria-hidden': 'true' }, p.emoji),
      h('span', { class: 'player-name' },
        p.name,
        h('span', { class: 'player-detail' }, `${ordinal(profiles.gradeOf(p.id))} grade`),
      ),
      h('button', {
        class: 'big-button small',
        type: 'button',
        onclick: async () => {
          sfx.pop();
          if (await profileForm({ profiles, profile: p })) onChange();
        },
      }, '✏️ Change'),
      h('button', {
        class: 'big-button small danger',
        type: 'button',
        disabled: !canRemove,
        title: canRemove ? '' : 'There must be at least one player',
        onclick: async () => {
          const yes = await confirmDialog({ text: `Erase ${p.name}’s class, stars and progress?`, yes: 'Erase', no: 'Keep', icon: '⚠️' });
          if (!yes) return;
          profiles.remove(p.id);
          showToast(`${p.name} was removed.`, { icon: '🧹' });
          onChange();
        },
      }, '🗑️ Remove'),
    );
  };

  return h('section', { class: 'card gu-section' },
    h('h2', {}, 'Players'),
    h('p', { class: 'gu-note' }, 'Each player has their own class, grade, stars and progress. With more than one, the game asks who’s teaching when it starts.'),
    ...profiles.list.map(row),
    h('div', { class: 'chip-row' },
      h('button', {
        class: 'big-button primary',
        type: 'button',
        onclick: async () => {
          sfx.pop();
          const added = await profileForm({ profiles });
          if (!added) return;
          showToast(`${added.name} was added!`, { icon: added.emoji });
          onChange();
        },
      }, '+ Add a player'),
    ),
  );
}

export function ordinal(n) {
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n] ?? 'th'}`;
}
