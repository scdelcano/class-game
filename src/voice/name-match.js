import { normalize, words, similarity } from './fuzzy.js';

/*
 * Finds which student the teacher said. Speech recognition often mishears
 * names ("Mia" -> "me a", "Bunbun" -> "bun bun", "Leo" -> "Leah"), so each
 * name is compared to every 1-3 word chunk of what was heard, using:
 *   - spelling similarity (edit distance)
 *   - sound-alike similarity (a simple phonetic code tuned for names)
 *   - first names and beginnings of names ("Mary" for "Mary Kate")
 * and every guess the recognizer made (not just the first).
 */

/** Score needed to accept a name without asking. */
export const CONFIDENT = 0.82;
/** Score needed to ask "Did you mean ___?". */
export const GUESS = 0.56;
/** How far ahead the best name must be of the next one to be sure. */
const MARGIN = 0.1;

/** Words that are never names (unless a student really is called that). */
const STOP_WORDS = new Set(`a an and are at be can come did do does for go good hello here hey hi how i
  if in is it its let lets me morning my name next no now of oh ok okay on please present say so
  teacher thank thanks that the then there this time to uh um up us we were what where who why yes
  you your whos wheres theres attendance class today`.split(/\s+/));

/**
 * Sound-alike code: similar-sounding spellings get the same code.
 * "Sophia" / "Sofia" -> SAFA, "Zuzu" / "zoo zoo" -> SASA, "Kate" / "Cait" -> KAT.
 */
export function phoneticKey(text) {
  // a silent final "e" (Kate, Jane, Mike) doesn't make a sound
  let w = normalize(text).split(' ').map((p) => (p.length > 3 ? p.replace(/([^aeiouy])e$/, '$1') : p)).join('');
  if (!w) return '';
  w = w
    .replace(/^kn|^gn|^pn/, 'n')
    .replace(/^wr/, 'r')
    .replace(/^ps/, 's')
    .replace(/^x/, 's')
    .replace(/^wh/, 'w')
    .replace(/tch/g, 'ch')
    .replace(/sch/g, 'sk')
    .replace(/ph/g, 'f')
    .replace(/gh(?=[aeiouy])/g, 'g')
    .replace(/gh/g, '')
    .replace(/ck/g, 'k')
    .replace(/qu/g, 'kw')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/dg(?=[eiy])/g, 'j')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/sh|ch/g, 'X')
    .replace(/th/g, 'T')
    .replace(/z/g, 's')
    .replace(/w(?![aeiouy])/g, '')
    .replace(/h(?![aeiouy])/g, '')
    .replace(/[aeiouy]+/g, 'A') // every vowel sound becomes one marker
    .replace(/(.)\1+/g, '$1'); // double letters sound single
  return w.toUpperCase();
}

/** How well a heard chunk matches a name, 0..1. Both already normalized. */
export function nameScore(heard, name) {
  const c = heard.replace(/ /g, '');
  const n = name.replace(/ /g, '');
  if (!c || !n) return 0;
  if (c === n) return 1;
  const spelling = similarity(c, n);
  const sound = similarity(phoneticKey(c), phoneticKey(n));
  let score = Math.max(spelling, 0.55 * sound + 0.45 * spelling);
  if (c.length >= 3 && n.startsWith(c)) score = Math.max(score, 0.72 + 0.2 * (c.length / n.length)); // "Bun" for "Bunbun"
  if (n.length >= 3 && c.startsWith(n) && c.length - n.length <= 2) score = Math.max(score, 0.9); // "Mias"
  if (Math.min(c.length, n.length) <= 2) score *= 0.75; // tiny words need near-exact matches
  return score;
}

/**
 * @param {{text: string}[]} alternatives recognizer guesses, best first
 * @param {{id: string, name: string}[]} students
 * @returns {{
 *   confident: object[],                       students clearly said, in the order said
 *   ranked: {student: object, score: number}[], everyone, best match first
 *   best: {student: object, score: number} | null
 * }}
 */
export function matchNames(alternatives, students) {
  const entries = students.map((student) => {
    const full = normalize(student.name);
    return { student, full, first: full.split(' ')[0], score: 0, span: null };
  });
  const nameWords = new Set(entries.flatMap((e) => e.full.split(' ')));

  alternatives.forEach((alt, rank) => {
    const heard = words(alt.text);
    for (let start = 0; start < heard.length; start++) {
      for (let len = 1; len <= 3 && start + len <= heard.length; len++) {
        const chunk = heard.slice(start, start + len);
        // single filler words are skipped; joined chunks are still tried ("me a" -> Mia)
        if (len === 1 && STOP_WORDS.has(chunk[0]) && !nameWords.has(chunk[0])) continue;
        const text = chunk.join(' ');
        for (const e of entries) {
          let s = nameScore(text, e.full);
          if (e.first !== e.full) s = Math.max(s, nameScore(text, e.first) * 0.97);
          s -= rank * 0.04; // later guesses are less likely
          if (s > e.score) {
            e.score = s;
            e.span = rank === 0 ? [start, start + len] : null;
          }
        }
      }
    }
  });

  const ranked = entries
    .map((e) => ({ student: e.student, score: Math.max(0, e.score), span: e.span }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0] && ranked[0].score >= GUESS ? ranked[0] : null;

  // Several names in one breath ("Mia, Leo and Teddy"): every clear match
  // from the first guess whose words don't overlap a better one.
  const confident = [];
  const used = [];
  for (const r of ranked) {
    if (r.score < CONFIDENT || !r.span) continue;
    if (used.some(([a, b]) => r.span[0] < b && a < r.span[1])) continue;
    const rival = ranked.find((o) => o !== r && o.span && o.span[0] === r.span[0] && o.span[1] === r.span[1]);
    if (rival && r.score - rival.score < MARGIN) continue; // two names sound the same: ask instead
    used.push(r.span);
    confident.push(r);
  }
  confident.sort((a, b) => a.span[0] - b.span[0]);

  // A lone best match from a later guess can still be confident.
  if (!confident.length && best && best.score >= CONFIDENT && (!ranked[1] || best.score - ranked[1].score >= MARGIN)) {
    confident.push(best);
  }

  return { confident: confident.map((r) => r.student), ranked, best };
}
