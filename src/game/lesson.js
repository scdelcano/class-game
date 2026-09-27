import { createEmitter } from '../core/emitter.js';
import { present, wrongAnswer } from '../learning/math-facts.js';
import { spokenAnswer, verdictIn } from '../learning/numbers.js';
import { matchNames } from '../voice/name-match.js';
import { matchCommand } from '../voice/commands.js';
import { sfx } from '../audio/sfx.js';
import {
  HAND_LINES, ANSWER_LINES, ASK_LINES, PROUD_LINES, FIX_ASK_LINES, THANKS_LINES, CLASS_WOW_LINES,
  DISAGREE_LINES, CATCH_LINES, fillMath, pickFrom,
} from '../students/lines.js';

export const LESSON_LENGTH = 8;
const TEACH_SHARE = 0.7; // how many problems are "judge a student" vs "you answer"

/**
 * Math time. Each problem is one of two kinds of turn:
 *
 *  teach  (learning by teaching)
 *    'hands'   students raise hands; she picks one (tap or say the name)
 *    'judge'   the student answers (sometimes wrong on purpose); she says
 *              Right or Not right
 *    'correct' if she caught a mistake, she gives the right answer
 *
 *  direct
 *    'answer'  a student asks "Teacher, what's 6 × 7?"; she answers
 *
 *  'review'  after a slip: the right answer and dots stay on the board until Next
 *  'done'    summary, stars, cheering
 *
 * Every answer she gives or judges is recorded in the learning progress,
 * which decides what comes next.
 * Events: 'change' (state changed), 'unlocked' (a new table opened), 'end'
 */
