import { h, uiRoot } from './dom.js';

let current = null;

/** A friendly message that pops up at the top for a few seconds. */
export function showToast(text, { seconds = 3, icon = '💬' } = {}) {
  current?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, h('span', { 'aria-hidden': 'true' }, icon), ' ', text);
  uiRoot().append(el);
  current = el;
  setTimeout(() => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 300);
    if (current === el) current = null;
  }, seconds * 1000);
}
