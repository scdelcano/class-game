/*
 * Forgiving text matching for speech recognition, which often mishears
 * words slightly. Step 5 adds sound-alike (phonetic) matching for names.
 */

/** Lowercase, no accents or punctuation, single spaces. "Shhhh!" -> "shh". */
export function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bs+h+\b/g, 'shh')
    .replace(/\s+/g, ' ')
    .trim();
}

export function words(text) {
  const n = normalize(text);
  return n ? n.split(' ') : [];
}

/** Number of single-letter edits to turn a into b. */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 0..1, where 1 means identical. */
export function similarity(a, b) {
  const len = Math.max(a.length, b.length);
  return len ? 1 - levenshtein(a, b) / len : 1;
}

/** Same word, allowing a small typo in longer words ("dismised" = "dismissed"). */
export function sameWord(a, b) {
  if (a === b) return true;
  const len = Math.max(a.length, b.length);
  if (len < 4) return false;
  return levenshtein(a, b) <= (len >= 7 ? 2 : 1);
}

/** Does `phraseWords` appear in order, side by side, inside `heardWords`? */
export function containsPhrase(heardWords, phraseWords) {
  outer: for (let i = 0; i + phraseWords.length <= heardWords.length; i++) {
    for (let j = 0; j < phraseWords.length; j++) {
      if (!sameWord(heardWords[i + j], phraseWords[j])) continue outer;
    }
    return true;
  }
  return false;
}
