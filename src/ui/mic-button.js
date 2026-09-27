import { h } from './dom.js';
import { sfx } from '../audio/sfx.js';

const MIC_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <rect x="8" y="2" width="8" height="13" rx="4" />
  <path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke-width="2.2" stroke-linecap="round" />
  <path d="M12 18v3M8.5 21h7" fill="none" stroke-width="2.2" stroke-linecap="round" /></svg>`;

/**
 * The big microphone button (bottom-left) and the caption next to it.
 * The caption always says something useful: a hint of what to say, what it
 * is hearing, what it heard, or a friendly message if something went wrong.
 *
 * @param {{voice: ReturnType<import('../voice/voice-control.js').createVoiceControl>, hint: () => string}} opts
 */
export function createMicButton({ voice, hint, parent }) {
  const button = h('button', { class: 'mic hud-mic', type: 'button', 'aria-label': 'Tap to talk' });
  button.innerHTML = `${MIC_SVG}<span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>`;
  const title = h('div', { class: 'mic-title' });
  const detail = h('div', { class: 'mic-detail' });
  const caption = h('div', { class: 'mic-caption' }, title, detail);
  const dock = h('div', { class: 'mic-dock' }, button, caption);
  parent.append(dock);

  let resetTimer = 0;

  function show(kind, titleText, detailText = '', seconds = 0) {
    clearTimeout(resetTimer);
    caption.className = `mic-caption ${kind}`;
    title.textContent = titleText;
    detail.textContent = detailText;
    if (seconds) resetTimer = setTimeout(showHint, seconds * 1000);
  }

  function showHint() {
    if (voice.listening) return;
    show('hint', 'Tap and talk!', `Try: ${hint()}`);
  }

  if (!voice.supported) button.classList.add('mic-off');

  button.addEventListener('click', () => {
    sfx.unlock();
    voice.toggle();
  });

  voice.on('listening', (on) => {
    button.classList.toggle('listening', on);
    if (on) {
      sfx.tick();
      show('listening', "I'm listening…", 'Talk now, then wait (or tap again).');
    } else {
      button.classList.remove('hearing');
      if (caption.classList.contains('listening')) showHint();
    }
  });
  voice.on('hearing', () => button.classList.add('hearing'));
  voice.on('interim', (text) => show('listening', "I'm listening…", `“${text}”`));
  voice.on('heard', ({ text, handled, label }) => {
    if (handled) show('heard', `“${text}”`, label ? `✓ ${label}` : '✓ Okay!', 4);
    else show('unknown', `“${text}”`, label ?? `Hmm, I don't know that one. Try: ${hint()}`, 6);
  });
  voice.on('error', ({ message }) => show('problem', '🙉 Oops!', message, 7));

  showHint();

  return {
    /** Re-show the hint (e.g. after class starts, the hint changes). */
    refresh() {
      if (caption.classList.contains('hint')) showHint();
    },
    /** Show a message in the caption for a few seconds. */
    say(titleText, detailText = '', seconds = 4) {
      show('heard', titleText, detailText, seconds);
    },
  };
}
