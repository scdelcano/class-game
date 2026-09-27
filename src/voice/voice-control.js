import { SpeechInput, isSpeechInputSupported, FRIENDLY_ERRORS } from './speech-input.js';
import { stopSpeaking } from './speech-output.js';
import { matchCommand } from './commands.js';
import { createEmitter } from '../core/emitter.js';

/**
 * Push-to-talk voice control: listens, then hands what was heard to
 *   1. "catchers" first (newest first) — e.g. attendance listening for names.
 *      A catcher returns false to pass, true or a short label if it used the
 *      words, or { ok: false, label } to show a friendly "didn't work" message.
 *   2. otherwise the command list (commands.js)
 *
 * Events for the mic button UI:
 *   'listening' (bool), 'hearing', 'interim' (text),
 *   'heard' { text, handled, command?, label? }, 'error' { code, message }
 */
export function createVoiceControl() {
  const input = new SpeechInput();
  const events = createEmitter();
  const handlers = new Map();
  const catchers = [];

  input.on('start', () => events.emit('listening', true));
  input.on('end', () => events.emit('listening', false));
  input.on('speech', () => events.emit('hearing'));
  input.on('interim', ({ text }) => events.emit('interim', text));
  input.on('error', (e) => {
    if (e.message) events.emit('error', e);
  });
  input.on('result', ({ text, alternatives }) => handle(text, alternatives));

  function handle(text, alternatives) {
    for (let i = catchers.length - 1; i >= 0; i--) {
      const used = catchers[i](alternatives, text);
      if (!used) continue;
      if (typeof used === 'object') events.emit('heard', { text, handled: used.ok !== false, label: used.label ?? null });
      else events.emit('heard', { text, handled: true, label: typeof used === 'string' ? used : null });
      return;
    }
    const match = matchCommand(alternatives);
    if (match && handlers.has(match.id)) {
      events.emit('heard', { text, handled: true, command: match.id });
      handlers.get(match.id)(match);
    } else {
      events.emit('heard', { text, handled: false });
    }
  }

  return {
    on: events.on,
    supported: isSpeechInputSupported(),
    get listening() {
      return input.listening;
    },
    /** Run `fn` when command `id` (see commands.js) is heard. */
    command(id, fn) {
      handlers.set(id, fn);
    },
    /** Let something grab heard words before the commands. Returns a remove function. */
    addCatcher(fn) {
      catchers.push(fn);
      return () => {
        const i = catchers.indexOf(fn);
        if (i >= 0) catchers.splice(i, 1);
      };
    },
    /** Mic button: start listening, or finish if already listening. */
    toggle() {
      if (!isSpeechInputSupported()) {
        events.emit('error', { code: 'unsupported', message: FRIENDLY_ERRORS.unsupported });
        return;
      }
      if (input.listening) input.stop();
      else {
        stopSpeaking(); // so the tablet doesn't hear its own students
        input.start();
      }
    },
    /** Act as if `text` was just heard (testing on a computer without a mic). */
    simulate(text) {
      handle(text, [{ text, confidence: 1 }]);
    },
    /** Stop listening and ignore anything half-heard. */
    cancel() {
      input.abort();
    },
  };
}
