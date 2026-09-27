/*
 * Reading & spelling packs, one per grade. Like the math packs, each pack is
 * a list of "families" (word groups) in teaching order; the game unlocks
 * them one at a time.
 *
 * Every word gives two practice items:
 *   r:<word>  read it aloud
 *   s:<word>  spell it (unlocked once the player can read it)
 * Sentences (fluency) are read-only.
 *
 * All words and sentences are ordinary English; the sentences are original.
 * To add words, add them to a group below (or type a weekly list in Grown-ups).
 */

const PACK_DEFS = {
  1: {
    title: 'Short vowels, blends & sight words',
    standard: 'RF.1.3',
    groups: [
      { id: 'short-a', label: 'Short a', words: 'cat map sad hat bag jam van can' },
      { id: 'short-vowels', label: 'Short i o u e', words: 'pig sit dog hot sun bug bed red pen fox' },
      { id: 'digraphs', label: 'sh ch th', tip: 'Two letters, one sound: sh, ch, th', words: 'ship shop chin chop that then fish much' },
      { id: 'blends', label: 'Blends', words: 'frog stop clap flag step drum swim crab' },
      { id: 'magic-e', label: 'Silent e', tip: 'A silent e makes the vowel say its name', words: 'cake bike home cute time rope game bone' },
      { id: 'sight-1', label: 'Tricky words', tip: 'Tricky words: just remember them!', words: 'the said was what where they come some of you' },
      { id: 'sentences-1', label: 'Sentences', sentences: ['The cat sat on a mat.', 'I can see the red bus.', 'The dog is in the mud.', 'We like to swim.', 'Look at the big fish!', 'She has a pet frog.'] },
    ],
  },
  2: {
    title: 'Vowel teams, two-syllable words & endings',
    standard: 'RF.2.3',
    groups: [
      { id: 'ai-ay', label: 'ai & ay', tip: 'ai and ay say the long a sound', words: 'rain train play day paint stay mail gray' },
      { id: 'ee-ea', label: 'ee & ea', tip: 'ee and ea often say the long e sound', words: 'tree green sleep read team beach seat sheep' },
      { id: 'oa-ow', label: 'oa & ow', tip: 'oa and ow can say the long o sound', words: 'boat road snow grow coat slow toad show' },
      { id: 'r-vowels', label: 'ar or er ir ur', tip: 'The r changes the vowel sound', words: 'star farm corn storm her bird girl turn fur' },
      { id: 'two-syllable', label: 'Two syllables', words: 'rabbit basket picnic napkin sunset kitten muffin button' },
      { id: 'endings-2', label: '-ed & -ing', tip: '-ed means it already happened; -ing means it is happening', words: 'jumped played looking running hopped baking' },
      { id: 'sight-2', label: 'Tricky words', tip: 'Tricky words: just remember them!', words: 'because again friend laugh could would there every very many' },
      { id: 'sentences-2', label: 'Sentences', sentences: ['The green train goes down the road.', 'My friend likes to play in the rain.', 'We had a picnic at the beach.', 'The kitten is sleeping in a basket.', 'A bird can fly over the farm.', 'Every day I read a book.'] },
    ],
  },
  3: {
    title: 'Prefixes, suffixes, long words & tricky words',
    standard: 'RF.3.3 · L.3.2',
    groups: [
      { id: 'un-re', label: 'un- & re-', tip: 'un- means not · re- means again', words: 'unhappy unlock undo unfair redo reread rewrite repaint' },
      { id: 'ful-less', label: '-ful & -less', tip: '-ful means full of · -less means without', words: 'helpful careful hopeful thankful careless fearless spotless painless' },
      { id: 'endings-3', label: 'Adding endings', tip: 'Double, drop the e, or change y to i', words: 'sitting smiled cries hopping making tried stopped babies' },
      { id: 'ly-ness', label: '-ly, -ness, -ment', tip: '-ly tells how · -ness and -ment make a thing', words: 'quickly slowly kindness happiness sadness movement payment darkness' },
      { id: 'pre-dis-mis', label: 'pre- dis- mis-', tip: 'pre- means before · dis- means not · mis- means wrongly', words: 'preview dislike disagree mistake misspell preheat' },
      { id: 'multi', label: 'Long words', tip: 'Break it into parts, then put it back together', words: 'butterfly dinosaur elephant umbrella banana tomorrow remember wonderful hamburger fantastic' },
      { id: 'latin', label: '-tion -able -ible', tip: '-tion says "shun" · -able and -ible mean can be', words: 'action question nation station lotion comfortable washable visible' },
      { id: 'tricky-3', label: 'Tricky words', tip: 'These don’t follow the rules: just remember them!', words: 'though through enough answer beautiful busy early heard special favorite ocean science' },
      { id: 'sentences-3', label: 'Sentences', sentences: ['The careful elephant crossed the bridge slowly.', 'I was unhappy when my kite got stuck.', 'Tomorrow we will reread our favorite book.', 'The butterfly landed on a beautiful flower.', 'She answered the question quickly.', 'The dinosaur was fearless and kind.'] },
    ],
  },
  4: {
    title: 'Harder prefixes, suffixes & long words',
    standard: 'RF.4.3',
    groups: [
      { id: 'prefix-4', label: 'Prefixes', tip: 'im- in- non- mean not · over- under- tell where', words: 'impossible incorrect nonstop overflow underline transport invisible discover' },
      { id: 'suffix-4', label: 'Suffixes', tip: 'Find the base word, then the ending', words: 'celebration information imagination adventure dangerous enjoyable national creative' },
      { id: 'multi-4', label: 'Long words', tip: 'Break it into parts, then put it back together', words: 'electricity temperature vocabulary independent calculator photograph encyclopedia caterpillar' },
      { id: 'tricky-4', label: 'Tricky words', tip: 'These don’t follow the rules: just remember them!', words: 'rhythm business separate necessary knowledge island doubt muscle' },
      { id: 'sentences-4', label: 'Sentences', sentences: ['The invisible cat was impossible to find.', 'We need information about the temperature.', 'Her imagination made the adventure exciting.', 'The caterpillar climbed the tall island tree.', 'Separate the words into syllables.', 'Electricity lights up our classroom.'] },
    ],
  },
};

