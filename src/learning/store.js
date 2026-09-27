import { createEmitter } from '../core/emitter.js';
import { createMastery } from './mastery.js';
import { mathPack } from './math-facts.js';
import { readingPack, CUSTOM_GROUP, cleanWordList } from './reading-words.js';

/** Grown-up settings for learning. */
export const DEFAULT_SETTINGS = {
  grade: 3, // one grade for all subjects
  mistakes: 'some', // how often students answer wrong (or misread/misspell) on purpose
  // math
  tables: 'auto', // 'auto' = unlock in teaching order, or a list of family ids like [6, 7, 8]
  division: true, // include ÷ (grades 3-4) or − (grades 1-2) once the partner fact is known
  // reading
  readingGroups: 'auto', // 'auto' or a list of word-group ids
  spelling: true, // include spelling once the player can read a word
  weekWords: [], // the player's school's weekly words (always practiced first)
};

export const MISTAKE_RATES = { few: 0.2, some: 0.35, lots: 0.5 };

/**
 * Everything the game remembers about learning, saved with the class:
 *   settings, progress per grade (flashcard boxes), practice history,
 *   and gold stars per student.
 * Events: 'change'
 */
export function createLearning(roster) {
  const events = createEmitter();
  const data = roster.getSetting('learning') ?? {};
  data.settings = { ...DEFAULT_SETTINGS, ...data.settings };
  data.progress ??= {};
  data.reading ??= {};
  data.history ??= {};
  data.history.days ??= {};
  data.history.lessons ??= 0;
  data.history.teacherStars ??= 0;
  data.stars ??= {};
  let mastery = null;
  let readingMastery = null;

  function save() {
    roster.setSetting('learning', data);
    events.emit('change');
  }

  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => dayKey(new Date());
  /** Practice log for one day (lessons were added to it later, so older days have none). */
  const logDay = () => (data.history.days[today()] ??= { problems: 0, right: 0, seconds: 0, lessons: 0 });

  return {
    on: events.on,
    save,
    get settings() {
      return data.settings;
    },
    get history() {
      return data.history;
    },

    /** Math progress for the current grade. */
    math() {
      const g = data.settings.grade;
      if (!mastery || mastery.grade !== g) {
        data.progress[g] ??= {};
        const st = data.settings;
        mastery = createMastery(data.progress[g], mathPack(g), () => ({ chosen: st.tables, requireOk: st.division }));
        mastery.grade = g;
      }
      return mastery;
    },

    /** Reading & spelling progress for the current grade (with this week's words). */
    reading() {
      const g = data.settings.grade;
      if (!readingMastery || readingMastery.grade !== g) {
        data.reading[g] ??= {};
        const st = data.settings;
        const pack = readingPack(g, st.weekWords);
        readingMastery = createMastery(data.reading[g], pack, () => ({
          chosen: st.readingGroups,
          requireOk: st.spelling,
          pinned: st.weekWords.length ? [CUSTOM_GROUP] : [],
        }));
        readingMastery.grade = g;
      }
      return readingMastery;
    },

    mistakeRate() {
      return MISTAKE_RATES[data.settings.mistakes] ?? MISTAKE_RATES.some;
    },

    setSettings(patch) {
      if (patch.weekWords) patch.weekWords = cleanWordList(patch.weekWords);
      Object.assign(data.settings, patch);
      mastery = null;
      readingMastery = null;
      save();
    },

    /** One problem done (for the practice history). */
    logProblem(correct, ms) {
      const day = logDay();
      day.problems += 1;
      if (correct) day.right += 1;
      day.seconds += Math.min(60, Math.round(ms / 1000)); // cap long pauses
    },

    lessonDone() {
      data.history.lessons += 1;
      const day = logDay();
      day.lessons = (day.lessons ?? 0) + 1;
      save();
    },

    addStar(studentId) {
      data.stars[studentId] = (data.stars[studentId] ?? 0) + 1;
    },
    teacherStar() {
      data.history.teacherStars += 1;
    },
    starsFor(studentId) {
      return data.stars[studentId] ?? 0;
    },

    /** Totals for the last `days` days (today included). */
    recent(days = 7) {
      const now = new Date();
      const entries = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const e = data.history.days[dayKey(d)];
        if (e) entries.push(e);
      }
      return totals(entries);
    },

    /**
     * Totals since the start (or the last progress reset), plus the number of
     * days practiced, the first day, and gold stars given to students.
     * Lessons come from the all-time counter, which is older than the daily log.
     */
    allTime() {
      const keys = Object.keys(data.history.days).sort();
      const sum = totals(keys.map((k) => data.history.days[k]));
      return {
        ...sum,
        lessons: data.history.lessons,
        days: keys.length,
        since: keys[0] ?? null,
        stars: Object.values(data.stars).reduce((a, b) => a + b, 0),
      };
    },

    resetProgress() {
      data.progress = {};
      data.reading = {};
      data.history = { days: {}, lessons: 0, teacherStars: 0 };
      data.stars = {};
      mastery = null;
      readingMastery = null;
      save();
    },
  };
}

function totals(entries) {
  const sum = { problems: 0, right: 0, seconds: 0, lessons: 0 };
  for (const e of entries) {
    sum.problems += e.problems ?? 0;
    sum.right += e.right ?? 0;
    sum.seconds += e.seconds ?? 0;
    sum.lessons += e.lessons ?? 0;
  }
  return sum;
}
