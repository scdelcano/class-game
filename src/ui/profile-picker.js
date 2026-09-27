import { h, uiRoot } from './dom.js';
import { sfx } from '../audio/sfx.js';
import { confirmDialog } from './dialog.js';
import { holdToOpen } from './grownups.js';
import { playersCard, ordinal } from './profile-form.js';

/**
 * "Who's teaching today?": a big button for each player. Shown at start-up
 * when more than one player plays on this tablet.
 * Grown-ups can press and hold ⚙️ to add, change or remove players.
 * @returns {Promise<object>} the chosen profile
 */
export function pickProfile(profiles) {
  return new Promise((resolve) => {
    const grid = h('div', { class: 'roster-grid picker-grid' });
    const grownups = h('button', { class: 'big-button picker-grownups', type: 'button', title: 'Grown-ups: press and hold' }, '⚙️ Grown-ups');
    const el = h('div', { class: 'screen picker-screen' },
      h('header', { class: 'screen-header' },
        h('h1', {}, h('span', { 'aria-hidden': 'true' }, '🍎 '), 'Who’s teaching today?'),
        h('span', { class: 'roster-count' }),
        grownups,
      ),
      grid,
    );
    uiRoot().append(el);

    function render() {
      // the last player to play comes first
      const list = profiles.list.sort((a, b) => (b.id === profiles.lastId) - (a.id === profiles.lastId));
      grid.replaceChildren(...list.map((p) => h('button', {
        class: 'student-card',
        type: 'button',
        onclick: () => {
          sfx.unlock(); // the first tap lets the game make sounds
          sfx.pop();
          el.remove();
          resolve(p);
        },
      },
      h('span', { class: 'portrait picker-emoji', 'aria-hidden': 'true' }, p.emoji),
      h('span', { class: 'student-name' }, p.name),
      h('span', { class: 'student-type' }, `${ordinal(profiles.gradeOf(p.id))} grade`))));
    }

    holdToOpen(grownups, () => managePlayers(profiles, render));
    render();
  });
}

/** Grown-ups on the picker screen: the Players card in a pop-up. */
function managePlayers(profiles, onChange) {
  const close = () => {
    sfx.pop();
    backdrop.classList.add('closing');
    setTimeout(() => backdrop.remove(), 180);
    onChange();
  };
  const body = h('div', {});
  const renderBody = () => body.replaceChildren(playersCard({ profiles, onChange: renderBody }));
  renderBody();
  const backdrop = h('div', { class: 'dialog-backdrop' },
    h('div', { class: 'dialog manage-players' },
      body,
      h('div', { class: 'dialog-buttons' }, h('button', { class: 'big-button primary', type: 'button', onclick: close }, '✓ Done')),
    ),
  );
  uiRoot().append(backdrop);
}

/**
 * "Switch teacher" in the room: asks first, then restarts the game so the
 * picker shows. Everything is already saved as it happens.
 */
export async function switchProfile() {
  const yes = await confirmDialog({ text: 'Switch to another teacher?', yes: 'Switch', no: 'Stay', icon: '👋' });
  if (yes) location.reload();
}
