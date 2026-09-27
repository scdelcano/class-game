// Checks profiles (more than one player on a tablet): upgrading the old single
// save, adding and removing players, and that saves stay separate.
// Run with: npm test
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { createProfiles } = await import('../src/core/profiles.js');
const { saveKeyFor, loadSave } = await import('../src/core/storage.js');
const { createRoster } = await import('../src/students/roster.js');

let failures = 0;
const check = (ok, label) => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};

console.log('— upgrading an old save');
const oldSave = {
  version: 1,
  students: [{ id: 'st_1', name: 'Zed', type: 'kid' }],
  settings: { learning: { settings: { grade: 2 }, stars: { st_1: 4 } }, day: { date: '2026-09-26' } },
};
store.set('my-classroom', JSON.stringify(oldSave));
let profiles = createProfiles();
check(profiles.count === 1, 'one player is made from the old save');
const first = profiles.list[0];
const migrated = loadSave(saveKeyFor(first.id));
check(migrated?.students?.[0]?.name === 'Zed', 'the old students move over');
check(migrated?.settings?.learning?.stars?.st_1 === 4 && profiles.gradeOf(first.id) === 2, 'stars and grade move over');
check(store.has('my-classroom'), 'the old save is kept as a backup');
check(createProfiles().list[0].id === first.id, 'upgrading happens only once');

console.log('— a new install');
store.clear();
profiles = createProfiles();
check(profiles.count === 1 && profiles.list[0].name === 'Teacher', 'one player to start');
const roster = createRoster({ saveKey: saveKeyFor(profiles.list[0].id) });
check(roster.count === 6 && roster.students[0].example, 'the example class is there');

console.log('— adding and removing');
const ava = profiles.add({ name: '  Ava ', emoji: '🦊', grade: 1 });
check(ava.name === 'Ava' && profiles.count === 2, 'a player is added (name trimmed)');
check(profiles.gradeOf(ava.id) === 1, 'the new player starts at their grade');
check(profiles.nameTaken('ava') && !profiles.nameTaken('ava', ava.id), 'names are unique, ignoring case');
const avaRoster = createRoster({ saveKey: saveKeyFor(ava.id) });
check(avaRoster.count === 6, 'the new player gets the example class');

console.log('— saves stay separate');
avaRoster.remove(avaRoster.students[0].id);
avaRoster.setSetting('learning', { settings: { grade: 1 }, stars: { x: 9 } });
const again = createRoster({ saveKey: saveKeyFor(profiles.list[0].id) });
check(again.count === 6 && !again.getSetting('learning')?.stars, "one player's changes don't touch the other");
check(createRoster({ saveKey: saveKeyFor(ava.id) }).count === 5, "the player's own changes are saved");

console.log('— removing');
profiles.setLast(ava.id);
check(createProfiles().lastId === ava.id, 'the last player to play is remembered');
check(profiles.remove(ava.id) && !store.has(saveKeyFor(ava.id)), "removing a player erases their classroom");
check(profiles.lastId !== ava.id, 'the last-played player moves to someone still here');
check(!profiles.remove(profiles.list[0].id) && profiles.count === 1, 'the last player cannot be removed');

console.log(failures ? `\n${failures} failed` : '\nall good');
process.exit(failures ? 1 : 0);