export const READING_GRADES = Object.keys(PACK_DEFS).map(Number);

/** The weekly list typed by a grown-up becomes this group. */
export const CUSTOM_GROUP = 'this-week';

const PREFIXES = ['under', 'over', 'trans', 'non', 'dis', 'mis', 'pre', 'un', 're', 'im', 'in'];
const SUFFIXES = ['ation', 'tion', 'ness', 'ment', 'able', 'ible', 'less', 'ful', 'ous', 'ive', 'ing', 'ed', 'ly', 'es', 'al'];

/** The pack for a grade (plus the weekly list, if there is one). */
export function readingPack(grade, customWords = []) {
  const def = PACK_DEFS[grade] ?? PACK_DEFS[3];
  const families = [];
  const facts = [];
  const add = (fact) => {
    if (facts.some((f) => f.key === fact.key)) return;
    facts.push(fact);
    families.find((f) => f.id === fact.family).keys.push(fact.key);
  };

  const groups = [...def.groups];
  const custom = cleanWordList(customWords);
  if (custom.length) groups.unshift({ id: CUSTOM_GROUP, label: 'This week', tip: 'Words from school this week', words: custom.join(' ') });

  for (const g of groups) {
    families.push({ id: g.id, label: g.label, tip: g.tip ?? null, keys: [] });
    for (const word of (g.words ?? '').split(/\s+/).filter(Boolean)) {
      add({ key: `r:${word}`, mode: 'read', kind: 'word', text: word, family: g.id, tip: g.tip ?? null });
      // school spelling lists are practiced right away; other words are spelled after they're read well
      const requires = g.id === CUSTOM_GROUP ? null : `r:${word}`;
      add({ key: `s:${word}`, mode: 'spell', kind: 'word', text: word, family: g.id, tip: g.tip ?? null, requires, optional: true });
    }
    for (const sentence of g.sentences ?? []) {
      add({ key: `r:${sentence}`, mode: 'read', kind: 'sentence', text: sentence, family: g.id, tip: null });
    }
  }
  return {
    grade,
    title: def.title,
    standard: def.standard,
    kind: 'reading',
    facts,
    families,
    byKey: new Map(facts.map((f) => [f.key, f])),
  };
}

