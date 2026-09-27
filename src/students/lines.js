/*
 * Things students say. {name} is replaced with the student's own name.
 * Add more lines freely: they are picked at random, never twice in a row.
 */

export const TAP_LINES = {
  kid: ['Hi, teacher!', 'I like school!', 'Can we have recess?', 'I drew a cat!', 'Hee hee!', "I'm {name}!", 'I lost a tooth!', 'You are the best teacher!'],
  plush: ['Hug time!', "I'm so fluffy!", 'Squeak squeak!', 'I love you, teacher!', "I'm {name}!", 'Can I sit on the rug?', 'I am soft and happy!'],
  truck: ['Vroom vroom!', 'Beep beep!', "I'm a big truck!", 'Honk honk, hello!', "I'm {name}!", 'Ready to roll!', 'My wheels are huge!'],
  tank: ['Clank clank!', 'Reporting for class!', 'I am ready to learn!', 'Rolling in!', "I'm {name}!", 'Beep boop, hello!', 'My treads go round and round!'],
};

/** Said when you tap the character in the "make a student" screen. */
export const HELLO_LINES = {
  kid: ["Hi! I'm {name}!", "Hello! I'm {name}!"],
  plush: ["Hi! I'm {name}! Hee hee!", "Hello! I'm {name}!"],
  truck: ["Vroom! I'm {name}!", "Honk! I'm {name}!"],
  tank: ["Clank! I'm {name}!", "Hello! I'm {name}!"],
};

const last = new Map();

/** Pick a line for a student, avoiding the one they said last time. */
export function pickLine(lines, student) {
  const list = lines[student.type] ?? lines.kid;
  const key = `${student.id}|${list[0]}`;
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && last.get(key) === i) i = (i + 1) % list.length;
  last.set(key, i);
  return fill(list[i], student);
}

export function fill(text, student) {
  return text.replaceAll('{name}', student.name || 'new');
}

/** Free-play chatter (speech bubbles only, so the room isn't too noisy). */
export const CHAT_LINES = {
  kid: ['Wanna play tag?', 'I like your shoes!', 'Look at me!', 'Race you!', 'Hi, friend!', 'Did you bring a snack?', 'Knock knock!', "Let's build a fort!"],
  plush: ['Hug?', "Let's have a tea party!", 'I love the rug!', 'Soft hugs!', 'Wanna nap?', 'You are my best friend!'],
  truck: ['Vroom!', 'Beep beep, coming through!', 'Race you!', 'Honk honk!', 'Look at my wheels!'],
  tank: ['Clank clank!', 'Rolling by!', 'Beep boop!', 'Want to play?', 'Tank you very much!'],
};

export const REPLY_LINES = ['Okay!', 'Yes!', 'Hee hee!', 'You too!', 'Sure!', 'Yay!', 'Haha!', 'Me too!'];

export const START_CLASS_LINES = ['Yay, class!', 'Okay, teacher!', 'Coming!', 'Class time!', 'My seat!'];

export const DISMISS_LINES = ['Recess!', 'Yay!', 'Playtime!', 'Woo-hoo!', "Let's play!"];

export const QUIET_LINES = ['Shhh…', '🤫', 'Okay…', '(quiet)'];

/** One random item from a list. */
export function pickFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** Answers when the teacher calls their name. */
export const HERE_LINES = {
  kid: ['Here!', 'Present!', 'Here, teacher!', "I'm here!"],
  plush: ['Here! Hee hee!', 'Present!', "I'm here, teacher!", 'Here! Squeak!'],
  truck: ['Here, teacher!', 'Present! Vroom!', 'Here! Beep beep!'],
  tank: ['Present and ready!', 'Here, teacher!', 'Here! Clank clank!'],
};

/** When they're called a second time. */
export const STILL_HERE_LINES = ["I'm still here!", 'Still here!', 'Yes, teacher?', 'Me again!'];

/**
 * A classmate explains why someone isn't here. {Is} becomes "She's",
 * "He's" or "They're" and {Has} becomes "She has", "He has" or "They have".
 */
export const ABSENT_LINES = {
  kid: ['{Is} sick today!', '{Is} at the dentist!', '{Is} visiting grandma!', '{Has} a cold today!'],
  plush: ['{Is} in the washing machine!', '{Is} getting new stuffing!', '{Is} having a nap day!', '{Is} sick today!'],
  truck: ['{Is} getting new tires!', '{Is} at the car wash!', '{Is} at the garage today!'],
  tank: ['{Is} getting polished!', '{Is} getting new treads!', '{Is} at the tank doctor!'],
};

