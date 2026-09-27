import { h, uiRoot } from './dom.js';
import { sfx } from '../audio/sfx.js';
import { createNumberPad } from './number-pad.js';
import { LESSON_LENGTH } from '../game/lesson.js';

/**
 * The lesson panel (right side, like the clipboard): the problem in big
 * numbers, what's happening, and the buttons for this moment:
 *   hands   -> 🎲 Pick for me
 *   judge   -> ✓ Right! / ✗ Not right
 *   answer  -> number pad
 *   review  -> Next
 *   done    -> Again / Done
 */
export function createLessonPanel({ lesson, onOpen, onClose }) {
  const progress = h('div', { class: 'lesson-progress' });
  const problemEl = h('div', { class: 'lesson-problem' });
  const prompt = h('div', { class: 'lesson-prompt' });
  const feedbackEl = h('div', { class: 'lesson-feedback', hidden: true });
  const controls = h('div', { class: 'lesson-controls' });
  const pad = createNumberPad({ onSubmit: (n) => lesson.answer(n) });

  const button = (label, onclick, cls = '') => h('button', { class: `big-button ${cls}`, type: 'button', onclick: () => { sfx.unlock(); onclick(); } }, label);
  const hintButton = button('💡 Show me', () => { sfx.pop(); lesson.hint(); }, 'hint-button');

  const el = h('div', { class: 'side-panel lesson-panel', 'aria-hidden': 'true' },
    h('div', { class: 'paper' },
      h('header', { class: 'clip-header' }, h('h2', {}, h('span', { 'aria-hidden': 'true' }, '✏️ '), 'Math time'), progress),
      problemEl,
      prompt,
      feedbackEl,
      controls,
      h('footer', { class: 'clip-footer' },
        hintButton,
        button('✕ Stop lesson', () => { sfx.pop(); lesson.stop(); }),
      ),
    ),
  );
  uiRoot().append(el);
  let isOpen = false;

  function render(s) {
    if (!s) return;
    // progress dots: green = right, orange = slip, white = to do
    progress.replaceChildren(...Array.from({ length: LESSON_LENGTH }, (_, i) => {
      const r = s.results[i];
      return h('span', { class: `dot${r === true ? ' right' : r === false ? ' slip' : ''}${i === s.index - 1 && s.phase !== 'done' ? ' now' : ''}` });
    }));

    const p = s.problem;
    if (s.phase === 'intro') problemEl.textContent = 'Get ready!';
    else if (s.phase === 'done') problemEl.textContent = `⭐ ${s.right} of ${s.total}`;
    else {
      const shown = s.phase === 'thinking' || s.phase === 'judge' ? s.studentAnswer : '?';
      problemEl.textContent = `${p.text} = ${shown}`;
    }

    const name = s.student?.name ?? '';
    prompt.textContent = {
      intro: 'Class is getting ready…',
      hands: 'Who knows? Tap a student with a hand up, or say their name!',
      thinking: `${name} is thinking…`,
      judge: `${name} says ${s.studentAnswer}. Is that right?`,
      correct: `What's the right answer, teacher?`,
      answer: `${s.asker ? `${s.asker.name} asks` : 'Your turn'}: what's ${p?.text}?`,
      praise: '',
      review: 'Look at the board, then tap Next.',
      done: 'Lesson finished!',
    }[s.phase] ?? '';

    feedbackEl.hidden = !s.feedback;
    if (s.feedback) {
      feedbackEl.textContent = s.feedback.text;
      feedbackEl.className = `lesson-feedback ${s.feedback.tone}`;
    }

    const needPad = s.phase === 'answer' || s.phase === 'correct';
    if (needPad) pad.activate();
    else {
      pad.deactivate();
      pad.clear();
    }
    hintButton.hidden = !['judge', 'answer', 'correct'].includes(s.phase) || s.hinted;

    switch (s.phase) {
      case 'hands':
        controls.replaceChildren(button('🎲 Pick for me', () => lesson.chooseRandom(), 'wide'));
        break;
      case 'judge':
        controls.replaceChildren(h('div', { class: 'judge-row' },
          button('✓ Right!', () => lesson.judge('right'), 'judge-yes'),
          button('✗ Not right', () => lesson.judge('wrong'), 'judge-no'),
        ));
        break;
      case 'answer':
      case 'correct':
        if (controls.firstChild !== pad.el) controls.replaceChildren(pad.el);
        break;
      case 'review':
        controls.replaceChildren(button('Next ➜', () => { sfx.pop(); lesson.next(); }, 'primary wide'));
        break;
      case 'done':
        controls.replaceChildren(h('div', { class: 'judge-row' },
          button('🔁 Again', () => { lesson.stop(); lesson.start(); }),
          button('✓ Done', () => { sfx.pop(); lesson.stop(); }, 'primary'),
        ));
        break;
      default:
        controls.replaceChildren();
    }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    onOpen?.();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    pad.deactivate();
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    onClose?.();
  }

  lesson.on('change', (s) => {
    open();
    render(s);
  });
  lesson.on('end', close);

  return {
    get isOpen() {
      return isOpen;
    },
    freeArea() {
      const w = el.getBoundingClientRect().width || 460;
      return Math.max(0.35, 1 - (w + 24) / window.innerWidth);
    },
  };
}