/** Words typed by a grown-up: lowercase letters, apostrophes and hyphens only. */
export function cleanWordList(input) {
  const list = Array.isArray(input) ? input : String(input ?? '').split(/[\s,;]+/);
  const seen = new Set();
  return list
    .map((w) => String(w).toLowerCase().replace(/[^a-z'-]/g, ''))
    .filter((w) => w.length >= 2 && w.length <= 16 && !seen.has(w) && seen.add(w));
}

// ------------------------------------------------------------------ word parts

/**
 * Break a word into chunks for "sound it out" help:
 * prefix, then syllables of the base, then suffix.
 * "unhappy" -> ["un", "hap", "py"], "butterfly" -> ["but", "ter", "fly"]
 */
export function chunks(word) {
  let w = word.toLowerCase();
  const out = [];
  let suffix = null;
  const prefix = PREFIXES.find((p) => w.startsWith(p) && w.length - p.length >= 3);
  if (prefix && /[aeiouy]/.test(w.slice(prefix.length))) {
    out.push(prefix);
    w = w.slice(prefix.length);
  }
  const suf = SUFFIXES.find((s) => w.endsWith(s) && w.length - s.length >= 3 && suffixIsSeparate(w, s));
  if (suf && /[aeiouy]/.test(w.slice(0, -suf.length))) {
    suffix = suf;
    w = w.slice(0, -suf.length);
  }
  out.push(...syllables(w));
  if (suffix) out.push(suffix);
  return out;
}

const isVowel = (ch) => 'aeiouy'.includes(ch);

/** Is this ending really its own part? ("-ly" in butterfly isn't; "-ed" in smiled isn't a syllable.) */
function suffixIsSeparate(word, suffix) {
  const base = word.slice(0, -suffix.length);
  if (suffix === 'ly') return !base.endsWith('f');
  if (suffix === 'ed') return /[td]$/.test(base);
  if (suffix === 'es') return /(s|x|z|ch|sh)$/.test(base);
  return true;
}
const KEEP_TOGETHER = ['ch', 'sh', 'th', 'wh', 'ph', 'ck', 'ng', 'qu', 'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw'];

/** Rough syllables (good enough for reading help, not a dictionary). */
function syllables(word) {
  if (word.length <= 3) return [word];
  const parts = [];
  let start = 0;
  let i = 0;
  // skip leading consonants
  while (i < word.length && !isVowel(word[i])) i++;
  while (i < word.length) {
    // walk through the vowel group
    while (i < word.length && isVowel(word[i])) i++;
    // count consonants until the next vowel
    let j = i;
    while (j < word.length && !isVowel(word[j])) j++;
    if (j >= word.length) break; // no more vowels: the rest stays in this syllable
    const consonants = word.slice(i, j);
    let cut;
    if (consonants.length === 0) cut = i;
    else if (consonants.length === 1) cut = i; // V-CV: "ba-na-na"
    else if (KEEP_TOGETHER.includes(consonants.slice(-2))) cut = j - 2; // keep blends/digraphs together
    else cut = i + 1; // VC-CV: "but-ter"
    // silent e at the end isn't its own syllable ("cake", "smiled")
    if (word.slice(cut) === 'e' || /^[^aeiouy]*e[ds]?$/.test(word.slice(cut)) && word.slice(cut).length <= 3 && cut > 0) break;
    if (cut > start) {
      parts.push(word.slice(start, cut));
      start = cut;
    }
    i = j;
  }
  parts.push(word.slice(start));
  return parts.filter(Boolean);
}

// ------------------------------------------------------------------ mistakes

/**
 * How a student might misread a word or sentence (said out loud, so it
 * should sound like a real mistake): drop or swap a prefix/suffix, change a
 * vowel sound, or skip a word in a sentence.
 */
/** Words kids commonly read as each other. */
const CONFUSIONS = {
  though: ['through', 'thought'], through: ['though', 'threw'], where: ['were', 'there'], were: ['where', 'we'],
  there: ['three', 'their'], was: ['saw'], said: ['sad'], what: ['want', 'that'], they: ['then', 'the'],
  come: ['came'], some: ['same'], of: ['off'], you: ['your'], because: ['become'], again: ['against'],
  friend: ['fried'], laugh: ['laughed'], could: ['cold'], would: ['world'], every: ['very'], very: ['every'],
  many: ['may'], enough: ['though'], answer: ['ask'], beautiful: ['beautifully'], busy: ['bus'], early: ['ear'],
  heard: ['hard', 'head'], special: ['spell'], favorite: ['favor'], ocean: ['open'], science: ['silence'],
  rhythm: ['rhyme'], business: ['busy'], separate: ['separated'], necessary: ['nursery'], knowledge: ['know'],
  island: ['is land'], doubt: ['dot'], muscle: ['mustle'],
};

export function misread(item, pack) {
  if (item.kind === 'sentence') {
    const w = item.text.replace(/[.!?]$/, '').split(' ');
    if (w.length > 3) {
      const i = 1 + Math.floor(Math.random() * (w.length - 2));
      w.splice(i, 1); // skipped a word
    }
    return `${w.join(' ')}.`;
  }
  const word = item.text;
  const options = [];
  const prefix = PREFIXES.find((p) => word.startsWith(p) && word.length - p.length >= 3);
  if (prefix) options.push(word.slice(prefix.length));
  const suffix = SUFFIXES.find((s) => word.endsWith(s) && word.length - s.length >= 3 && suffixIsSeparate(word, s));
  if (suffix) {
    let base = word.slice(0, -suffix.length);
    if (/([bcdfglmnprst])\1$/.test(base)) base = base.slice(0, -1); // sitting -> sit
    else if ((suffix === 'ing' || suffix === 'ed') && /[^aeiou][aeiou][^aeiouwxy]$/.test(base)) base += 'e'; // making -> make
    options.push(base);
    if (suffix === 'ful') options.push(`${word.slice(0, -3)}less`);
    if (suffix === 'less') options.push(`${word.slice(0, -4)}ful`);
    if (suffix === 'ed') options.push(`${word.slice(0, -2)}ing`);
  }
  // a look-alike word from the same pack
  const lookalike = pack.facts.find((f) => f.kind === 'word' && f.text !== word && f.text[0] === word[0] && Math.abs(f.text.length - word.length) <= 1 && sharedLetters(f.text, word) >= word.length - 2);
  if (lookalike) options.push(lookalike.text);
  if (/[^aeiou]ie[sd]$/.test(word)) options.push(`${word.slice(0, -3)}y`); // cries -> cry, tried -> try
  options.push(...(CONFUSIONS[word] ?? []));
  // only if nothing better: a small vowel slip between consonants ("sit" -> "set", "hop" -> "hup")
  if (!options.length) {
    const swapped = word.replace(/(?<=[^aeiouy])[aeiou](?=[^aeiouy])/, (v) => ({ a: 'e', e: 'i', i: 'e', o: 'u', u: 'o' }[v]));
    if (swapped !== word) options.push(swapped);
  }
  // swapping un- and re- is a classic slip too
  if (prefix === 'un') options.push(`re${word.slice(2)}`);
  if (prefix === 're') options.push(`un${word.slice(2)}`);
  const good = options.filter((o) => o && o !== word && o.length >= 2);
  return good[Math.floor(Math.random() * good.length)] ?? `${word}s`;
}

function sharedLetters(a, b) {
  let n = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) n++;
  return n;
}

/**
 * A believable spelling mistake, like the ones 3rd graders make:
 * a missing double letter, "-full", "crys", "freind", "becuase"...
 */
export function misspell(word) {
  const rules = [
    (w) => w.replace(/([bcdfglmnprst])\1/, '$1'), // sitting -> siting
    (w) => w.replace(/ful$/, 'full'),
    (w) => (/[^aeiou]ies$/.test(w) ? w.replace(/ies$/, 'ys') : w), // cries -> crys
    (w) => w.replace(/([^aeiou])ied$/, '$1yed'), // tried -> tryed
    (w) => w.replace(/ie/, 'ei'),
    (w) => w.replace(/tion$/, 'shun'),
    (w) => w.replace(/ph/, 'f'),
    (w) => w.replace(/ai/, 'ay').replace(/ay([a-z])/, 'ai$1'),
    (w) => w.replace(/ea/, 'ee'),
    (w) => w.replace(/^c([aou])/, 'k$1'),
    (w) => w.replace(/ough$/, 'ow'),
    (w) => w.replace(/([^aeiou])e(s|d)$/, '$1$2'), // smiled -> smild
    (w) => w.replace(/ck/, 'k'),
    (w) => w.replace(/y$/, 'ey'),
  ];
  const tries = rules.map((r) => r(word)).filter((w) => w !== word && w.length >= 2);
  if (tries.length && Math.random() < 0.8) return tries[Math.floor(Math.random() * tries.length)];
  // swap two letters in the middle: because -> becuase
  if (word.length >= 4) {
    for (let n = 0; n < 6; n++) {
      const i = 1 + Math.floor(Math.random() * (word.length - 3));
      if (word[i] !== word[i + 1]) return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
    }
  }
  return tries[0] ?? `${word}e`;
}
