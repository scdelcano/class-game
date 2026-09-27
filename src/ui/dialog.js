import { h, uiRoot } from './dom.js';
import { sfx } from '../audio/sfx.js';

/**
 * The game's own yes/no question box (never the browser's pop-ups).
 * @returns {Promise<boolean>} true if the first (yes) button was tapped
 */
export function confirmDialog({ text, yes = 'Yes', no = 'No', icon = '❓' }) {
  return new Promise((resolve) => {
    const done = (answer) => {
      sfx.pop();
      backdrop.classList.add('closing');
      setTimeout(() => backdrop.remove(), 180);
      resolve(answer);
    };
    const backdrop = h('div', { class: 'dialog-backdrop', onclick: (e) => { if (e.target === backdrop) done(false); } },
      h('div', { class: 'dialog card', role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'dialog-icon', 'aria-hidden': 'true' }, icon),
        h('p', { class: 'dialog-text' }, text),
        h('div', { class: 'dialog-buttons' },
          h('button', { class: 'big-button', type: 'button', onclick: () => done(false) }, no),
          h('button', { class: 'big-button primary', type: 'button', onclick: () => done(true) }, yes),
        ),
      ),
    );
    uiRoot().append(backdrop);
  });
}
