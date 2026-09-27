import { createEmitter } from '../core/emitter.js';
import { loadSave, writeSave, requestPersistentStorage } from '../core/storage.js';
import { MAX_SEATS } from '../world/layout.js';
import { normalizeStudent } from './student.js';
import { exampleStudents } from './seeds.js';

export const MAX_STUDENTS = MAX_SEATS;

/**
 * The class list: loads from the device, saves on every change, and tells
 * listeners (the room, the class screen) when something changed.
 *
 * Events: 'change' { kind: 'add' | 'update' | 'remove', student }
 */
export function createRoster() {
  const events = createEmitter();
  const saved = loadSave();
  let data = saved ?? { students: exampleStudents(), settings: {} };
  data.students = (data.students ?? []).map(normalizeStudent).slice(0, MAX_STUDENTS);
  data.settings ??= {};
  let saveOk = true;
  if (!saved) save();
  requestPersistentStorage();

  function save() {
    saveOk = writeSave(data);
  }

  function change(kind, student) {
    save();
    events.emit('change', { kind, student });
  }

  return {
    on: events.on,
    /** Copy of the list in seating order. */
    get students() {
      return data.students.slice();
    },
    get count() {
      return data.students.length;
    },
    get isFull() {
      return data.students.length >= MAX_STUDENTS;
    },
    /** False if the last save failed (e.g. storage blocked). */
    get saveOk() {
      return saveOk;
    },
    get(id) {
      return data.students.find((s) => s.id === id) ?? null;
    },
    /** Is this name already used by someone else? (case-insensitive) */
    nameTaken(name, exceptId = null) {
      const n = name.trim().toLowerCase();
      return data.students.some((s) => s.id !== exceptId && s.name.trim().toLowerCase() === n);
    },
    /** Add a new student or replace an existing one with the same id. */
    put(student) {
      const clean = normalizeStudent(student);
      const i = data.students.findIndex((s) => s.id === clean.id);
      if (i >= 0) {
        data.students[i] = clean;
        change('update', clean);
      } else if (!this.isFull) {
        data.students.push(clean);
        change('add', clean);
      }
      return clean;
    },
    remove(id) {
      const student = this.get(id);
      if (!student) return;
      data.students = data.students.filter((s) => s.id !== id);
      change('remove', student);
    },
    /** Small key/value settings saved with the class. */
    getSetting(key, fallback = null) {
      return data.settings[key] ?? fallback;
    },
    setSetting(key, value) {
      data.settings[key] = value;
      save();
    },
  };
}
