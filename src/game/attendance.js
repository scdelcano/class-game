import { createEmitter } from '../core/emitter.js';
import { sfx } from '../audio/sfx.js';

/**
 * Attendance and the "school day".
 *
 * Each day 0-2 random students are absent (not in the room). The day, who
 * is absent and every checkmark are saved, so closing the app keeps them.
 * A new day starts automatically on a new calendar date, or with "New day".
 *
 * Calling a student (tap or voice):
 *   in the room  -> they pop up, answer "Here!", their box gets a ✓
 *   absent today -> a pause, then a classmate says "She's sick today!";
 *                   tapping again (or "Mark absent") marks them absent
 *   already marked + tap -> un-marks them (nothing is permanent)
 *
 * Events: 'change' (anything on the sheet changed), 'done' (everyone marked),
 *         'newDay'
 */
export function createAttendance({ roster, students }) {
  const events = createEmitter();
  /** Things happening right now that aren't saved: id -> 'calling' | 'note' */
  const notes = new Map();
  let day = loadDay();
  let busy = new Set(); // students answering right now (ignore double taps)

  students.setAbsent(new Set(day.absent));

  function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function loadDay() {
    const saved = roster.getSetting('day');
    if (saved && saved.date === todayString()) return tidy(saved);
    const fresh = makeDay((saved?.number ?? 0) + 1);
    roster.setSetting('day', fresh);
    return fresh;
  }

  /** A new day: pick who's absent (0, 1 or 2 students, never most of the class). */
  function makeDay(number) {
    const ids = roster.students.map((s) => s.id);
    let count = 0;
    if (ids.length >= 3) {
      const r = Math.random();
      count = r < 0.3 ? 0 : r < 0.75 ? 1 : 2;
      count = Math.min(count, ids.length - 2);
    }
    const shuffled = ids.sort(() => Math.random() - 0.5);
    return { date: todayString(), number, absent: shuffled.slice(0, count), marks: {} };
  }

  /** Drop students that were removed from the class. */
  function tidy(d) {
    const ids = new Set(roster.students.map((s) => s.id));
    return {
      date: d.date,
      number: d.number ?? 1,
      absent: (d.absent ?? []).filter((id) => ids.has(id)),
      marks: Object.fromEntries(Object.entries(d.marks ?? {}).filter(([id, m]) => ids.has(id) && (m === 'present' || m === 'absent'))),
    };
  }

  function save() {
    roster.setSetting('day', day);
    events.emit('change');
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /** 'none' | 'calling' | 'note' | 'present' | 'absent' */
  function status(id) {
    return day.marks[id] ?? notes.get(id) ?? 'none';
  }

  function counts() {
    const list = roster.students;
    const here = list.filter((s) => day.marks[s.id] === 'present').length;
    const absent = list.filter((s) => day.marks[s.id] === 'absent').length;
    return { here, absent, marked: here + absent, total: list.length };
  }

  function checkDone() {
    const c = counts();
    if (c.total && c.marked === c.total) {
      setTimeout(() => {
        sfx.fanfare();
        students.cheer();
        events.emit('done', counts());
      }, 900);
    }
  }

  function markAbsent(student) {
    notes.delete(student.id);
    day.marks[student.id] = 'absent';
    sfx.pop();
    save();
    checkDone();
  }

  /**
   * The teacher calls a student.
   * @param {{via?: 'tap' | 'voice'}} [opts] taps can un-mark; voice never un-marks
   */
  async function call(student, { via = 'tap' } = {}) {
    const id = student.id;
    if (busy.has(id)) return;
    const mark = day.marks[id];
    const note = notes.get(id);

    if (via === 'tap' && mark) {
      // tapping a marked name clears it again
      delete day.marks[id];
      sfx.uncheck();
      save();
      return;
    }
    if (note === 'calling') return;
    if (note === 'note') {
      markAbsent(student); // they already heard the classmate explain
      return;
    }

    if (day.absent.includes(id)) {
      if (mark === 'absent') return;
      notes.set(id, 'calling');
      events.emit('change');
      await wait(1600); // ...silence...
      if (notes.get(id) !== 'calling') return;
      notes.set(id, 'note');
      students.explainAbsent(student);
      events.emit('change');
      return;
    }

    busy.add(id);
    if (mark === 'present') {
      await students.answer(student, { again: true });
      busy.delete(id);
      return;
    }
    notes.set(id, 'calling');
    events.emit('change');
    const answered = students.answer(student);
    await wait(700);
    notes.delete(id);
    day.marks[id] = 'present';
    sfx.chime();
    save();
    checkDone();
    await answered;
    busy.delete(id);
  }

  function newDay() {
    notes.clear();
    busy = new Set();
    day = makeDay(day.number + 1);
    students.setAbsent(new Set(day.absent), { animate: true });
    save();
    events.emit('newDay');
  }

  // keep the sheet in step with the class list
  roster.on('change', () => {
    day = tidy(day);
    for (const id of notes.keys()) if (!roster.get(id)) notes.delete(id);
    roster.setSetting('day', day);
    events.emit('change');
  });

  return {
    on: events.on,
    call,
    markAbsent,
    status,
    counts,
    newDay,
    get dayNumber() {
      return day.number;
    },
    /** First student not marked yet (for hints like: Try saying "Mia"). */
    nextUnmarked() {
      return roster.students.find((s) => status(s.id) === 'none') ?? null;
    },
  };
}
