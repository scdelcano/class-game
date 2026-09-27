import { normalizeStudent } from './student.js';

/** The example class shown on first launch (all editable/removable). */
const EXAMPLES = [
  { name: 'Mia', type: 'kid', pronoun: 'she', voice: { tone: 'high', variant: 0 },
    look: { skin: '#f7c9a3', hair: 'pigtails', hairColor: '#6b4226', shirt: '#ff7fb0', glasses: false } },
  { name: 'Leo', type: 'kid', pronoun: 'he', voice: { tone: 'medium', variant: 1 },
    look: { skin: '#a86f45', hair: 'curly', hairColor: '#2b2230', shirt: '#4aa8ff', glasses: true } },
  { name: 'Teddy', type: 'plush', pronoun: 'he', voice: { tone: 'medium', variant: 0 },
    look: { animal: 'bear', color: '#c8905a' } },
  { name: 'Bunbun', type: 'plush', pronoun: 'she', voice: { tone: 'high', variant: 2 },
    look: { animal: 'bunny', color: '#ffb6c9' } },
  { name: 'Rumble', type: 'truck', pronoun: 'he', voice: { tone: 'low', variant: 0 },
    look: { color: '#f0505a' } },
  { name: 'Sprout', type: 'tank', pronoun: 'she', voice: { tone: 'medium', variant: 1 },
    look: { color: '#6cc46a' } },
];

export function exampleStudents() {
  return EXAMPLES.map((s, i) => normalizeStudent({ ...s, id: `example_${i + 1}`, example: true }));
}
