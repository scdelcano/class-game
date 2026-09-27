/*
 * Math fact packs, one per grade. Each pack is a list of "families" in the
 * order they are usually taught; the game unlocks them one at a time as she
 * masters the earlier ones.
 *
 * A fact: { key, op, a, b, answer, family, requires? }
 *   key       stable id for progress tracking ("m:6x7" covers 6×7 and 7×6)
 *   requires  the fact that must be known first (division needs the matching
 *             multiplication, subtraction needs the matching addition)
 *
 * To add a grade: add an entry to PACK_DEFS below.
 */

const PACK_DEFS = {
  1: {
    title: 'Adding & subtracting within 10',
    standard: '1.OA.C.6',
    kind: 'add',
    order: [1, 0, 2, 3, 4, 5],
    max: 10, // biggest number used
    sumMax: 10,
  },
  2: {
    title: 'Adding & subtracting within 20',
    standard: '2.OA.B.2',
    kind: 'add',
    order: [1, 0, 2, 9, 3, 4, 5, 6, 7, 8],
    max: 9,
    sumMax: 18,
  },
  3: {
    title: 'Times tables & dividing within 100',
    standard: '3.OA.C.7',
    kind: 'mult',
    order: [2, 5, 10, 1, 3, 4, 9, 6, 7, 8, 0],
    max: 10,
  },
  4: {
    title: 'Times tables to 12 × 12',
    standard: null, // review of 3rd-grade facts, extended
    kind: 'mult',
    order: [2, 5, 10, 1, 3, 4, 9, 11, 6, 7, 8, 12, 0],
    max: 12,
  },
};

export const GRADES = Object.keys(PACK_DEFS).map(Number);

const cache = new Map();

/** The fact pack for a grade (built once). */
export function mathPack(grade) {
  const g = PACK_DEFS[grade] ? grade : 3;
  if (!cache.has(g)) cache.set(g, buildPack(g, PACK_DEFS[g]));
  return cache.get(g);
}

function buildPack(grade, def) {
  const facts = [];
  const seen = new Set();
  const families = def.order.map((n) => ({ id: n, label: def.kind === 'mult' ? `×${n}` : `+${n}`, keys: [] }));
  const add = (fact, family) => {
    if (seen.has(fact.key)) return;
    seen.add(fact.key);
    fact.family = family.id;
    facts.push(fact);
    family.keys.push(fact.key);
  };

  for (const family of families) {
    const n = family.id;
    if (def.kind === 'mult') {
      for (let k = n === 0 ? 0 : 1; k <= def.max; k++) {
        const [lo, hi] = [Math.min(n, k), Math.max(n, k)];
        const key = `m:${lo}x${hi}`;
        add({ key, op: '×', a: lo, b: hi, answer: lo * hi }, family);
        // matching division facts (c ÷ a = b), unlocked once the times fact is known
        if (lo > 0) {
          add({ key: `d:${lo * hi}/${lo}`, op: '÷', a: lo * hi, b: lo, answer: hi, requires: key, optional: true }, family);
          if (hi !== lo) add({ key: `d:${lo * hi}/${hi}`, op: '÷', a: lo * hi, b: hi, answer: lo, requires: key, optional: true }, family);
        }
      }
    } else {
      for (let k = n; k <= def.max; k++) {
        if (n + k > def.sumMax) break;
        const key = `a:${n}+${k}`;
        add({ key, op: '+', a: n, b: k, answer: n + k }, family);
        add({ key: `s:${n + k}-${n}`, op: '−', a: n + k, b: n, answer: k, requires: key, optional: true }, family);
        if (k !== n) add({ key: `s:${n + k}-${k}`, op: '−', a: n + k, b: k, answer: n, requires: key, optional: true }, family);
      }
    }
  }
  return { grade, ...def, facts, families, byKey: new Map(facts.map((f) => [f.key, f])) };
}

/** Is this a "second" operation (÷ or −) that needs its partner fact first? */
export const isInverse = (fact) => Boolean(fact.requires);

/**
 * How a fact is shown for one problem. × and + are shown either way round
 * (6 × 7 or 7 × 6) so both orders get practiced.
 */
export function present(fact) {
  let { a, b } = fact;
  if ((fact.op === '×' || fact.op === '+') && Math.random() < 0.5) [a, b] = [b, a];
  const text = `${a} ${fact.op} ${b}`;
  const words = { '×': 'times', '÷': 'divided by', '+': 'plus', '−': 'minus' }[fact.op];
  return { fact, a, b, text, spoken: `${a} ${words} ${b}`, answer: fact.answer };
}

/**
 * A believable wrong answer, like a real student would give:
 * off by one group, added instead of multiplied, off by one...
 */
export function wrongAnswer(problem) {
  const { a, b, answer } = problem;
  const op = problem.fact.op;
  let options;
  if (op === '×') options = [(a + 1) * b, (a - 1) * b, a * (b + 1), a * (b - 1), a + b, answer + 1, answer - 1];
  else if (op === '÷') options = [answer + 1, answer - 1, b, answer + 2];
  else if (op === '+') options = [answer + 1, answer - 1, answer + 2, Math.abs(a - b)];
  else options = [answer + 1, answer - 1, a + b, answer + 2];
  options = options.filter((n) => n >= 0 && n !== answer);
  return options[Math.floor(Math.random() * options.length)] ?? answer + 1;
}
