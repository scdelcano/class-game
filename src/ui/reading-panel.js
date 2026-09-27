import { h, uiRoot } from './dom.js';
import { sfx } from '../audio/sfx.js';
import { createKeyboard } from './keyboard.js';
import { READING_LENGTH } from '../game/reading-lesson.js';

/**
 * The reading panel (right side): the word, what's happening, and the
 * buttons for this moment:
 *   hands          -> 🎲 Pick for me
 *   judge          -> ✓ Right! / ✗ Not right  (+ 🔊 to hear the word)
 *   read, fix-read -> 🎤 Read it!  ·  ✓ I read it out loud  ·  🔊 Hear it
 *   spell, fix-spell -> what she typed + keyboard  ·  🔊 Say it again
 *   review -> Next · done -> Again / Done
 */
export function createReadingPanel({ lesson, onMic, onOpen, onClose }) {
  const progress = h('div', { class: 'lesson-progress' });
  const card = h('div', { class: 'reading-card' });
  const tipEl = h('div', { class: 'reading-tip', hidden: true });
  const prompt = h('div', { class: 'lesson-prompt' });
  const feedbackEl = h('div', { class: 'lesson-feedback', hidden: true });
  const controls = h('div', { class: 'lesson-controls' });
  const typedEl = h('div', { class: 'typed-word empty' });
  const keyboard = createKeyboard({
    maxLength: 16,
    capitalize: false,
    onChange: (v) => {
      typedEl.textContent = v || 'type the word';
      typedEl.classList.toggle('empty', !v);
    },
    onDone: (v) => {
      if (!v.trim()) {
        sfx.squeak();
        return;
      }
      keyboard.setValue('');
      typedEl.textContent = 'type the word';
      typedEl.classList.add('empty');
      lesson.spell(v);
    },
  });

  const button = (label, onclick, cls = '') => h('button', { class: `big-button ${cls}`, type: 'button', onclick: () => { sfx.unlock(); onclick(); } }, label);
  const hear = () => button('🔊 Hear it', () => lesson.sayWord(), 'hear-button');
  const helpButton = button('💡 Help', () => { sfx.pop(); lesson.help(); }, 'hint-button');

  const el = h('div', { class: 'side-panel lesson-panel reading-panel', 'aria-hidden': 'true' },
    h('div', { class: 'paper' },
      h('header', { class: 'clip-header' }, h('h2', {}, h('span', { 'aria-hidden': 'true' }, '📖 '), 'Reading time'), progress),
      card,
      tipEl,
      prompt,
      feedbackEl,
      controls,
      h('footer', { class: 'clip-footer' },
        helpButton,
        button('✕ Stop lesson', () => { sfx.pop(); lesson.stop(); }),
      ),
    ),
  );
  uiRoot().append(el);
  let isOpen = false;
  let lastPhase = null;

  function render(s) {
    progress.replaceChildren(...Array.from({ length: READING_LENGTH }, (_, i) => {
      const r = s.results[i];
      return h('span', { class: `dot${r === true ? ' right' : r === false ? ' slip' : ''}${i === s.index - 1 && s.phase !== 'done' ? ' now' : ''}` });
    }));

    // the card shows what's on the board (spelling words are never given away)
    const item = s.item;
    card.classList.toggle('sentence', item?.kind === 'sentence');
    if (s.phase === 'intro') card.textContent = 'Get ready!';
    else if (s.phase === 'done') card.textContent = `⭐ ${s.right} of ${s.total}`;
    else if (s.mode === 'spell') {
      const shown = s.phase === 'hands' || s.phase === 'spell' ? '🔊 ?' : s.written;
      card.textContent = s.phase === 'review' || s.phase === 'praise' ? item.text : shown;
    } else card.textContent = item?.text ?? '';

    // help: the same parts and tip as on the board
    const board = s.boardState;
    if (board?.parts && s.mode === 'read' && s.phase !== 'intro' && s.phase !== 'done') {
      card.replaceChildren(...board.parts.flatMap((p, i) => [
        i ? h('span', { class: 'part-dot' }, '·') : null,
        h('span', { class: `part part-${i % 2}` }, p),
      ].filter(Boolean)));
    } else if (s.mode === 'spell' && s.phase === 'spell' && s.hinted && board?.text) {
      card.textContent = board.text;
    }
    tipEl.hidden = !(board?.tip && s.hinted && s.phase !== 'done');
    tipEl.textContent = board?.tip ? `💡 ${board.tip}` : '';

    const name = s.student?.name ?? '';
    const asker = s.asker ? `${s.asker.name} asks: ` : '';
    prompt.textContent = {
      intro: 'Class is getting ready…',
      hands: s.mode === 'spell' ? 'Who can spell the word? Pick a student!' : 'Who can read it? Pick a student!',
      thinking: s.mode === 'spell' ? `${name} is writing…` : `${name} is reading…`,
      judge: s.mode === 'spell' ? `Did ${name} spell it right?` : `${name} read: “${s.said}”. Is that right?`,
      read: `${asker}can you read it?`,
      'fix-read': 'Read it the right way!',
      spell: `${asker}how do you spell it?`,
      'fix-spell': 'Type the right spelling!',
      praise: '',
      review: 'Look at the board, then tap Next.',
      done: 'Lesson finished!',
    }[s.phase] ?? '';

    feedbackEl.hidden = !s.feedback;
    if (s.feedback) {
      feedbackEl.textContent = s.feedback.text;
      feedbackEl.className = `lesson-feedback ${s.feedback.tone}`;
    }

    const spelling = s.phase === 'spell' || s.phase === 'fix-spell';
    if (spelling) keyboard.activate();
    else keyboard.deactivate();
    helpButton.hidden = !['read', 'fix-read', 'spell', 'fix-spell', 'judge'].includes(s.phase);

    if (s.phase === lastPhase && spelling) return; // keep the keyboard as it is while typing
    lastPhase = s.phase;
    switch (s.phase) {
      case 'hands':
        controls.replaceChildren(...[
          button('🎲 Pick for me', () => lesson.chooseRandom(), 'wide'),
          s.mode === 'spell' ? hear() : null,
        ].filter(Boolean));
        break;
      case 'judge':
        controls.replaceChildren(...[
          h('div', { class: 'judge-row' },
            button('✓ Right!', () => lesson.judge('right'), 'judge-yes'),
            button('✗ Not right', () => lesson.judge('wrong'), 'judge-no'),
          ),
          s.mode === 'spell' ? hear() : null,
        ].filter(Boolean));
        break;
      case 'read':
      case 'fix-read':
        controls.replaceChildren(
          button('🎤 Read it!', () => onMic(), 'read-button'),
          h('div', { class: 'judge-row small' },
            button('✓ I read it out loud', () => lesson.readAloud(null)),
            hear(),
          ),
        );
        break;
      case 'spell':
      case 'fix-spell':
        keyboard.setValue('');
        typedEl.textContent = 'type the word';
        typedEl.classList.add('empty');
        controls.replaceChildren(h('div', { class: 'spell-row' }, typedEl, hear()), keyboard.el);
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
    lastPhase = null;
    keyboard.deactivate();
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
      const w = el.getBoundingClientRect().width || 520;
      return Math.max(0.35, 1 - (w + 24) / window.innerWidth);
    },
  };
}
