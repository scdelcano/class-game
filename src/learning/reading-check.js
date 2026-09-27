import { normalize, words, sameWord, similarity } from '../voice/fuzzy.js';
import { phoneticKey } from '../voice/name-match.js';

/*
 * Did the teacher read it right? Compares what the speech recognizer heard with the
 * word or sentence on the board. Recognizers turn sounds into real words,
 * so sound-alikes count ("write" for "right", "butter fly" for "butterfly").
 */

/** Common words that sound alike; recognizers often write the other one. */
const HOMOPHONES = [
  'right write', 'read red reed', 'there their theyre', 'to too two', 'for four', 'one won', 'eight ate',
  'son sun', 'see sea', 'hear here', 'know no', 'knew new', 'night knight', 'blue blew', 'flower flour',
  'whole hole', 'wait weight', 'tail tale', 'pair pear', 'meet meat', 'week weak', 'by buy bye', 'dear deer',
  'heard herd', 'mail male', 'plain plane', 'road rode', 'hi high', 'our hour', 'through threw', 'its its',
  'made maid', 'sale sail', 'stair stare', 'bear bare', 'break brake', 'cent sent scent', 'ducked duct',
].map((line) => line.split(' '));
const homophoneOf = new Map(HOMOPHONES.flatMap((group) => group.map((w) => [w, group])));

/** Words that sound the same as another spelling. */
function soundsSame(a, b) {
  if (a === b) return true;
  if (homophoneOf.get(a)?.includes(b)) return true;
  const ka = phoneticKey(a);
  return ka.length >= 2 && ka === phoneticKey(b) && similarity(a, b) >= 0.5;
}

/** Did any guess contain this single word? */
function heardWord(alternatives, target) {
  const t = normalize(target).replace(/[^a-z]/g, '');
  for (const alt of alternatives) {
    const w = words(alt.text);
    const joined = w.join('');
    if (joined === t) return true; // "butter fly"
    for (let i = 0; i < w.length; i++) {
      if (w[i] === t || soundsSame(w[i], t)) return true;
      if (i + 1 < w.length && w[i] + w[i + 1] === t) return true;
    }
    // very close spellings of long words ("dinosaurs" for "dinosaur")
    if (t.length >= 6 && w.some((x) => similarity(x, t) >= 0.85)) return true;
  }
  return false;
}

/** Share of the sentence's words that were heard, in any guess. */
function sentenceCoverage(alternatives, sentence) {
  const target = words(sentence);
  let best = 0;
  for (const alt of alternatives) {
    const heard = words(alt.text);
    const used = new Set();
    let hit = 0;
    for (const tw of target) {
      const i = heard.findIndex((hw, k) => !used.has(k) && (hw === tw || sameWord(hw, tw) || soundsSame(hw, tw)));
      if (i >= 0) {
        used.add(i);
        hit += 1;
      }
    }
    best = Math.max(best, hit / target.length);
  }
  return best;
}

/**
 * @param {{text: string}[]} alternatives what the recognizer heard
 * @param {{kind: 'word' | 'sentence', text: string}} item
 * @returns {{ok: boolean, coverage: number}}
 */
export function checkReading(alternatives, item) {
  if (item.kind === 'sentence') {
    const coverage = sentenceCoverage(alternatives, item.text);
    return { ok: coverage >= 0.8, coverage };
  }
  const ok = heardWord(alternatives, item.text);
  return { ok, coverage: ok ? 1 : 0 };
}

/** Spelling check: letters only, any capitals. */
export function sameSpelling(typed, word) {
  const clean = (x) => String(x).toLowerCase().replace(/[^a-z'-]/g, '');
  return clean(typed) === clean(word);
}
