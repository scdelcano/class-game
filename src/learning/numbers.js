import { normalize, words } from '../voice/fuzzy.js';

/*
 * Understanding spoken answers: numbers ("forty two", "42", "a hundred")
 * and the teacher's verdict ("Correct!", "Not quite").
 */

const ONES = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
/** Words the recognizer writes when a kid says just a number on its own. */
const SOUND_ALIKES = { to: 2, too: 2, for: 4, fore: 4, ate: 8, won: 1, tree: 3, free: 3, sicks: 6, nein: 9 };

/** All numbers in the text, in order. "six times seven is forty two" -> [6, 7, 42] */
export function numbersIn(text) {
  const tokens = words(text);
  if (tokens.length === 1 && SOUND_ALIKES[tokens[0]] !== undefined) return [SOUND_ALIKES[tokens[0]]];
  const found = [];
  let current = null;
  const flush = () => {
    if (current !== null) found.push(current);
    current = null;
  };
  for (const t of tokens) {
    if (/^\d+$/.test(t)) {
      flush();
      found.push(Number(t));
    } else if (t in ONES) {
      if (current !== null && current % 10 === 0 && current % 100 !== 0 && ONES[t] < 10) current += ONES[t]; // forty + two
      else if (current !== null && current % 100 === 0 && current > 0) current += ONES[t]; // hundred + five
      else {
        flush();
        current = ONES[t];
      }
    } else if (t in TENS) {
      if (current !== null && current % 100 === 0 && current > 0) current += TENS[t];
      else {
        flush();
        current = TENS[t];
      }
    } else if (t === 'hundred') {
      current = (current ?? 1) * 100;
    } else if (t === 'a' || t === 'and') {
      // "a hundred", "one hundred and five": keep going
    } else {
      flush();
    }
  }
  flush();
  return found;
}

/** The answer in what was said (the last number: "six times seven is 42" -> 42). */
export function spokenAnswer(text) {
  const all = numbersIn(text);
  return all.length ? all[all.length - 1] : null;
}

const WRONG = ['not right', 'not quite', 'not correct', 'thats wrong', 'wrong', 'incorrect', 'no', 'nope', 'try again', 'oops', 'uh oh', 'not really', 'thats not it'];
const RIGHT = ['right', 'correct', 'yes', 'yeah', 'yep', 'good job', 'great job', 'perfect', 'exactly', 'thats it', 'you got it', 'well done', 'awesome', 'good', 'nice', 'true'];

/**
 * 'right' | 'wrong' | null from something like "Yes, that's correct!".
 * Exact words only: fuzzy matching would confuse "correct" and "incorrect".
 */
export function verdictIn(text) {
  const heard = ` ${normalize(text)} `;
  if (WRONG.some((p) => heard.includes(` ${p} `))) return 'wrong';
  if (RIGHT.some((p) => heard.includes(` ${p} `))) return 'right';
  return null;
}
