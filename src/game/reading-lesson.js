import { createEmitter } from '../core/emitter.js';
import { chunks, misread, misspell } from '../learning/reading-words.js';
import { checkReading, sameSpelling } from '../learning/reading-check.js';
import { verdictIn } from '../learning/numbers.js';
import { matchNames } from '../voice/name-match.js';
import { matchCommand } from '../voice/commands.js';
import { words as wordsOf } from '../voice/fuzzy.js';
import { speak } from '../voice/speech-output.js';
import { sfx } from '../audio/sfx.js';
import {
  HAND_LINES, PROUD_LINES, CLASS_WOW_LINES, READ_ASK_LINES, STUDENT_READ_LINES, SPELL_SHOW_LINES, SPELL_ASK_LINES,
  READ_FIX_LINES, SPELL_FIX_LINES, READ_CATCH_LINES, SPELL_CATCH_LINES, READ_DISAGREE_LINES, SPELL_DISAGREE_LINES,
  WORD_THANKS_LINES, fillWord, spellOut, pickFrom,
} from '../students/lines.js';

export const READING_LENGTH = 8;
const TEACH_SHARE = 0.55;

/**
 * Reading time. Each turn uses one practice item from the reading pack:
 *
 *  read an item (r:)
 *    teach   'hands' -> a student reads it, sometimes wrong -> 'judge'
 *            if the teacher catches it: 'fix-read' (they read it right)
 *    direct  'read': a student asks the teacher to read it; the mic checks
 *  spell an item (s:)
 *    teach   'hands' -> a student writes it on the board, sometimes misspelled -> 'judge'
 *            if the teacher catches it: 'fix-spell' (they type the right spelling)
 *    direct  'spell': "How do you spell ___?" the teacher types it
 *
 *  'review' after a slip, 'done' at the end.
 * Help ("sound it out") splits the word into parts on the board with a tip;
 * 🔊 says the word. Using help still counts, but doesn't move the word up as far.
 * Events: 'change', 'unlocked', 'end'
 */
