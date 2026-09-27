/**
 * Saves the game on this device (localStorage). Nothing is ever sent anywhere.
 *
 * Each player (profile) has their own save under `my-classroom:<id>`, and a
 * small index under `my-classroom-profiles` lists the players. Saves carry a
 * version number so later updates can upgrade old saves.
 */
const OLD_KEY = 'my-classroom'; // the single save from before profiles (kept as a backup for now)
const PROFILES_KEY = 'my-classroom-profiles';
export const SAVE_VERSION = 1;
export const PROFILES_VERSION = 1;

/** The save key for one player. */
export function saveKeyFor(id) {
  return `${OLD_KEY}:${id}`;
}

/** Returns the saved data, or null if there is none (or it can't be read). */
export function loadSave(key) {
  const data = readJSON(key);
  return data ? migrate(data) : null;
}

/** Returns true if saved. */
export function writeSave(key, data) {
  return writeJSON(key, { ...data, version: SAVE_VERSION, savedAt: Date.now() });
}

export function removeSave(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('Could not remove save:', err);
  }
}

/** The list of players, or null if there is none yet. */
export function loadProfiles() {
  const index = readJSON(PROFILES_KEY);
  if (!index || !Array.isArray(index.profiles) || !index.profiles.length) return null;
  return index;
}

/** Returns true if saved. */
export function saveProfiles(index) {
  return writeJSON(PROFILES_KEY, { ...index, version: PROFILES_VERSION });
}

/**
 * Returns the list of players, creating the first one if needed: from the
 * old single save (an update from before profiles) or empty (a new install;
 * the roster then fills in the example class).
 */
export function ensureProfiles() {
  const existing = loadProfiles();
  if (existing) return existing;
  const first = { id: newProfileId(), name: 'Teacher', emoji: '🍎', createdAt: Date.now() };
  const old = loadSave(OLD_KEY);
  if (old) writeSave(saveKeyFor(first.id), old);
  const index = { profiles: [first], lastId: first.id };
  saveProfiles(index);
  return index;
}

export function newProfileId() {
  return `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Ask the browser not to clear our data when the tablet is low on space. */
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Could not read saved game:', err);
    return null;
  }
}

function writeJSON(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn('Could not save game:', err);
    return false;
  }
}

/** Upgrade older save formats here as the game grows. */
function migrate(data) {
  if (!data || typeof data !== 'object') return null;
  // version 1 is the first format; future versions add steps like:
  // if (data.version === 1) { data.stars = {}; data.version = 2; }
  return data;
}
