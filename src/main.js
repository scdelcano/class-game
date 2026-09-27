// "My Classroom" — game entry point: sets up the 3D scene, camera, input,
// the class, the screens, and the main loop.
import './styles/base.css';
import './styles/game.css';
import './styles/ui.css';
import * as THREE from 'three';
import { createRenderer } from './core/renderer.js';
import { CameraRig } from './core/camera-rig.js';
import { Picker } from './core/picker.js';
import { startLoop } from './core/loop.js';
import { updateAnimations } from './core/anim.js';
import { createClassroom } from './world/classroom.js';
import { addLights } from './world/lights.js';
import { createRoster } from './students/roster.js';
import { createClassActors } from './students/class-actors.js';
import { createPortraits } from './characters/portraits.js';
import { createHud } from './ui/hud.js';
import { createMicButton } from './ui/mic-button.js';
import { createSession } from './game/session.js';
import { createAttendance } from './game/attendance.js';
import { createClipboard } from './ui/clipboard.js';
import { matchNames } from './voice/name-match.js';
import { matchCommand } from './voice/commands.js';
import { createLearning } from './learning/store.js';
import { createLesson } from './game/lesson.js';
import { createLessonPanel } from './ui/lesson-panel.js';
import { createReadingLesson } from './game/reading-lesson.js';
import { createReadingPanel } from './ui/reading-panel.js';
import { showLessonChooser } from './ui/lesson-chooser.js';
import { createGrownups } from './ui/grownups.js';
import { createBoardWriter } from './world/board-writer.js';
import { createVoiceControl } from './voice/voice-control.js';
import { createBubbles } from './ui/bubbles.js';
import { createClassScreen } from './ui/class-screen.js';
import { createStudentEditor } from './ui/student-editor.js';
import { showToast } from './ui/toast.js';
import { sfx } from './audio/sfx.js';
import { registerServiceWorker } from './pwa.js';

registerServiceWorker();

// ------------------------------------------------------------------ 3D room
const canvas = document.getElementById('scene');
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera();
const view = createRenderer(canvas, scene);
const picker = new Picker(camera, canvas);

const classroom = createClassroom({ picker });
scene.add(classroom.root);
addLights(scene);

const rig = new CameraRig(camera, canvas, classroom.bounds);
rig.onTap = (x, y) => {
  sfx.unlock();
  picker.pick(x, y);
};

// ------------------------------------------------------------------ the class
const roster = createRoster();
if (!roster.saveOk) showToast("I can't save on this tablet, so changes will be lost.", { icon: '⚠️', seconds: 5 });
const bubbles = createBubbles(document.getElementById('bubbles'), camera, canvas);
const students = createClassActors({ classroom, roster, picker, bubbles });
const portraits = createPortraits(view);
const session = createSession({ classroom, students });
const attendance = createAttendance({ roster, students });
const learning = createLearning(roster);
const board = createBoardWriter(classroom.boardCanvas, classroom.boardTexture);
const lesson = createLesson({ learning, students, session, board });
const reading = createReadingLesson({ learning, students, session, board });

// ------------------------------------------------------------------ screens
// 'room' = playing in the classroom, 'class' = class list, 'editor' = make a student,
// 'grownups' = settings and progress
let mode = 'room';
function setMode(next) {
  mode = next;
  hud.visible = mode === 'room';
  bubbles.visible = mode === 'room';
  if (mode !== 'room') {
    voice.cancel();
    clipboard.close();
    lesson.stop();
    reading.stop();
  }
}

const editor = createStudentEditor({
  view,
  roster,
  portraits,
  onClose: () => {
    setMode('class');
    classScreen.show();
  },
});
const classScreen = createClassScreen({
  roster,
  portraits,
  starsFor: (id) => learning.starsFor(id),
  onEdit: (student) => {
    classScreen.hide();
    setMode('editor');
    editor.open(student);
  },
  onClose: () => setMode('room'),
});
const hud = createHud({
  onResetView: () => rig.reset(),
  onMyClass: () => {
    setMode('class');
    classScreen.open();
  },
  onBell: () => session.toggleClass(),
  onAttendance: () => openAttendance(),
  onLesson: () => showLessonChooser([
    { icon: '📝', label: 'Math', start: startLesson },
    { icon: '📖', label: 'Reading', start: startReading },
  ]),
  onGrownups: () => {
    setMode('grownups');
    grownups.open();
  },
});
const grownups = createGrownups({ learning, onClose: () => setMode('room') });

// ------------------------------------------------------------------ attendance
const clipboard = createClipboard({
  roster,
  attendance,
  portraits,
  onOpen: () => {
    lesson.stop(); // one side panel at a time
    reading.stop();
    hud.panelOpen = true;
    rig.setFocusArea(clipboard.freeArea());
    students.setTapHandler((student) => attendance.call(student, { via: 'tap' }));
    stopListeningForNames = voice.addCatcher(hearNames);
    mic.refresh();
  },
  onClose: () => {
    hud.panelOpen = false;
    rig.setFocusArea(1);
    students.setTapHandler(null);
    stopListeningForNames?.();
    stopListeningForNames = null;
    mic.refresh();
  },
});
let stopListeningForNames = null;

// ------------------------------------------------------------------ lessons
/** During lessons the camera frames the chalkboard and the desks. */
const LESSON_VIEW = new THREE.Box3(new THREE.Vector3(-4.2, 0, -6.2), new THREE.Vector3(7, 5.2, 5));
let stopLessonVoice = null;
const lessonPanel = createLessonPanel({
  lesson,
  onOpen: () => {
    clipboard.close();
    reading.stop();
    hud.panelOpen = true;
    rig.setFocusArea(lessonPanel.freeArea(), LESSON_VIEW);
    students.setTapHandler((student) => lesson.choose(student));
    stopLessonVoice = voice.addCatcher((alts, text) => lesson.hear(alts, text));
    mic.refresh();
  },
  onClose: () => {
    hud.panelOpen = false;
    rig.setFocusArea(1);
    students.setTapHandler(null);
    stopLessonVoice?.();
    stopLessonVoice = null;
    mic.refresh();
  },
});
lesson.on('change', () => mic.refresh());
lesson.on('unlocked', (family) => showToast(`New! The ${family.label} facts are unlocked!`, { icon: '🔓', seconds: 4 }));

