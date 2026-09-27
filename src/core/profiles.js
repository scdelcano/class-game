import { ensureProfiles, saveProfiles, loadSave, writeSave, removeSave, saveKeyFor, newProfileId } from './storage.js';
import { exampleStudents } from '../students/seeds.js';
import { DEFAULT_SETTINGS } from '../learning/store.js';

export const MAX_PROFILE_NAME = 12;

/** Emoji a player can pick for their button on the "Who's teaching?" screen. */
export const PROFILE_EMOJI = ['🍎', '🦊', '🐼', '🦄', '🐸', '🐯', '🐙', '🦖', '🐝', '🐧', '🌈', '🚀', '⭐', '🌻', '⚽', '🎨'];

/**
 * The players on this tablet. Each one has their own classroom:
 * students, grade, learning progress, stars and attendance.
 *
 * A profile is { id, name, emoji, createdAt }; its game is saved under
 * saveKeyFor(id) by the roster.
 */
export function createProfiles() {
  const index = ensureProfiles();
  let saveOk = true;

  const save = () => {
    saveOk = saveProfiles(index);
    return saveOk;
  };
  const find = (id) => index.profiles.find((p) => p.id === id) ?? null;

  return {
    /** Copy of the list, in the order they were added. */
    get list() {
      return index.profiles.slice();
    },
    get count() {
      return index.profiles.length;
    },
    /** False if the last save of the list failed. */
    get saveOk() {
      return saveOk;
    },
    get lastId() {
      return find(index.lastId) ? index.lastId : index.profiles[0].id;
    },
    get(id) {
      return find(id);
    },
    setLast(id) {
      if (!find(id) || index.lastId === id) return;
      index.lastId = id;
      save();
    },
    /** The grade saved in this player's game. */
    gradeOf(id) {
      return loadSave(saveKeyFor(id))?.settings?.learning?.settings?.grade ?? DEFAULT_SETTINGS.grade;
    },
    /** Is this name already used by another player? (case-insensitive) */
    nameTaken(name, exceptId = null) {
      const n = cleanName(name).toLowerCase();
      return index.profiles.some((p) => p.id !== exceptId && p.name.toLowerCase() === n);
    },
    /** Adds a player with a fresh example class at the chosen grade. */
    add({ name, emoji, grade = DEFAULT_SETTINGS.grade }) {
      const profile = { id: newProfileId(), name: cleanName(name) || 'Teacher', emoji: emoji || PROFILE_EMOJI[0], createdAt: Date.now() };
      writeSave(saveKeyFor(profile.id), {
        students: exampleStudents(),
        settings: { learning: { settings: { ...DEFAULT_SETTINGS, grade } } },
      });
      index.profiles.push(profile);
      save();
      return profile;
    },
    /** Change a player's name or emoji. */
    update(id, { name, emoji }) {
      const p = find(id);
      if (!p) return null;
      if (name !== undefined && cleanName(name)) p.name = cleanName(name);
      if (emoji) p.emoji = emoji;
      save();
      return p;
    },
    /** Removes a player and erases their classroom. The last player can't be removed. */
    remove(id) {
      if (index.profiles.length <= 1 || !find(id)) return false;
      index.profiles = index.profiles.filter((p) => p.id !== id);
      if (index.lastId === id) index.lastId = index.profiles[0].id;
      save();
      removeSave(saveKeyFor(id));
      return true;
    },
  };
}

function cleanName(name) {
  return String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_PROFILE_NAME);
}
