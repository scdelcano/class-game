/**
 * Saves the game on this device (localStorage). Nothing is ever sent anywhere.
 * Data carries a version number so later updates can upgrade old saves.
 */
const KEY = 'my-classroom';
export const SAVE_VERSION = 1;

/** Returns the saved data, or null if there is none (or it can't be read). */
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch (err) {
    console.warn('Could not read saved game:', err);
    return null;
  }
}

/** Returns true if saved. */
export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, version: SAVE_VERSION, savedAt: Date.now() }));
    return true;
  } catch (err) {
    console.warn('Could not save game:', err);
    return false;
  }
}

/** Ask the browser not to clear our data when the tablet is low on space. */
export function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

/** Upgrade older save formats here as the game grows. */
function migrate(data) {
  if (!data || typeof data !== 'object') return null;
  // version 1 is the first format; future versions add steps like:
  // if (data.version === 1) { data.stars = {}; data.version = 2; }
  return data;
}
