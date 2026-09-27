/**
 * Talking voices (speechSynthesis). Each student type gets a base pitch/rate;
 * later each student will also get a small personal offset so no two sound
 * exactly alike.
 */
const synth = window.speechSynthesis;

/** Base voice settings per student type. Pitch and rate range 0.1–2 in Chrome. */
export const VOICE_PRESETS = {
  teacher: { pitch: 1.0, rate: 1.0 },
  kid: { pitch: 1.35, rate: 1.05 },
  plush: { pitch: 1.9, rate: 1.15 },
  truck: { pitch: 0.3, rate: 0.85 },
  tank: { pitch: 0.55, rate: 0.9 },
};

// Chrome can garbage-collect an utterance mid-sentence and never fire 'end'.
// Holding a reference until it finishes avoids that.
const speaking = new Set();
let voicesPromise = null;

export function isSpeechOutputSupported() {
  return Boolean(synth);
}

/**
 * Resolves with the list of installed voices (they load asynchronously).
 * An empty answer is never remembered: Android often loads voices late.
 */
export function getVoices() {
  if (!synth) return Promise.resolve([]);
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  voicesPromise ??= new Promise((resolve) => {
    const finish = () => {
      synth.removeEventListener('voiceschanged', onChange);
      voicesPromise = null; // ask again next time if still empty
      resolve(synth.getVoices());
    };
    const onChange = () => { if (synth.getVoices().length) finish(); };
    synth.addEventListener('voiceschanged', onChange);
    setTimeout(finish, 2000); // some devices never fire the event
  });
  return voicesPromise;
}

/** English voices, with the device default (or US English) first. */
export async function englishVoices() {
  const voices = (await getVoices()).filter((v) => v.lang.toLowerCase().startsWith('en'));
  const score = (v) => (v.default ? 0 : v.lang === 'en-US' ? 1 : 2);
  return voices.sort((a, b) => score(a) - score(b));
}

/**
 * Say something out loud. Resolves when finished (never rejects).
 * @param {string} text
 * @param {{pitch?: number, rate?: number, volume?: number, voice?: SpeechSynthesisVoice, interrupt?: boolean}} [opts]
 *   interrupt: stop anything already being said first (otherwise it queues)
 */
export async function speak(text, { pitch = 1, rate = 1, volume = 1, voice = null, interrupt = false } = {}) {
  if (!synth || !text) return;
  if (interrupt && (synth.speaking || synth.pending)) {
    synth.cancel();
    // Chrome on Android can drop an utterance queued right after cancel().
    await new Promise((r) => setTimeout(r, 80));
  }
  const chosen = voice ?? (await englishVoices())[0] ?? null;
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = pitch;
    u.rate = rate;
    u.volume = volume;
    if (chosen) {
      u.voice = chosen;
      u.lang = chosen.lang;
    } else {
      u.lang = 'en-US';
    }
    const finish = () => {
      speaking.delete(u);
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    speaking.add(u);
    synth.speak(u);
  });
}

export function stopSpeaking() {
  synth?.cancel();
  speaking.clear();
}
