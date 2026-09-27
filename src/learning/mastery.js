/*
 * What she knows, fact by fact, using "flashcard boxes":
 *   box 0  new / just missed      -> comes back very soon
 *   box 1-2  learning             -> comes back in a few problems
 *   box 3  almost                 -> comes back later
 *   box 4-5  mastered             -> only now and then
 * Right answers move a fact up a box (fast answers count for more);
 * wrong answers move it down two. Families of facts unlock in teaching order
 * once most of the unlocked facts are in box 2 or higher.
 */

/** How many problems to wait before a fact in each box comes back. */
const SPACING = [1, 3, 6, 12, 25, 50];
/** Share of unlocked facts that must reach box 2 before the next family opens. */
const UNLOCK_AT = 0.8;
const FAST_MS = 6000; // answered this fast = fluent
const MAX_LEARNING = 6; // at most this many shaky facts at once before adding new ones

export const LEVELS = [
  { id: 'new', label: 'Not tried yet', color: '#e9e4f2' },
  { id: 'learning', label: 'Learning', color: '#ffb3a7' },
  { id: 'almost', label: 'Almost', color: '#ffe08a' },
  { id: 'mastered', label: 'Mastered', color: '#8fdc9b' },
];

export function levelOf(stat) {
  if (!stat || !stat.seen) return 'new';
  if (stat.box >= 4) return 'mastered';
  if (stat.box >= 2) return 'almost';
  return 'learning';
}

/**
 * Works for any pack (math facts, reading words): a pack is { facts, families }.
 *
 * @param {object} data   saved progress: { tick, unlocked, stats: { key: stat } } (mutated)
 * @param {object} pack   from mathPack() or readingPack()
 * @param {() => {chosen: 'auto' | Array, requireOk: boolean, pinned?: Array}} options
 *   read fresh each time (grown-up settings can change):
 *   chosen    'auto' (unlock in order) or the family ids a grown-up picked
 *   requireOk allow optional items (÷, −, spelling); those with `requires`
 *             also wait until their partner item is known
 *   pinned    families always in play (this week's words)
 */
export function createMastery(data, pack, options) {
  data.tick ??= 0;
  data.unlocked ??= 1;
  data.stats ??= {};
  let lastKey = null;

  const stat = (key) => (data.stats[key] ??= { box: 0, seen: 0, right: 0, wrong: 0, due: 0, ms: 0 });
  const peek = (key) => data.stats[key];

  const picked = () => {
    const { chosen } = options();
    return Array.isArray(chosen) && chosen.length ? chosen : null;
  };
  /** Families that unlock in order (pinned ones are always on, separately). */
  const ordered = () => pack.families.filter((f) => !(options().pinned ?? []).includes(f.id));

  /** Families in play right now. */
  function activeFamilies() {
    const pinned = pack.families.filter((f) => (options().pinned ?? []).includes(f.id));
    const chosen = picked();
    const main = chosen ? pack.families.filter((f) => chosen.includes(f.id)) : ordered().slice(0, Math.max(1, data.unlocked));
    return [...pinned, ...main.filter((f) => !pinned.includes(f))];
  }

  /** Facts that can be asked right now. */
  function eligible() {
    const fams = new Set(activeFamilies().map((f) => f.id));
    return pack.facts.filter((f) => {
      if (!fams.has(f.family)) return false;
      // optional items (÷, −, spelling) follow the grown-up switch
      if (f.optional && !options().requireOk) return false;
      if (f.requires) return (peek(f.requires)?.box ?? 0) >= 3;
      return true;
    });
  }

  /** Open the next family when most unlocked facts are going well. */
  function maybeUnlock() {
    if (picked()) return null;
    const fams = ordered();
    const open = new Set(fams.slice(0, data.unlocked).map((f) => f.id));
    const base = pack.facts.filter((f) => !f.optional && open.has(f.family));
    const good = base.filter((f) => (peek(f.key)?.box ?? 0) >= 2).length;
    if (base.length && good / base.length >= UNLOCK_AT && data.unlocked < fams.length) {
      data.unlocked += 1;
      return fams[data.unlocked - 1];
    }
    return null;
  }

  /** Choose the next fact to practice. */
  function pick() {
    const facts = eligible();
    const shaky = facts.filter((f) => peek(f.key)?.seen && peek(f.key).box < 2).length;
    let total = 0;
    const weights = facts.map((f) => {
      const s = peek(f.key);
      let w;
      if (!s || !s.seen) w = shaky >= MAX_LEARNING ? 0.1 : 2; // introduce new facts gradually
      else {
        const overdue = data.tick >= s.due;
        w = (6 - s.box) * (overdue ? 1 : 0.1);
      }
      if (f.key === lastKey) w = 0;
      total += w;
      return w;
    });
    let r = Math.random() * total;
    for (let i = 0; i < facts.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        lastKey = facts[i].key;
        return facts[i];
      }
    }
    lastKey = facts[0]?.key ?? null;
    return facts[0];
  }

  /**
   * Record how she did on a fact.
   * @returns {{unlocked: object | null}} a newly opened family, if any
   */
  function record(key, correct, { ms = 0, hinted = false } = {}) {
    const s = stat(key);
    data.tick += 1;
    s.seen += 1;
    if (correct) {
      s.right += 1;
      // hints and slow answers still count as right, but don't push the fact up as far
      if (!hinted && (s.box < 3 || ms < FAST_MS)) s.box = Math.min(5, s.box + 1);
    } else {
      s.wrong += 1;
      s.box = Math.max(0, s.box - 2);
    }
    s.ms = s.ms ? Math.round(s.ms * 0.7 + ms * 0.3) : ms;
    s.due = data.tick + SPACING[s.box];
    return { unlocked: correct ? maybeUnlock() : null };
  }

  return {
    pack,
    pick,
    record,
    activeFamilies,
    level: (key) => levelOf(peek(key)),
    stat: peek,
    /** Hardest facts so far (most missed, lowest box). */
    tricky(limit = 6) {
      return pack.facts
        .filter((f) => peek(f.key)?.wrong)
        .sort((x, y) => (peek(y.key).wrong - peek(y.key).right * 0.3) - (peek(x.key).wrong - peek(x.key).right * 0.3))
        .slice(0, limit);
    },
  };
}
