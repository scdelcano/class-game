import { h, uiRoot } from './dom.js';
import { sfx } from '../audio/sfx.js';

/**
 * "Which lesson?" — big picture choices. Add new subjects to `choices`.
 * @param {{icon: string, label: string, start: () => void}[]} choices
 */
export function showLessonChooser(choices) {
  const close = () => {
    backdrop.classList.add('closing');
    setTimeout(() => backdrop.remove(), 180);
  };
  const backdrop = h('div', { class: 'dialog-backdrop', onclick: (e) => { if (e.target === backdrop) { sfx.pop(); close(); } } },
    h('div', { class: 'dialog card chooser' },
      h('p', { class: 'dialog-text' }, 'What should we learn?'),
      h('div', { class: 'chooser-row' }, ...choices.map((c) => h('button', {
        class: 'chooser-choice',
        type: 'button',
        onclick: () => {
          sfx.pop();
          close();
          c.start();
        },
      }, h('span', { class: 'chooser-icon', 'aria-hidden': 'true' }, c.icon), c.label))),
      h('button', { class: 'big-button', type: 'button', onclick: () => { sfx.pop(); close(); } }, 'Not now'),
    ),
  );
  uiRoot().append(backdrop);
}
