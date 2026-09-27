// Checks the reading engine: word packs, word chunks, believable mistakes,
// and checking her reading from speech recognizer guesses. Run with: npm test
import { readingPack, READING_GRADES, chunks, misread, misspell, cleanWordList } from '../src/learning/reading-words.js';
import { checkReading, sameSpelling } from '../src/learning/reading-check.js';
import { createMastery } from '../src/learning/mastery.js';

let failures = 0;
const check = (ok, label) => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};

console.log('— packs');
for (const g of READING_GRADES) {
  const p = readingPack(g);
  const words = p.facts.filter((f) => f.mode === 'read' && f.kind === 'word').length;
  const sentences = p.facts.filter((f) => f.kind === 'sentence').length;
  const spell = p.facts.filter((f) => f.mode === 'spell').length;
  check(words === spell && sentences > 0, `grade ${g}: ${words} words, ${spell} spelling, ${sentences} sentences (${p.standard})`);
}
const withList = readingPack(3, 'Because, friend  NEIGHBOR, because, x');
check(withList.families[0].id === 'this-week' && withList.families[0].keys.length === 6, 'weekly list becomes the first group (duplicates and junk dropped)');
check(cleanWordList('Hello, WORLD! don\'t').join(' ') === "hello world don't", 'word lists are cleaned up');

console.log('— chunks');
const chunkCases = {
  unhappy: 'un·hap·py', butterfly: 'but·ter·fly', elephant: 'e·le·phant', because: 'be·cause', happiness: 'hap·pi·ness',
  question: 'ques·tion', rewrite: 're·write', cake: 'cake', smiled: 'smiled', helpful: 'help·ful', dinosaur: 'di·no·saur',
};
for (const [w, want] of Object.entries(chunkCases)) check(chunks(w).join('·') === want, `${w} -> ${chunks(w).join('·')}`);

console.log('— mistakes');
const p3 = readingPack(3);
let okRead = true;
let okSpell = true;
for (const f of p3.facts) {
  for (let i = 0; i < 20; i++) {
    if (f.mode === 'read' && misread(f, p3) === f.text) okRead = false;
    if (f.mode === 'spell' && misspell(f.text) === f.text) okSpell = false;
  }
}
check(okRead, 'a misread is never the real word');
check(okSpell, 'a misspelling is never the real spelling');
console.log('     e.g.', ['sitting', 'cries', 'helpful', 'because', 'friend', 'action'].map((w) => `${w}→${misspell(w)}`).join(' '));

console.log('— checking her reading');
const word = (text) => ({ kind: 'word', text });
const alts = (...t) => t.map((text) => ({ text }));
const readCases = [
  [alts('unhappy'), 'unhappy', true], [alts('Unhappy.'), 'unhappy', true], [alts('happy'), 'unhappy', false],
  [alts('butter fly'), 'butterfly', true], [alts('write'), 'right', true], [alts('the dinosaurs'), 'dinosaur', true],
  [alts('careful'), 'careless', false], [alts('it says because'), 'because', true], [alts('cows'), 'because', false],
  [alts('prehead', 'preheat'), 'preheat', true],
];
for (const [a, w, want] of readCases) check(checkReading(a, word(w)).ok === want, `heard ${JSON.stringify(a.map((x) => x.text))} for "${w}" -> ${!want ? 'not ' : ''}ok`);
const sentence = { kind: 'sentence', text: 'The careful elephant crossed the bridge slowly.' };
check(checkReading(alts('the careful elephant crossed the bridge slowly'), sentence).ok, 'whole sentence read');
check(checkReading(alts('the careful elephant crossed the bridge'), sentence).ok, 'one word missed is still okay (86%)');
check(!checkReading(alts('the elephant bridge'), sentence).ok, 'most words missing is not okay');
check(sameSpelling('Because', 'because') && !sameSpelling('becuase', 'because'), 'spelling check ignores capitals');

console.log('— adapting');
const data = {};
const m = createMastery(data, readingPack(3), () => ({ chosen: 'auto', requireOk: true, pinned: [] }));
check(new Set(Array.from({ length: 30 }, () => m.pick().family)).size === 1, 'starts with one word group');
check(Array.from({ length: 30 }, () => m.pick()).every((f) => f.mode === 'read'), 'spelling waits until she can read the word');
for (let i = 0; i < 200; i++) { const f = m.pick(); m.record(f.key, true, { ms: 2000 }); }
check(Object.keys(data.stats).some((k) => k.startsWith('s:')), 'spelling appears once words are read well');
const dataW = {};
const pw = readingPack(3, 'because friend');
const mw = createMastery(dataW, pw, () => ({ chosen: 'auto', requireOk: true, pinned: ['this-week'] }));
const fams = new Set(Array.from({ length: 40 }, () => mw.pick().family));
check(fams.has('this-week') && fams.has('un-re'), 'weekly words mix in with the first group');
const weekModes = new Set(Array.from({ length: 80 }, () => mw.pick()).filter((f) => f.family === 'this-week').map((f) => f.mode));
check(weekModes.has('spell'), 'weekly words can be spelled right away');
const mOff = createMastery({}, pw, () => ({ chosen: 'auto', requireOk: false, pinned: ['this-week'] }));
check(Array.from({ length: 60 }, () => mOff.pick()).every((f) => f.mode === 'read'), 'no spelling at all when spelling is switched off');

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
