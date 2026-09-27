// Checks the math learning engine: fact packs, spoken numbers, verdicts,
// and that practice adapts (unlocks, spacing). Run with: npm test
import { mathPack, GRADES, present, wrongAnswer } from '../src/learning/math-facts.js';
import { numbersIn, spokenAnswer, verdictIn } from '../src/learning/numbers.js';
import { createMastery } from '../src/learning/mastery.js';

let failures = 0;
const check = (ok, label) => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};

console.log('— fact packs');
for (const g of GRADES) {
  const p = mathPack(g);
  const base = p.facts.filter((f) => !f.requires).length;
  const inv = p.facts.length - base;
  check(p.facts.every((f) => Number.isInteger(f.answer) && f.answer >= 0), `grade ${g}: ${base} facts + ${inv} related (${p.title})`);
}
const g3 = mathPack(3);
check(g3.byKey.get('m:6x7').answer === 42 && g3.byKey.get('d:42/6').answer === 7, '6×7=42 and 42÷6=7');
check(g3.facts.filter((f) => !f.requires).length === 55 + 11, 'grade 3 has every times fact from 0 to 10 once');
check(g3.families[0].id === 2 && g3.byKey.get('m:2x6').family === 2, '×2 comes first and owns 2×6');
let wrongOk = true;
for (let i = 0; i < 500; i++) {
  const pr = present(g3.facts[i % g3.facts.length]);
  const w = wrongAnswer(pr);
  if (w === pr.answer || w < 0) wrongOk = false;
}
check(wrongOk, 'wrong answers are never the right answer or negative');

console.log('— spoken numbers');
const nums = [
  ['42', 42], ['forty two', 42], ['forty-two', 42], ['six times seven is forty two', 42], ['a hundred', 100],
  ['one hundred and five', 105], ['zero', 0], ['to', 2], ['ate', 8], ['the answer is 56', 56], ['twelve', 12],
  ['sixty', 60], ['I think 7', 7], ['banana', null],
];
for (const [t, want] of nums) check(spokenAnswer(t) === want, `"${t}" -> ${spokenAnswer(t)}`);
check(JSON.stringify(numbersIn('six times seven')) === '[6,7]', 'separate numbers stay separate');

console.log('— verdicts');
const verdicts = [['Correct!', 'right'], ['yes', 'right'], ['good job Mia', 'right'], ["that's right", 'right'],
  ['not quite', 'wrong'], ['no', 'wrong'], ['try again', 'wrong'], ["that's not right", 'wrong'], ['wrong', 'wrong'], ['banana', null]];
for (const [t, want] of verdicts) check(verdictIn(t) === want, `"${t}" -> ${verdictIn(t)}`);

console.log('— adapting');
const data = {};
const m = createMastery(data, mathPack(3), () => ({ chosen: 'auto', requireOk: true }));
const firstFacts = new Set(Array.from({ length: 30 }, () => m.pick().family));
check(firstFacts.size === 1 && firstFacts.has(2), 'starts with only the ×2 table');
// a learner who always gets it right, fast
let opened = [];
for (let i = 0; i < 400; i++) {
  const f = m.pick();
  const { unlocked } = m.record(f.key, true, { ms: 2000 });
  if (unlocked) opened.push(unlocked.label);
}
check(opened.slice(0, 3).join(' ') === '×5 ×10 ×1', `tables open in teaching order: ${opened.join(' ')}`);
check(Object.keys(data.stats).some((k) => k.startsWith('d:')), 'division appears once times facts are known');
// a missed fact comes back soon
const d2 = {};
const m2 = createMastery(d2, mathPack(3), () => ({ chosen: [7], requireOk: false }));
const target = m2.pick();
m2.record(target.key, false, { ms: 9000 });
const soon = Array.from({ length: 4 }, () => { const f = m2.pick(); m2.record(f.key, true, { ms: 2000 }); return f.key; });
check(soon.includes(target.key), `missed fact ${target.key} comes back within 4 problems`);
check(Array.from({ length: 40 }, () => m2.pick()).every((f) => f.family === 7), 'grown-up table choice (×7 only) is respected');
check(m2.level(target.key) === 'learning' || m2.level(target.key) === 'almost', `levels work (${m2.level(target.key)})`);

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
