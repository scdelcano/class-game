import { VOICE_PRESETS, englishVoices, speak } from './speech-output.js';
import { sfx } from '../audio/sfx.js';

/** Pitch change for each tone choice. */
const TONE_SHIFT = { high: 0.3, medium: 0, low: -0.25 };

/** The little sound each type makes before talking (kids just talk). */
const TYPE_SOUND = { plush: 'squeak', truck: 'honk', tank: 'clank' };

let voiceList = null;

/** Device voices a student can use (offline ones preferred). Remembered once found. */
async function studentVoices() {
  if (voiceList) return voiceList;
  const all = await englishVoices();
  const local = all.filter((v) => v.localService);
  const list = local.length ? local : all;
  if (list.length) voiceList = list;
  return list;
}

/** How many different device voices there are to choose from. */
export async function voiceVariantCount() {
  return Math.max(1, (await studentVoices()).length);
}

/** Final pitch/rate/voice for a student. */
export async function voiceSettings(student) {
  const base = VOICE_PRESETS[student.type] ?? VOICE_PRESETS.kid;
  const voices = await studentVoices();
  const variant = student.voice?.variant ?? 0;
  const pitch = Math.min(2, Math.max(0.1, base.pitch + (TONE_SHIFT[student.voice?.tone] ?? 0)));
  // each variant also nudges the speed a little so voices differ even on
  // tablets with only one English voice
  const rate = base.rate + ((variant % 3) - 1) * 0.06;
  return { pitch, rate, voice: voices.length ? voices[variant % voices.length] : null };
}

/** Play the type's sound effect. Returns true if there was one. */
export function playTypeSound(type) {
  const name = TYPE_SOUND[type];
  if (name) sfx[name]();
  return Boolean(name);
}

/**
 * The student says something out loud in their own voice, with their sound
 * effect first. Interrupts whatever anyone else was saying.
 * Resolves when finished speaking.
 */
export async function speakAs(student, text, { sound = true } = {}) {
  if (sound && playTypeSound(student.type)) await new Promise((r) => setTimeout(r, 450));
  const settings = await voiceSettings(student);
  return speak(text, { ...settings, interrupt: true });
}

/** Rough speaking time, for mouth/head animation. */
export function speechSeconds(text) {
  return Math.min(4, 0.5 + text.length * 0.07);
}
