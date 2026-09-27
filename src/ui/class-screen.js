import { h, uiRoot } from './dom.js';
import { sfx } from '../audio/sfx.js';
import { showToast } from './toast.js';
import { TYPES } from '../characters/options.js';
import { MAX_STUDENTS } from '../students/roster.js';

/**
 * "My class": every student as a picture card, plus "New student".
 * Tapping a card opens the "make a student" editor for it.
 */
export function createClassScreen({ roster, portraits, starsFor = () => 0, onEdit, onClose }) {
  const grid = h('div', { class: 'roster-grid' });
  const count = h('span', { class: 'roster-count' });
  const el = h('div', { class: 'screen class-screen', hidden: true },
    h('header', { class: 'screen-header' },
      h('h1', {}, h('span', { 'aria-hidden': 'true' }, '🎒 '), 'My class'),
      count,
      h('button', { class: 'big-button primary', type: 'button', onclick: close }, '✓ Done'),
    ),
    grid,
  );
  uiRoot().append(el);

  function card(student) {
    const typeLabel = TYPES.find((t) => t.id === student.type)?.label ?? '';
    return h('button', { class: 'student-card', type: 'button', onclick: () => { sfx.pop(); onEdit(student); } },
      h('span', { class: 'portrait' }, h('img', { src: portraits.get(student.type, student.look), alt: '' })),
      h('span', { class: 'student-name' }, student.name),
      h('span', { class: 'student-type' }, typeLabel),
      student.example ? h('span', { class: 'example-tag' }, 'Example') : null,
      starsFor(student.id) ? h('span', { class: 'star-tag' }, `⭐ ${starsFor(student.id)}`) : null,
    );
  }

  function render() {
    const students = roster.students;
    count.textContent = `${students.length} ${students.length === 1 ? 'student' : 'students'}`;
    const add = h('button', {
      class: 'student-card add-card',
      type: 'button',
      onclick: () => {
        if (roster.isFull) {
          sfx.squeak();
          showToast(`The class is full! ${MAX_STUDENTS} students is the most.`, { icon: '🪑' });
          return;
        }
        sfx.pop();
        onEdit(null);
      },
    },
    h('span', { class: 'portrait add-portrait', 'aria-hidden': 'true' }, '+'),
    h('span', { class: 'student-name' }, 'New student'));
    grid.replaceChildren(...students.map(card), add);
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

  roster.on('change', () => { if (!el.hidden) render(); });

  return {
    open,
    /** Show again after the editor closes. */
    show: open,
    hide() {
      el.hidden = true;
    },
  };
}
