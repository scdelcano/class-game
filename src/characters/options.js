/*
 * Everything a student can look like. The "make a student" screen is built
 * from these lists, so adding a new hairstyle or color is a one-line change
 * here plus the drawing code in the character's builder.
 */

export const TYPES = [
  { id: 'kid', label: 'Kid' },
  { id: 'plush', label: 'Stuffed animal' },
  { id: 'truck', label: 'Monster truck' },
  { id: 'tank', label: 'Tank' },
];

export const SKIN_TONES = ['#ffe0c7', '#f7c9a3', '#e8b08a', '#c98e62', '#a86f45', '#74482b'];

export const HAIR_STYLES = [
  { id: 'short', label: 'Short' },
  { id: 'long', label: 'Long' },
  { id: 'pigtails', label: 'Pigtails' },
  { id: 'bun', label: 'Bun' },
  { id: 'curly', label: 'Curly' },
  { id: 'spiky', label: 'Spiky' },
];

export const HAIR_COLORS = ['#2b2230', '#6b4226', '#b5773c', '#f2c85b', '#d9622b', '#ff8fc0', '#5aa9ff', '#9b7bff'];

export const CLOTHES_COLORS = ['#f0505a', '#ff9f43', '#ffd84d', '#6cc46a', '#3cc6c0', '#4aa8ff', '#9b7bff', '#ff7fb0', '#ffffff', '#5a5170'];

export const ANIMALS = [
  { id: 'bear', label: 'Teddy bear' },
  { id: 'bunny', label: 'Bunny' },
  { id: 'cat', label: 'Kitty' },
  { id: 'puppy', label: 'Puppy' },
];

export const PLUSH_COLORS = ['#c8905a', '#f4e1c1', '#ffffff', '#b0a8a8', '#ffb6c9', '#bfa7ff', '#9fd8ff', '#b8e986', '#ffd98a'];

export const VEHICLE_COLORS = ['#f0505a', '#ff9f43', '#ffd84d', '#6cc46a', '#2e9e5b', '#3cc6c0', '#4aa8ff', '#9b7bff', '#ff7fb0', '#5a5170'];

/** How a student sounds: a tone (pitch shift) plus which device voice to use. */
export const TONES = [
  { id: 'high', label: 'High', icon: '🐭' },
  { id: 'medium', label: 'Middle', icon: '🙂' },
  { id: 'low', label: 'Low', icon: '🐻' },
];

export const PRONOUNS = [
  { id: 'she', label: 'she' },
  { id: 'he', label: 'he' },
  { id: 'they', label: 'they' },
];

/** A nice default look for each type (also used for the type picker pictures). */
export const DEFAULT_LOOKS = {
  kid: { skin: SKIN_TONES[1], hair: 'short', hairColor: HAIR_COLORS[1], shirt: CLOTHES_COLORS[5], glasses: false },
  plush: { animal: 'bear', color: PLUSH_COLORS[0] },
  truck: { color: VEHICLE_COLORS[0] },
  tank: { color: VEHICLE_COLORS[3] },
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** A random look, so every new student starts out different. */
export function randomLook(type) {
  switch (type) {
    case 'kid':
      return {
        skin: pick(SKIN_TONES),
        hair: pick(HAIR_STYLES).id,
        hairColor: pick(HAIR_COLORS.slice(0, 5)),
        shirt: pick(CLOTHES_COLORS),
        glasses: Math.random() < 0.25,
      };
    case 'plush':
      return { animal: pick(ANIMALS).id, color: pick(PLUSH_COLORS) };
    default:
      return { color: pick(VEHICLE_COLORS) };
  }
}

/** Fill in anything missing or invalid (e.g. from old saved data). */
export function normalizeLook(type, look = {}) {
  const base = DEFAULT_LOOKS[type];
  const out = { ...base };
  for (const k of Object.keys(base)) if (look[k] !== undefined) out[k] = look[k];
  if (type === 'kid') {
    if (!HAIR_STYLES.some((h) => h.id === out.hair)) out.hair = base.hair;
    out.glasses = Boolean(out.glasses);
  }
  if (type === 'plush' && !ANIMALS.some((a) => a.id === out.animal)) out.animal = base.animal;
  return out;
}

/** Stable text key for a look (used to cache portraits). */
export function lookKey(type, look) {
  return `${type}:${JSON.stringify(look)}`;
}
