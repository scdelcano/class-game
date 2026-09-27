import { words, containsPhrase } from './fuzzy.js';

/*
 * Things the teacher can say. To add a command: add an entry here with a
 * few ways kids might say it, then handle its id in main.js with
 * voice.command('<id>', () => …).
 * Matching is by phrase anywhere in the sentence, so "Okay class, sit down
 * please!" matches "sit down". Longer (more specific) phrases win.
 */
export const COMMANDS = [
  {
    id: 'startClass',
    phrases: [
      'sit down', 'sit in your seats', 'take your seats', 'take your seat', 'take a seat', 'have a seat',
      'go to your seats', 'go to your desks', 'go to your seat', 'everyone sit', 'everybody sit',
      'class is starting', 'class is about to start', 'class starts', 'start class', 'start the class',
      'time for class', 'class time', 'its class time', 'lets start', 'good morning class', 'find your seats',
    ],
  },
  {
    id: 'endClass',
    phrases: [
      'class dismissed', 'dismissed', 'recess', 'time for recess', 'go play', 'go and play', 'you can play',
      'class is over', 'school is over', 'free time', 'playtime', 'play time', 'time to play', 'lunch time',
      'lunchtime', 'go outside', 'see you tomorrow', 'goodbye class', 'bye class',
    ],
  },
  {
    id: 'quiet',
    phrases: [
      'quiet', 'be quiet', 'shh', 'silence', 'hush', 'inside voices', 'indoor voices', 'inside voice',
      'zip it', 'zip your lips', 'calm down', 'settle down', 'no talking', 'stop talking', 'listen up',
    ],
  },
  {
    id: 'lesson',
    phrases: [
      'math time', 'time for math', 'lets do math', 'math class', 'lesson time', 'time for a lesson',
      'lets learn', 'times tables', 'lets practice', 'practice time', 'math lesson', 'lets do some math',
    ],
  },
  {
    id: 'reading',
    phrases: [
      'reading time', 'time for reading', 'time to read', 'lets read', 'reading lesson', 'lets do reading',
      'spelling time', 'time for spelling', 'spelling test', 'lets spell', 'spelling lesson', 'reading class',
    ],
  },
  {
    id: 'attendance',
    phrases: [
      'attendance', 'take attendance', 'roll call', 'call roll', 'call the roll', 'who is here', 'whos here',
      'check who is here', 'lets see who is here', 'clipboard',
    ],
  },
];

/**
 * Find the command in what was heard. Looks at every guess the speech
 * recognizer made (best guess first).
 * @param {{text: string}[]} alternatives
 * @returns {{id: string, phrase: string, heard: string} | null}
 */
export function matchCommand(alternatives, commands = COMMANDS) {
  let best = null;
  alternatives.forEach((alt, rank) => {
    const heard = words(alt.text);
    for (const command of commands) {
      for (const phrase of command.phrases) {
        const phraseWords = words(phrase);
        if (!containsPhrase(heard, phraseWords)) continue;
        const score = phrase.length - rank * 3; // prefer longer phrases and better guesses
        if (!best || score > best.score) best = { id: command.id, phrase, heard: alt.text, score };
      }
    }
  });
  return best;
}