export const CHEER_LINES = ['Yay!', 'Hooray!', 'Woo-hoo!', 'We did it!'];

/** Fill {Is}/{Has}/{name} for a student using their pronoun. */
export function fillPronoun(text, student) {
  const is = { she: "She's", he: "He's", they: "They're" }[student.pronoun] ?? "They're";
  const has = { she: 'She has', he: 'He has', they: 'They have' }[student.pronoun] ?? 'They have';
  return fill(text, student).replaceAll('{Is}', is).replaceAll('{Has}', has);
}

/* ---- lessons: {n} = a number, {q} = the problem said out loud ---- */

export const HAND_LINES = ['Ooh! Ooh!', 'Me! Me!', 'I know!', 'Pick me!', 'Ooh, I know this one!'];
export const ANSWER_LINES = ['{n}!', "It's {n}!", "I think it's {n}!", 'Is it {n}?', '{n}, teacher!'];
export const ASK_LINES = ["Teacher, what's {q}?", 'What is {q}, teacher?', 'Can you tell us {q}?'];
export const PROUD_LINES = ['Yay!', 'I knew it!', 'Woo-hoo!', 'Thank you!', 'Yes!'];
export const FIX_ASK_LINES = ['Oops! What is it, teacher?', 'Oh no! What is it?', 'Hmm, can you help me?'];
export const THANKS_LINES = ['Oh! {n}! Thank you!', '{n}! Now I get it!', 'Ohh, {n}! Thanks, teacher!'];
export const CLASS_WOW_LINES = ['Ooh!', 'Wow!', 'Teacher is so smart!', 'Cool!'];
/** The teacher said "not right" but the student was right. */
export const DISAGREE_LINES = ["But {q} is {n}! Let's count!", 'Hmm, I think {q} really is {n}!'];
/** The teacher said "right" but the student was wrong. */
export const CATCH_LINES = ["Wait! I think {q} is {n}!", "Hmm, is that right? I think it's {n}!"];

/** Fill {n} and {q} in a lesson line. */
export function fillMath(text, { n = '', q = '' } = {}) {
  return text.replaceAll('{n}', String(n)).replaceAll('{q}', q);
}

/* ---- reading & spelling: {w} = the word (or what the student said), {letters} = spelled out ---- */

export const READ_ASK_LINES = ['Teacher, can you read this?', 'What does it say, teacher?', 'Can you read it for us?'];
export const STUDENT_READ_LINES = ['It says {w}!', '{w}!', 'I think it says {w}!'];
export const SPELL_SHOW_LINES = ['I can spell {w}!', 'Look, I wrote {w}!', 'I spelled {w}!'];
export const SPELL_ASK_LINES = ['Teacher, how do you spell {w}?', 'How do you spell {w}?'];
export const READ_FIX_LINES = ['Oops! How do you say it, teacher?', 'Can you read it for me?'];
export const SPELL_FIX_LINES = ['Oops! How do you spell it?', 'Can you fix it, teacher?'];
export const READ_CATCH_LINES = ['Wait! I think it says {w}!', 'Hmm, I think that says {w}!'];
export const SPELL_CATCH_LINES = ["Wait! I think it's spelled {letters}!", 'Hmm, I think {w} is {letters}!'];
export const READ_DISAGREE_LINES = ['But it does say {w}!', 'Hmm, I really think it says {w}!'];
export const SPELL_DISAGREE_LINES = ["But that's how you spell {w}!", 'I think I spelled it right!'];
export const WORD_THANKS_LINES = ['Oh! {w}! Thank you!', '{w}! Now I get it!', 'Ohh, {w}! Thanks, teacher!'];

/** Fill {w} and {letters} in a reading line. */
export function fillWord(text, { w = '', letters = '' } = {}) {
  return text.replaceAll('{w}', w).replaceAll('{letters}', letters);
}

/** "because" -> "b, e, c, a, u, s, e" (so the voice says each letter). */
export function spellOut(word) {
  return [...word.toLowerCase()].filter((c) => /[a-z]/.test(c)).join(', ');
}
