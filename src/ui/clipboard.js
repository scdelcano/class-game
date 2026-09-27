import { h, uiRoot } from './dom.js';
import { sfx } from '../audio/sfx.js';
import { confirmDialog } from './dialog.js';

const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>';

const STATUS_TEXT = {
  none: '',
  calling: 'Calling…',
  note: '🤒 Not here today',
  present: 'Here!',
  absent: 'Absent',
};

/**
 * The attendance clipboard: slides up on the right side so the class stays
 * visible on the left. One row per student: picture, name, big checkbox.
 * Tap a row to call that student (tap again to un-check).
 */
export function createClipboard({ roster, attendance, portraits, onOpen, onClose }) {
  const dateEl = h('div', { class: 'clip-date' });
  const summary = h('div', { class: 'clip-summary' });
  const guessName = h('b');
  const guessHeard = h('div', { class: 'guess-heard' });
  const guess = h('div', { class: 'clip-guess', hidden: true },
    h('div', { class: 'guess-text' }, 'Did you mean ', guessName, '?'),
    guessHeard,
    h('div', { class: 'guess-buttons' },
      h('button', { class: 'big-button', type: 'button', onclick: () => { sfx.pop(); hideGuess(); } }, '✕ No'),
      h('button', { class: 'big-button primary', type: 'button', onclick: confirmGuess }, '✓ Yes'),
    ),
  );
  const roll = h('ol', { class: 'roll' });
  const el = h('div', { class: 'clipboard', 'aria-hidden': 'true' },
    h('div', { class: 'clip-clip', 'aria-hidden': 'true' }),
    h('div', { class: 'paper' },
      h('header', { class: 'clip-header' },
        h('h2', {}, h('span', { 'aria-hidden': 'true' }, '📋 '), 'Attendance'),
        dateEl,
      ),
      summary,
      guess,
      roll,
      h('footer', { class: 'clip-footer' },
        h('button', { class: 'big-button', type: 'button', onclick: askNewDay }, h('span', { 'aria-hidden': 'true' }, '🌅'), ' New day'),
        h('button', { class: 'big-button primary', type: 'button', onclick: () => { sfx.pop(); close(); } }, '✓ Done'),
      ),
    ),
  );
  uiRoot().append(el);

  let isOpen = false;
  let guessed = null;
  const rows = new Map(); // student id -> { li, statusEl }

  function row(student) {
    const statusEl = h('span', { class: 'roll-status' });
    const absentButton = h('button', {
      class: 'big-button absent-button',
      type: 'button',
      onclick: (e) => {
        e.stopPropagation();
        attendance.markAbsent(student);
      },
    }, h('span', { 'aria-hidden': 'true' }, '🏠'), ' Mark absent');
    const box = h('span', { class: 'roll-box', 'aria-hidden': 'true' });
    box.innerHTML = `${CHECK_SVG}<span class="home">🏠</span>`;
    const li = h('li', { class: 'roll-row' },
      h('button', {
        class: 'roll-main',
        type: 'button',
        onclick: () => {
          sfx.unlock();
          hideGuess();
          attendance.call(student, { via: 'tap' });
        },
      },
      h('img', { class: 'roll-portrait', src: portraits.get(student.type, student.look), alt: '' }),
      h('span', { class: 'roll-text' }, h('span', { class: 'roll-name' }, student.name), statusEl),
      box),
      absentButton,
    );
    rows.set(student.id, { li, statusEl });
    return li;
  }

  /** Rebuild the whole list (class list changed). */
  function render() {
    rows.clear();
    roll.replaceChildren(...roster.students.map(row));
    refresh();
  }

  /** Update checkmarks, statuses and the summary line. */
  function refresh() {
    for (const s of roster.students) {
      const r = rows.get(s.id);
      if (!r) {
        render();
        return;
      }
      const st = attendance.status(s.id);
      if (r.li.dataset.status !== st) {
        r.li.dataset.status = st;
        r.statusEl.textContent = STATUS_TEXT[st];
        if (st === 'present' || st === 'absent') {
          r.li.classList.remove('flash');
          void r.li.offsetWidth;
          r.li.classList.add('flash');
        }
        if (st === 'note' || st === 'calling') r.li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
    const c = attendance.counts();
    dateEl.textContent = `${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} · Day ${attendance.dayNumber}`;
    if (c.total && c.marked === c.total) {
      summary.className = 'clip-summary done';
      summary.textContent = `🎉 ${c.here} here, ${c.absent} absent!`;
    } else {
      summary.className = 'clip-summary';
      summary.textContent = c.marked
        ? `${c.marked} of ${c.total} checked. Keep going!`
        : 'Tap a name, or tap 🎤 and say it!';
    }
  }

  function showGuess(student, heard) {
    guessed = student;
    guessName.textContent = student.name;
    guessHeard.textContent = heard ? `I heard “${heard}”` : '';
    guess.hidden = false;
    for (const [id, r] of rows) r.li.classList.toggle('guess', id === student.id);
    rows.get(student.id)?.li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    sfx.tick();
  }

  function hideGuess() {
    guessed = null;
    guess.hidden = true;
    for (const r of rows.values()) r.li.classList.remove('guess');
  }

  function confirmGuess() {
    const student = guessed;
    hideGuess();
    if (student) attendance.call(student, { via: 'voice' });
  }

  async function askNewDay() {
    const yes = await confirmDialog({ text: 'Start a new school day? The checkmarks will be cleared.', yes: '🌅 New day', no: 'Not yet', icon: '🌅' });
    if (!yes) return;
    attendance.newDay();
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    render();
    hideGuess();
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    sfx.pop();
    onOpen?.();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    hideGuess();
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    onClose?.();
  }

  attendance.on('change', () => { if (isOpen) refresh(); });
  attendance.on('newDay', () => { if (isOpen) render(); });
  roster.on('change', () => { if (isOpen) render(); });

  return {
    open,
    close,
    get isOpen() {
      return isOpen;
    },
    showGuess,
    hideGuess,
    /** Fraction of the screen width the clipboard leaves free (for the camera). */
    freeArea() {
      const w = el.getBoundingClientRect().width || 460;
      return Math.max(0.35, 1 - (w + 24) / window.innerWidth);
    },
  };
}
