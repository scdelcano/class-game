import { h } from './dom.js';
import { sfx } from '../audio/sfx.js';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/**
 * Big on-screen keyboard for typing names. (The tablet's own keyboard would
 * cover half the screen in landscape.) With `capitalize` (names), letters are
 * capitalized at the start of each word. A real keyboard also works.
 */
export function createKeyboard({ maxLength = 12, capitalize = true, onChange = () => {}, onDone = () => {} } = {}) {
  let value = '';

  const set = (next) => {
    value = next.slice(0, maxLength);
    onChange(value);
  };

  const type = (ch) => {
    if (value.length >= maxLength) {
      sfx.squeak();
      return;
    }
    const startOfWord = capitalize && (value === '' || /[\s-]$/.test(value));
    set(value + (startOfWord ? ch.toUpperCase() : ch.toLowerCase()));
  };

  const press = (action) => (e) => {
    e.preventDefault();
    sfx.tick();
    action();
  };

  const letterKey = (ch) => h('button', { class: 'key', type: 'button', onpointerdown: press(() => type(ch)) }, capitalize ? ch : ch.toLowerCase());

  const el = h('div', { class: 'keyboard' },
    ...ROWS.map((row, i) => h('div', { class: 'key-row' },
      ...[...row].map(letterKey),
      i === 2 ? h('button', { class: 'key key-wide', type: 'button', 'aria-label': 'Delete', onpointerdown: press(() => set(value.slice(0, -1))) }, '⌫') : null,
    )),
    h('div', { class: 'key-row' },
      h('button', { class: 'key', type: 'button', onpointerdown: press(() => type('-')) }, '-'),
      h('button', { class: 'key key-space', type: 'button', onpointerdown: press(() => { if (value && !value.endsWith(' ')) set(`${value} `); }) }, 'space'),
      h('button', { class: 'key key-done', type: 'button', onpointerdown: press(() => onDone(value)) }, '✓ Done'),
    ),
  );

  const onKeydown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[a-z]$/i.test(e.key)) type(e.key);
    else if (e.key === 'Backspace') set(value.slice(0, -1));
    else if (e.key === ' ' && value && !value.endsWith(' ')) set(`${value} `);
    else if (e.key === '-' || e.key === "'") type(e.key);
    else if (e.key === 'Enter') onDone(value);
    else return;
    e.preventDefault();
  };

  return {
    el,
    get value() {
      return value;
    },
    setValue(v) {
      value = String(v ?? '').slice(0, maxLength);
    },
    /** Listen to a physical keyboard while visible. */
    activate() {
      document.addEventListener('keydown', onKeydown);
    },
    deactivate() {
      document.removeEventListener('keydown', onKeydown);
    },
  };
}
