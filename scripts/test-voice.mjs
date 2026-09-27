// Checks that spoken commands and student names are understood, including
// the kinds of mistakes speech recognition makes. Run with: npm test
import { matchCommand } from '../src/voice/commands.js';
import { matchNames } from '../src/voice/name-match.js';

let failures = 0;
const check = (ok, label) => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};

console.log('— commands');
const commands = [
  ['Okay class, time to take attendance!', 'attendance'],
  ['okay class sit down', 'startClass'],
  ['Okay class, sit down please', 'startClass'],
  ['class is starting', 'startClass'],
  ["it's class time", 'startClass'],
  ['good morning class', 'startClass'],
  ['Class dismissed!', 'endClass'],
  ['class dismised', 'endClass'], // misheard
  ['time for recess', 'endClass'],
  ['Shhhh', 'quiet'],
  ['everybody be quiet', 'quiet'],
  ['roll call', 'attendance'],
  ['Time for math!', 'lesson'],
  ["Okay class, let's do math", 'lesson'],
  ['times tables', 'lesson'],
  ['Okay class, reading time!', 'reading'],
  ["let's read", 'reading'],
  ['spelling test', 'reading'],
  ['I like pizza', null],
  ['Mia', null],
];
for (const [text, want] of commands) {
  const got = matchCommand([{ text }])?.id ?? null;
  check(got === want, `"${text}" -> ${got}`);
}
check(matchCommand([{ text: 'okay glass sit town' }, { text: 'okay class sit down' }])?.id === 'startClass', 'second guess from the recognizer is used');

console.log('— names');
const names = ['Mia', 'Leo', 'Teddy', 'Bunbun', 'Rumble', 'Sprout', 'Zuzu', 'Mary Kate', 'Sophia', 'Sofia', 'Aiden', 'Jayden', 'Max'];
const students = names.map((name, i) => ({ id: String(i), name }));
// want: "A,B" = sure about these, "?A" = should ask "Did you mean A?", "" = no match
const cases = [
  [['Mia'], 'Mia'], [['is Mia here'], 'Mia'], [['me a'], 'Mia'], [['Mia and Leo'], 'Mia,Leo'],
  [['Leah'], '?Leo'], [['Teddy'], 'Teddy'], [['ready'], '?Teddy'], [['bun bun'], 'Bunbun'],
  [['bunny'], '?Bunbun'], [['Rumble'], 'Rumble'], [['sprite'], '?Sprout'], [['zoo zoo'], '?Zuzu'],
  [['Mary'], 'Mary Kate'], [['Mary Kate'], 'Mary Kate'], [['Sophia'], 'Sophia'], [['Aiden'], 'Aiden'],
  [['Jayden'], 'Jayden'], [['pizza'], ''], [['here'], ''], [['okay class'], ''], [['max'], 'Max'],
  [['Mia is here'], 'Mia'], [['leo leo'], 'Leo'], [['Teddy bear'], 'Teddy'], [['I am ready', 'Teddy'], 'Teddy'],
];
for (const [texts, want] of cases) {
  const r = matchNames(texts.map((text) => ({ text })), students);
  let ok;
  if (want.startsWith('?')) ok = r.confident.length === 0 && r.best?.student.name === want.slice(1);
  else if (want === '') ok = r.confident.length === 0 && !r.best;
  else ok = r.confident.map((s) => s.name).join(',') === want;
  const got = r.confident.length ? r.confident.map((s) => s.name).join(',') : r.best ? `?${r.best.student.name}` : '(none)';
  check(ok, `${JSON.stringify(texts)} -> ${got}`);
}

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