export function createLesson({ learning, students, session, board }) {
  const events = createEmitter();
  let s = null; // the running lesson, or null

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

  function title() {
    return `Math time  ·  ${s.index} of ${LESSON_LENGTH}`;
  }

  function drawBoard(extra = {}) {
    s.boardState = { title: title(), problem: s.problem, answer: null, mark: null, correction: null, hint: s.hinted, ...s.boardState, ...extra };
    board.problem(s.boardState);
  }

  // ---------------------------------------------------------------- flow
  function start() {
    if (s) return;
    if (session.state === 'free') session.startClass();
    const math = learning.math();
    s = {
      index: 0, results: [], phase: 'intro', turn: null, problem: null, student: null, studentAnswer: null,
      tries: 0, hinted: false, shownAt: 0, timer: 0, feedback: null, boardState: null, packTitle: math.pack.title,
    };
    board.message('Math time!', math.pack.title);
    events.emit('change', s);
    later(2200, next);
  }

  function next() {
    if (!s) return;
    students.lowerHands();
    if (s.index >= LESSON_LENGTH) {
      finish();
      return;
    }
    const math = learning.math();
    const problem = present(math.pick());
    const kids = students.presentStudents();
    s.index += 1;
    Object.assign(s, { problem, tries: 0, hinted: false, student: null, studentAnswer: null, feedback: null, boardState: null });
    s.turn = kids.length && Math.random() < TEACH_SHARE ? 'teach' : 'direct';
    drawBoard();

    if (s.turn === 'teach') {
      const hands = shuffle(kids).slice(0, Math.min(kids.length, 2 + Math.floor(Math.random() * 3)));
      students.raiseHands(hands);
      hands.slice(0, 2).forEach((k) => students.bubble(k, pickFrom(HAND_LINES), 2));
      setPhase('hands', { hands });
    } else {
      const asker = pickFrom(kids);
      s.asker = asker ?? null;
      if (asker) students.say(asker, fillMath(pickFrom(ASK_LINES), { q: problem.spoken }), { bubbleSeconds: 4 });
      setPhase('answer', { shownAt: now() });
    }
  }

  function finish() {
    const right = s.results.filter(Boolean).length;
    const total = s.results.length;
    const cheer = right === total ? 'Perfect!' : right >= total * 0.75 ? 'Great teaching!' : 'Good practice!';
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

  /** Save how she did on this problem. */
  function record(correct, ms) {
    const { unlocked } = learning.math().record(s.problem.fact.key, correct, { ms, hinted: s.hinted });
    learning.logProblem(correct, ms);
    s.results.push(correct);
    learning.save();
    if (unlocked) events.emit('unlocked', unlocked);
  }

  // ---------------------------------------------------------------- actions
  /** She picks who answers (a raised hand, or anyone who's here). */
  function choose(student) {
    if (!s || s.phase !== 'hands') return false;
    students.lowerHands();
    const wrong = Math.random() < learning.mistakeRate();
    const answer = wrong ? wrongAnswer(s.problem) : s.problem.answer;
    students.say(student, fillMath(pickFrom(ANSWER_LINES), { n: answer }), { sound: true });
    drawBoard({ answer });
    setPhase('thinking', { student, studentAnswer: answer });
    later(1300, () => setPhase('judge', { shownAt: now() }));
    return true;
  }

  function chooseRandom() {
    const pool = s?.hands?.length ? s.hands : students.presentStudents();
    const pick = pickFrom(pool);
    return pick ? choose(pick) : false;
  }

  /** She decides if the student was right. */
  function judge(verdict) {
    if (!s || s.phase !== 'judge') return false;
    const p = s.problem;
    const ms = now() - s.shownAt;
    const studentRight = s.studentAnswer === p.answer;
    const says = (lines, n = p.answer) => fillMath(pickFrom(lines), { n, q: p.spoken });

    if (verdict === 'right' && studentRight) {
      record(true, ms);
      learning.addStar(s.student.id);
      learning.teacherStar();
      sfx.chime();
      drawBoard({ mark: 'right' });
      students.celebrate(s.student);
      students.say(s.student, pickFrom(PROUD_LINES));
      feedback(`Yes! ${p.text} = ${p.answer}. ${s.student.name} gets a ⭐`, 'good');
      setPhase('praise');
      later(2600, next);
    } else if (verdict === 'wrong' && !studentRight) {
      // good catch! now she gives the right answer (recorded then)
      sfx.pop();
      drawBoard({ mark: 'wrong' });
      students.say(s.student, pickFrom(FIX_ASK_LINES));
      feedback('Good catch! What is the right answer?', 'good');
      setPhase('correct', { shownAt: now() });
    } else if (verdict === 'right' && !studentRight) {
      // she missed the mistake: a classmate notices
      record(false, ms);
      s.hinted = true;
      const helper = pickFrom(students.presentStudents().filter((k) => k.id !== s.student.id)) ?? s.student;
      students.say(helper, says(CATCH_LINES));
      drawBoard({ mark: 'wrong', correction: p.answer, hint: true });
      feedback(`Oops! ${p.text} is ${p.answer}, not ${s.studentAnswer}. Look at the dots!`, 'oops');
      setPhase('review');
    } else {
      // the student was right after all
      record(false, ms);
      s.hinted = true;
      students.say(s.student, says(DISAGREE_LINES));
      drawBoard({ mark: 'right', hint: true });
      feedback(`${s.student.name} was right: ${p.text} = ${p.answer}. Count the dots!`, 'oops');
      setPhase('review');
    }
    return true;
  }

  /** She gives an answer (after catching a mistake, or when asked directly). */
  function answer(n) {
    if (!s || (s.phase !== 'answer' && s.phase !== 'correct')) return false;
    const p = s.problem;
    const ms = now() - s.shownAt;
    const fixing = s.phase === 'correct';
    if (n === p.answer) {
      record(true, ms);
      learning.teacherStar();
      sfx.chime();
      if (fixing) {
        learning.addStar(s.student.id); // for being brave and trying
        drawBoard({ mark: 'wrong', correction: n });
        students.celebrate(s.student);
        students.say(s.student, fillMath(pickFrom(THANKS_LINES), { n }));
      } else {
        drawBoard({ answer: n, mark: 'right' });
        students.cheer();
        const fan = pickFrom(students.presentStudents());
        if (fan) students.say(fan, pickFrom(CLASS_WOW_LINES));
      }
      feedback(`Yes! ${p.text} = ${p.answer} ⭐`, 'good');
      setPhase('praise');
      later(2600, next);
      return true;
    }
    s.tries += 1;
    sfx.uncheck();
    if (s.tries === 1) {
      s.hinted = true;
      drawBoard({ hint: true });
      feedback(`Not ${n}. Let's count the dots and try again!`, 'try');
      events.emit('change', s);
    } else {
      record(false, ms);
      drawBoard(fixing ? { mark: 'wrong', correction: p.answer } : { answer: p.answer, mark: 'right' });
      feedback(`${p.text} = ${p.answer}. We'll practice it again soon!`, 'oops');
      setPhase('review');
    }
    return true;
  }

  function hint() {
    if (!s || !s.problem || s.hinted) return;
    s.hinted = true;
    drawBoard({ hint: true });
    events.emit('change', s);
  }

  // ---------------------------------------------------------------- voice
  /**
   * Catcher for voice control while a lesson runs (see voice-control.js).
   * Names pick a student, "Correct!"/"Try again" judge, numbers answer.
   */
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
          if (!v) continue;
          judge(v);
          // "No, it's 42!" judges and answers in one go
          const n = spokenAnswer(alt.text);
          if (v === 'wrong' && n !== null && s?.phase === 'correct') answer(n);
          return v === 'right' ? 'Right!' : 'Not right!';
        }
        if (matchCommand(alternatives)) return false;
        return { ok: false, label: 'Say “Correct!” or “Try again!”' };
      }
      case 'answer':
      case 'correct': {
        for (const alt of alternatives) {
          const n = spokenAnswer(alt.text);
          if (n !== null) {
            answer(n);
            return String(n);
          }
        }
        if (matchCommand(alternatives)) return false;
        return { ok: false, label: 'Say the answer, like “42”' };
      }
      case 'review':
      case 'done':
        if (/\b(next|okay|ok|again|go)\b/i.test(text) && s.phase === 'review') {
          next();
          return 'Next!';
        }
        return false;
      default:
        return false;
    }
  }

  // class ending ends the lesson too
  session.on('state', (state) => { if (state === 'free') stop(); });

  return {
    on: events.on,
    start,
    stop,
    next,
    choose,
    chooseRandom,
    judge,
    answer,
    hint,
    hear,
    get active() {
      return Boolean(s);
    },
    get state() {
      return s;
    },
  };
}
