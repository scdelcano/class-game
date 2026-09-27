import { TYPES, TONES, PRONOUNS, normalizeLook, randomLook } from '../characters/options.js';

export const MAX_NAME_LENGTH = 12;

/**
 * A student record (what gets saved):
 * {
 *   id:      'st_k3j2…'
 *   name:    'Mia'
 *   type:    'kid' | 'plush' | 'truck' | 'tank'
 *   look:    type-specific (see characters/options.js)
 *   voice:   { tone: 'high' | 'medium' | 'low', variant: 0.. }   variant picks a device voice
 *   pronoun: 'she' | 'he' | 'they'   (used when classmates talk about them)
 *   example: true for the starter students
 * }
 */
export function newStudent(type = 'kid') {
  return {
    id: newId(),
    name: '',
    type,
    look: randomLook(type),
    voice: { tone: 'medium', variant: Math.floor(Math.random() * 3) },
    pronoun: 'they',
    example: false,
  };
}

/** Make any stored/edited record safe to use (fills gaps, fixes bad values). */
export function normalizeStudent(raw) {
  const type = TYPES.some((t) => t.id === raw?.type) ? raw.type : 'kid';
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : newId(),
    name: cleanName(raw?.name ?? '').trim(),
    type,
    look: normalizeLook(type, raw?.look),
    voice: {
      tone: TONES.some((t) => t.id === raw?.voice?.tone) ? raw.voice.tone : 'medium',
      variant: Number.isInteger(raw?.voice?.variant) ? raw.voice.variant : 0,
    },
    pronoun: PRONOUNS.some((p) => p.id === raw?.pronoun) ? raw.pronoun : 'they',
    example: Boolean(raw?.example),
  };
}

/** Collapse spaces, drop leading spaces, cap the length (trailing space kept while typing). */
export function cleanName(name) {
  return String(name).replace(/\s+/g, ' ').trimStart().slice(0, MAX_NAME_LENGTH);
}

function newId() {
  return `st_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