export function createReadingLesson({ learning, students, session, board }) {
  const events = createEmitter();
  let s = null;

  const now = () => performance.now();
  const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);

  function later(ms, fn) {
    clearTimeout(s.timer);
    const lesson = s;
    s.timer = setTimeout(() => { if (s === lesson) fn(); }, ms);
  }

  function setPhase(phase, patch = {}) {
    Object.assign(s, patch, { phase });
    events.emit('change', s);
  }

  function feedback(text, tone) {
    s.feedback = { text, tone };
  }

  /** What's on the board right now (kept so marks and help can be added). */
  function drawBoard(extra = {}) {
    const item = s.item;
    const base = {
      title: `Reading time  ·  ${s.index} of ${READING_LENGTH}`,
      text: s.mode === 'spell' ? (s.written ?? blanks(item.text, s.hinted)) : item.text,
      sentence: item.kind === 'sentence',
      parts: null,
      tip: null,
      mark: null,
      correction: null,
    };
    s.boardState = { ...base, ...s.boardState, ...extra };
    board.word(s.boardState);
  }

  /** "because" -> "_ _ _ _ _ _ _"; with help, the first letter of each part shows. */
  function blanks(word, hinted) {
    if (!hinted) return [...word].map(() => '_').join(' ');
    return chunks(word).map((p) => [p[0], ...[...p.slice(1)].map(() => '_')].join(' ')).join('  ·  ');
  }

  const partsHelp = () => ({ parts: s.item.kind === 'word' ? chunks(s.item.text) : null, tip: s.item.tip });

  // ---------------------------------------------------------------- flow
  function start() {
    if (s) return;
    if (session.state === 'free') session.startClass();
    const reading = learning.reading();
    s = {
      index: 0, results: [], phase: 'intro', item: null, mode: null, turn: null, student: null, said: null, written: null,
      tries: 0, hinted: false, shownAt: 0, timer: 0, feedback: null, boardState: null, typed: '', packTitle: reading.pack.title,
    };
    board.message('Reading time!', reading.pack.title);
    events.emit('change', s);
    later(2200, next);
  }

  function next() {
    if (!s) return;
    students.lowerHands();
    if (s.index >= READING_LENGTH) {
      finish();
      return;
    }
    const item = learning.reading().pick();
    if (!item) {
      finish();
      return;
    }
    const kids = students.presentStudents();
    s.index += 1;
    Object.assign(s, {
      item, mode: item.mode, tries: 0, hinted: false, student: null, said: null, written: null,
      feedback: null, boardState: null, typed: '', asker: null,
    });
    s.turn = kids.length && Math.random() < TEACH_SHARE ? 'teach' : 'direct';

    if (s.turn === 'teach') {
      if (s.mode === 'spell') {
        // the word is only heard, not shown: the teacher needs to know the spelling to judge it
        s.written = '✏️ ?';
        drawBoard();
        sayWord();
      } else {
        drawBoard();
      }
      const hands = shuffle(kids).slice(0, Math.min(kids.length, 2 + Math.floor(Math.random() * 3)));
      students.raiseHands(hands);
      hands.slice(0, 2).forEach((k) => students.bubble(k, pickFrom(HAND_LINES), 2));
      setPhase('hands', { hands });
      return;
    }
    const asker = pickFrom(kids) ?? null;
    s.asker = asker;
    drawBoard();
    if (s.mode === 'read') {
      if (asker) students.say(asker, pickFrom(READ_ASK_LINES));
      setPhase('read', { shownAt: now() });
    } else {
      if (asker) students.say(asker, fillWord(pickFrom(SPELL_ASK_LINES), { w: item.text }), { bubbleText: 'How do you spell it? 🔊' });
      else sayWord();
      setPhase('spell', { shownAt: now() });
    }
  }

  function finish() {
    const right = s.results.filter(Boolean).length;
    const total = s.results.length;
    const cheer = right === total ? 'Perfect!' : right >= total * 0.75 ? 'Super reading!' : 'Good practice!';
    board.message(`⭐ ${right} of ${total}!`, cheer);
    students.cheer();
    sfx.fanfare();
    learning.lessonDone();
    feedback(`${cheer} ${right} of ${total} right.`, 'good');
    setPhase('done', { right, total });
  }

  function stop() {
    if (!s) return;
    clearTimeout(s.timer);
    s = null;
    students.lowerHands();
    board.welcome();
    events.emit('end');
  }

  function record(correct, ms) {
    const { unlocked } = learning.reading().record(s.item.key, correct, { ms, hinted: s.hinted });
    learning.logProblem(correct, ms);
    s.results.push(correct);
    learning.save();
    if (unlocked) events.emit('unlocked', unlocked);
  }

  function praiseAndNext(text) {
    sfx.chime();
    feedback(text, 'good');
    setPhase('praise');
    later(2600, next);
  }

  // ---------------------------------------------------------------- actions
  /** The teacher picks a student to read or spell. */
  function choose(student) {
    if (!s || s.phase !== 'hands') return false;
    students.lowerHands();
    const wrong = Math.random() < learning.mistakeRate();
    const item = s.item;
    if (s.mode === 'read') {
      const said = wrong ? misread(item, learning.reading().pack) : item.text;
      students.say(student, item.kind === 'sentence' ? said : fillWord(pickFrom(STUDENT_READ_LINES), { w: said }), { sound: true, bubbleSeconds: 4 });
      setPhase('thinking', { student, said, studentRight: !wrong });
    } else {
      const written = wrong ? misspell(item.text) : item.text;
      students.say(student, fillWord(pickFrom(SPELL_SHOW_LINES), { w: item.text }), { sound: true, bubbleText: 'I wrote it on the board!' });
      drawBoard({ text: written });
      setPhase('thinking', { student, written, studentRight: !wrong });
    }
    later(item.kind === 'sentence' ? 2600 : 1400, () => setPhase('judge', { shownAt: now() }));
    return true;
  }

  function chooseRandom() {
    const pool = s?.hands?.length ? s.hands : students.presentStudents();
    const pick = pickFrom(pool);
    return pick ? choose(pick) : false;
  }

  /** The teacher decides if the student read (or spelled) it right. */
  function judge(verdict) {
    if (!s || s.phase !== 'judge') return false;
    const ms = now() - s.shownAt;
    const word = s.item.text;
    const reading = s.mode === 'read';

    if (verdict === 'right' && s.studentRight) {
      record(true, ms);
      learning.addStar(s.student.id);
      learning.teacherStar();
      drawBoard({ mark: 'right' });
      students.celebrate(s.student);
      students.say(s.student, pickFrom(PROUD_LINES));
      praiseAndNext(`Yes! ${s.student.name} gets a ⭐`);
    } else if (verdict === 'wrong' && !s.studentRight) {
      sfx.pop();
      if (reading) {
        students.say(s.student, pickFrom(READ_FIX_LINES));
        feedback(`Good catch! ${s.student.name} said “${s.said}”. Now you read it!`, 'good');
        setPhase('fix-read', { shownAt: now() });
      } else {
        drawBoard({ mark: 'wrong' });
        students.say(s.student, pickFrom(SPELL_FIX_LINES));
        feedback('Good catch! Type the right spelling.', 'good');
        setPhase('fix-spell', { shownAt: now(), typed: '' });
      }
    } else if (verdict === 'right' && !s.studentRight) {
      // a mistake slipped past: a classmate notices
      record(false, ms);
      s.hinted = true;
      const helper = pickFrom(students.presentStudents().filter((k) => k.id !== s.student.id)) ?? s.student;
      if (reading) {
        students.say(helper, fillWord(pickFrom(READ_CATCH_LINES), { w: word }), { bubbleSeconds: 4 });
        drawBoard(partsHelp());
        feedback(`Oops! ${s.student.name} said “${s.said}”, but it says “${word}”.`, 'oops');
      } else {
        students.say(helper, fillWord(pickFrom(SPELL_CATCH_LINES), { w: word, letters: spellOut(word) }), { bubbleSeconds: 5 });
        drawBoard({ mark: 'wrong', correction: word });
        feedback(`Oops! “${s.written}” should be “${word}”.`, 'oops');
      }
      setPhase('review');
    } else {
      // it was right after all
      record(false, ms);
      s.hinted = true;
      if (reading) {
        students.say(s.student, fillWord(pickFrom(READ_DISAGREE_LINES), { w: word }));
        drawBoard(partsHelp());
        feedback(`${s.student.name} read it right: “${word}”.`, 'oops');
      } else {
        students.say(s.student, fillWord(pickFrom(SPELL_DISAGREE_LINES), { w: word }));
        drawBoard({ mark: 'right' });
        feedback(`${s.student.name} spelled it right: “${word}”.`, 'oops');
      }
      setPhase('review');
    }
    return true;
  }

  /**
   * The teacher read it aloud (from the microphone), or tapped "I read it".
   * @param {{text: string}[] | null} alternatives  null = the teacher says they read it (no mic)
   */
  function readAloud(alternatives) {
    if (!s || (s.phase !== 'read' && s.phase !== 'fix-read')) return false;
    const ms = now() - s.shownAt;
    const fixing = s.phase === 'fix-read';
    const word = s.item.text;
    const ok = alternatives === null ? true : checkReading(alternatives, s.item).ok;
    if (alternatives === null) s.hinted = true; // honor system: counts, but gently
    if (ok) {
      record(true, ms);
      learning.teacherStar();
      if (fixing) {
        learning.addStar(s.student.id);
        students.celebrate(s.student);
        students.say(s.student, fillWord(pickFrom(WORD_THANKS_LINES), { w: s.item.kind === 'sentence' ? 'Oh' : word }));
      } else {
        students.cheer();
        const fan = pickFrom(students.presentStudents());
        if (fan) students.say(fan, pickFrom(CLASS_WOW_LINES));
      }
      drawBoard({ mark: s.item.kind === 'word' ? 'right' : null });
      praiseAndNext(`Great reading! ⭐`);
      return true;
    }
    s.tries += 1;
    sfx.uncheck();
    if (s.tries === 1) {
      s.hinted = true;
      drawBoard(partsHelp());
      feedback(s.item.kind === 'word' ? 'Almost! Let’s sound it out, part by part.' : 'Almost! Read it again, slowly.', 'try');
      events.emit('change', s);
    } else if (s.tries === 2) {
      sayWord();
      feedback('Listen, then say it with me!', 'try');
      events.emit('change', s);
    } else {
      record(false, ms);
      drawBoard(partsHelp());
      feedback(`It says “${word}”. We’ll read it again soon!`, 'oops');
      setPhase('review');
    }
    return true;
  }

  /** The teacher typed a spelling. */
  function spell(typed) {
    if (!s || (s.phase !== 'spell' && s.phase !== 'fix-spell')) return false;
    const ms = now() - s.shownAt;
    const word = s.item.text;
    const fixing = s.phase === 'fix-spell';
    if (sameSpelling(typed, word)) {
      record(true, ms);
      learning.teacherStar();
      if (fixing) {
        learning.addStar(s.student.id);
        drawBoard({ mark: 'wrong', correction: word });
        students.celebrate(s.student);
        students.say(s.student, fillWord(pickFrom(WORD_THANKS_LINES), { w: word }));
      } else {
        s.written = word;
        drawBoard({ text: word, mark: 'right' });
        students.cheer();
      }
      praiseAndNext(`Yes! “${word}” ⭐`);
      return true;
    }
    s.tries += 1;
    sfx.uncheck();
    if (s.tries === 1) {
      s.hinted = true;
      if (!fixing) drawBoard({ text: blanks(word, true), tip: s.item.tip });
      else drawBoard({ tip: s.item.tip, parts: null });
      feedback(`Not quite: “${typed.toLowerCase()}”. Look at the hint and try again!`, 'try');
      events.emit('change', s);
    } else {
      record(false, ms);
      drawBoard(fixing ? { mark: 'wrong', correction: word } : { text: word, mark: null, parts: chunks(word) });
      feedback(`It’s spelled “${word}”. We’ll practice it again soon!`, 'oops');
      setPhase('review');
    }
    return true;
  }

  /** Say the word out loud (teacher's voice). */
  function sayWord() {
    if (!s?.item) return;
    speak(s.item.text, { rate: 0.85, interrupt: true });
  }

  /** "Sound it out" help. */
  function help() {
    if (!s?.item) return;
    s.hinted = true;
    if (s.mode === 'spell' && (s.phase === 'spell')) drawBoard({ text: blanks(s.item.text, true), tip: s.item.tip });
    else if (s.mode === 'spell') drawBoard({ tip: s.item.tip });
    else drawBoard(partsHelp());
    events.emit('change', s);
  }

  // ---------------------------------------------------------------- voice
  function hear(alternatives, text) {
    if (!s) return false;
    switch (s.phase) {
      case 'hands': {
        const { confident } = matchNames(alternatives, students.presentStudents());
        if (confident.length) return choose(confident[0]) && confident[0].name;
        if (/\b(pick|anyone|anybody|someone|you)\b/i.test(text)) return chooseRandom() && 'Picked!';
        if (matchCommand(alternatives)) return false;
        return { ok: false, label: 'Say a name, or tap a student with a hand up!' };
      }
      case 'judge': {
        for (const alt of alternatives) {
          const v = verdictIn(alt.text);
          if (v) {
            judge(v);
            return v === 'right' ? 'Right!' : 'Not right!';
          }
        }
        if (matchCommand(alternatives)) return false;
        return { ok: false, label: 'Say “Correct!” or “Try again!”' };
      }
      case 'read':
      case 'fix-read': {
        if (matchCommand(alternatives) && !checkReading(alternatives, s.item).ok) return false;
        const before = s.results.length;
        readAloud(alternatives);
        return s.results.length > before && s.results.at(-1)
          ? 'Great reading!'
          : { ok: false, label: 'Almost! Try again.' };
      }
      case 'spell':
      case 'fix-spell': {
        // spelled out loud, letter by letter: "b e c a u s e"
        const letters = wordsOf(text);
        if (letters.length > 1 && letters.every((l) => l.length === 1)) {
          spell(letters.join(''));
          return letters.join('');
        }
        if (matchCommand(alternatives)) return false;
        return { ok: false, label: 'Type it on the keyboard, or say the letters!' };
      }
      case 'review':
        if (/\b(next|okay|ok|go)\b/i.test(text)) {
          next();
          return 'Next!';
        }
        return false;
      default:
        return false;
    }
  }

  session.on('state', (state) => { if (state === 'free') stop(); });

  return {
    on: events.on,
    start,
    stop,
    next,
    choose,
    chooseRandom,
    judge,
    readAloud,
    spell,
    sayWord,
    help,
    hear,
    get active() {
      return Boolean(s);
    },
    get state() {
      return s;
    },
  };
}