function startLesson() {
  if (lesson.active) return;
  reading.stop();
  lesson.start();
}

let stopReadingVoice = null;
const readingPanel = createReadingPanel({
  lesson: reading,
  onMic: () => voice.toggle(),
  onOpen: () => {
    clipboard.close();
    lesson.stop();
    hud.panelOpen = true;
    rig.setFocusArea(readingPanel.freeArea(), LESSON_VIEW);
    students.setTapHandler((student) => reading.choose(student));
    stopReadingVoice = voice.addCatcher((alts, text) => reading.hear(alts, text));
    mic.refresh();
  },
  onClose: () => {
    hud.panelOpen = false;
    rig.setFocusArea(1);
    students.setTapHandler(null);
    stopReadingVoice?.();
    stopReadingVoice = null;
    mic.refresh();
  },
});
reading.on('change', () => mic.refresh());
reading.on('unlocked', (group) => showToast(`New words! “${group.label}” is unlocked!`, { icon: '🔓', seconds: 4 }));

function startReading() {
  if (reading.active) return;
  lesson.stop();
  reading.start();
}

/** Attendance happens in class: start class first if it's playtime. */
function openAttendance() {
  if (session.state === 'free') session.startClass();
  clipboard.open();
}

/** While the clipboard is open, names come before commands. */
function hearNames(alternatives, text) {
  const { confident, best } = matchNames(alternatives, roster.students);
  if (confident.length) {
    clipboard.hideGuess();
    // several names in one breath are called one after another
    confident.forEach((student, i) => setTimeout(() => attendance.call(student, { via: 'voice' }), i * 1800));
    return confident.map((s) => s.name).join(', ');
  }
  if (matchCommand(alternatives)) return false; // e.g. "class dismissed" still works
  if (best) {
    clipboard.showGuess(best.student, text);
    return { ok: true, label: `Did you mean ${best.student.name}?` };
  }
  return { ok: false, label: "I don't know that name. Tap it on the clipboard!" };
}

// ------------------------------------------------------------------ voice
// Add new spoken commands in voice/commands.js, then handle them here.
const voice = createVoiceControl();
voice.command('startClass', () => session.startClass());
voice.command('endClass', () => session.endClass());
voice.command('quiet', () => session.quiet());
voice.command('attendance', () => openAttendance());
voice.command('lesson', () => startLesson());
voice.command('reading', () => startReading());
const mic = createMicButton({
  voice,
  parent: hud.el,
  hint: () => {
    const rs = reading.state;
    if (rs) {
      return {
        hands: 'a name, like “Mia”',
        judge: '“Correct!” or “Try again!”',
        read: 'the word on the board',
        'fix-read': 'the word on the board',
        spell: 'the letters, or type them',
        'fix-spell': 'the letters, or type them',
      }[rs.phase] ?? '“Next!”';
    }
    const ls = lesson.state;
    if (ls) {
      return {
        hands: 'a name, like “Mia”',
        judge: '“Correct!” or “Try again!”',
        answer: `the answer to ${ls.problem?.text}`,
        correct: `the answer to ${ls.problem?.text}`,
      }[ls.phase] ?? '“Next!”';
    }
    if (clipboard.isOpen) {
      const next = attendance.nextUnmarked();
      return next ? `a name, like “${next.name}”` : '“Class dismissed!”';
    }
    return session.state === 'free' ? '“Okay class, take attendance!”' : '“Time for math!”';
  },
});
attendance.on('change', () => mic.refresh());
attendance.on('done', ({ here, absent }) => showToast(`${here} here, ${absent} absent. Great job, teacher!`, { icon: '🎉', seconds: 4 }));
attendance.on('newDay', () => showToast('Good morning! A brand new day!', { icon: '🌅' }));
session.on('state', (state) => {
  hud.setClassState(state);
  mic.refresh();
});
hud.setClassState(session.state);

function resize() {
  view.resize();
  rig.resize(canvas.clientWidth, canvas.clientHeight);
  if (clipboard.isOpen) rig.setFocusArea(clipboard.freeArea());
  if (lessonPanel.isOpen) rig.setFocusArea(lessonPanel.freeArea(), LESSON_VIEW);
  if (readingPanel.isOpen) rig.setFocusArea(readingPanel.freeArea(), LESSON_VIEW);
  editor.layout();
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ main loop
function tick(dt) {
  updateAnimations(dt);
  if (mode === 'room') {
    rig.update(dt);
    classroom.update(dt);
    students.update(dt);
    view.render(camera, dt);
    bubbles.update();
  } else if (mode === 'editor') {
    editor.update(dt);
    view.render(editor.camera, dt, editor.scene);
  }
  // 'class' covers the whole screen, so nothing is drawn (saves battery)
}
startLoop(tick);

// Handy in the browser console while developing.
if (import.meta.env.DEV) {
  Object.assign(window, { THREE, scene, camera, rig, classroom, view, picker, roster, students, portraits, editor, session, voice, attendance, clipboard, learning, lesson, reading });
  /** Fast-forward the game by `seconds` (for testing when the tab isn't animating). */
  window.advance = (seconds, fps = 30) => {
    for (let t = 0; t < seconds; t += 1 / fps) tick(1 / fps);
  };
}
