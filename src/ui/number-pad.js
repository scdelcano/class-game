import { h } from './dom.js';
import { sfx } from '../audio/sfx.js';

/**
 * Big number pad for answers (up to 3 digits). A real keyboard works too.
 * onSubmit(number) is called with ✓ or Enter.
 */
export function createNumberPad({ onSubmit }) {
  let value = '';
  const display = h('div', { class: 'pad-display empty' });

  const setValue = (v) => {
    value = v.slice(0, 3);
    display.textContent = value || '?';
    display.classList.toggle('empty', !value);
  };
  const submit = () => {
    if (!value) {
      sfx.squeak();
      return;
    }
    const n = Number(value);
    setValue('');
    onSubmit(n);
  };
  const key = (label, action, cls = '') => h('button', {
    class: `key pad-key ${cls}`,
    type: 'button',
    onpointerdown: (e) => {
      e.preventDefault();
      sfx.tick();
      action();
    },
  }, label);

  const el = h('div', { class: 'number-pad' },
    display,
    h('div', { class: 'pad-grid' },
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => key(String(d), () => setValue(value + d))),
      key('⌫', () => setValue(value.slice(0, -1)), 'pad-back'),
      key('0', () => setValue(value + '0')),
      key('✓', submit, 'pad-ok'),
    ),
  );

  const onKeydown = (e) => {
    if (/^\d$/.test(e.key)) setValue(value + e.key);
    else if (e.key === 'Backspace') setValue(value.slice(0, -1));
    else if (e.key === 'Enter') submit();
    else return;
    e.preventDefault();
  };

  setValue('');
  return {
    el,
    clear: () => setValue(''),
    activate: () => document.addEventListener('keydown', onKeydown),
    deactivate: () => document.removeEventListener('keydown', onKeydown),
  };
}
