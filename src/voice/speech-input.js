/**
 * Push-to-talk speech recognition (Web Speech API).
 *
 * Each start() creates a fresh recognizer with continuous=false, which is the
 * most reliable setup in Chrome on Android. Events:
 *   'start'   listening began
 *   'speech'  the browser detected someone talking
 *   'interim' { text }                      partial words while talking
 *   'result'  { text, alternatives[] }      final words (alternatives help name matching)
 *   'error'   { code, message, detail }     message is child-friendly, or null for silent errors
 *   'end'     listening stopped (always fires last)
 *
 * The game stays fully playable by tapping, so every failure just produces a
 * friendly message and an 'end'.
 */
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const ASK_GROWN_UP = 'Ask a grown-up to let me use the microphone. You can still tap to play!';

export const FRIENDLY_ERRORS = {
  'not-allowed': `I'm not allowed to listen yet. ${ASK_GROWN_UP}`,
  'service-not-allowed': `I'm not allowed to listen yet. ${ASK_GROWN_UP}`,
  'no-speech': "I didn't hear anything. Tap the microphone and try again!",
  'audio-capture': "I can't find the microphone. You can still tap to play!",
  network: "I need the internet to listen. You can still tap to play!",
  'language-not-supported': "I can't listen in this language. You can still tap to play!",
  unsupported: "This browser can't listen. Try Chrome! You can still tap to play.",
  insecure: "I can only listen on a safe (https) page. You can still tap to play!",
  'start-failed': 'Oops, the microphone got stuck. Tap it again!',
  aborted: null, // we cancelled on purpose; say nothing
};

export function isSpeechInputSupported() {
  return Boolean(Recognition);
}

export class SpeechInput {
  /**
   * @param {object} [opts]
   * @param {string} [opts.lang='en-US']
   * @param {number} [opts.maxAlternatives=5]
   * @param {number} [opts.timeoutMs=10000] safety stop if the browser never ends on its own
   */
  constructor({ lang = 'en-US', maxAlternatives = 5, timeoutMs = 10000 } = {}) {
    this.lang = lang;
    this.maxAlternatives = maxAlternatives;
    this.timeoutMs = timeoutMs;
    this.rec = null;
    this.timer = 0;
    this.handlers = new Map();
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type).delete(fn);
  }

  emit(type, detail = {}) {
    this.handlers.get(type)?.forEach((fn) => fn(detail));
  }

  get listening() {
    return this.rec !== null;
  }

  /** Start listening. Returns false if listening could not start. */
  start() {
    if (this.rec) return false;
    if (!Recognition) return this.fail('unsupported');
    if (!window.isSecureContext) return this.fail('insecure');

    const rec = new Recognition();
    rec.lang = this.lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = this.maxAlternatives;

    let gotFinal = false;
    let hadError = false;
    let lastInterim = '';

    rec.onstart = () => this.emit('start');
    rec.onspeechstart = () => this.emit('speech');

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const alternatives = Array.from(result, (alt) => ({
            text: alt.transcript.trim(),
            confidence: alt.confidence,
          })).filter((alt) => alt.text);
          if (alternatives.length) {
            gotFinal = true;
            this.emit('result', { text: alternatives[0].text, alternatives });
          }
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim.trim()) {
        lastInterim = interim.trim();
        this.emit('interim', { text: lastInterim });
      }
    };

    rec.onerror = (event) => {
      hadError = true;
      this.emit('error', {
        code: event.error,
        message: FRIENDLY_ERRORS[event.error] ?? "Oops, I couldn't hear that. Try again!",
        detail: event.message || '',
      });
    };

    rec.onend = () => {
      clearTimeout(this.timer);
      this.rec = null;
      if (!gotFinal && !hadError) {
        // Android sometimes ends with only partial words, or with nothing at all.
        if (lastInterim) {
          this.emit('result', { text: lastInterim, alternatives: [{ text: lastInterim, confidence: 0 }] });
        } else {
          this.emit('error', { code: 'no-speech', message: FRIENDLY_ERRORS['no-speech'], detail: 'ended silently' });
        }
      }
      this.emit('end');
    };

    this.rec = rec;
    try {
      rec.start();
    } catch (err) {
      this.rec = null;
      return this.fail('start-failed', String(err));
    }
    this.timer = setTimeout(() => this.stop(), this.timeoutMs);
    return true;
  }

  /** Stop listening and keep whatever was heard so far. */
  stop() {
    this.rec?.stop();
  }

  /** Stop listening and throw away what was heard. */
  abort() {
    this.rec?.abort();
  }

  fail(code, detail = '') {
    this.emit('error', { code, message: FRIENDLY_ERRORS[code], detail });
    this.emit('end');
    return false;
  }
}
