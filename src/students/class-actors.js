import * as THREE from 'three';
import { Character } from '../characters/character.js';
import { NavGrid } from '../world/nav.js';
import { START_SEATS, WALK_AREA, DOOR_SPOT, HOTSPOTS } from '../world/layout.js';
import { Actor } from './actor.js';
import {
  TAP_LINES, CHAT_LINES, REPLY_LINES, START_CLASS_LINES, DISMISS_LINES, QUIET_LINES, HERE_LINES, STILL_HERE_LINES,
  ABSENT_LINES, CHEER_LINES, pickLine, pickFrom, fillPronoun,
} from './lines.js';
import { speakAs, speechSeconds } from '../voice/student-voice.js';
import { stopSpeaking } from '../voice/speech-output.js';

const isVehicle = (s) => s.type === 'truck' || s.type === 'tank';
const rand = (a, b) => a + Math.random() * (b - a);

/** Little moves students do on their own while playing. */
const IDLE_MOVES = { kid: ['hop', 'spin', 'wave'], plush: ['hop', 'hop2', 'spin'], truck: ['wheelie', 'spin'], tank: ['look', 'spin'] };

/**
 * All the students in the room and what they're doing.
 *
 *   phase 'free'     free play: wander, stop, bounce, chat
 *   phase 'seating'  everyone is heading to their desk
 *   phase 'class'    everyone is seated
 *
 * Students who are absent today (see game/attendance.js) are not in the
 * room: hidden, not tappable, and their desk stays empty.
 *
 * The game (game/session.js) calls goToSeats(), dismiss() and quiet();
 * attendance calls answer(), explainAbsent(), cheer() and setAbsent().
 * Taps on students are handled here too.
 */
export function createClassActors({ classroom, roster, picker, bubbles }) {
  const group = new THREE.Group();
  group.name = 'students';
  classroom.root.add(group);

  const nav = new NavGrid(WALK_AREA);
  /** @type {Map<string, Actor>} */
  const actors = new Map();
  let list = []; // everyone, in seating order
  let present = []; // everyone who came to school today
  let seats = [];
  let tapHandler = null;
  let phase = 'free';
  let onAllSeated = null;
  let quietUntil = 0;
  let now = 0;
  const later = []; // [{ at, fn }] small timed follow-ups (chat replies)

  const appearance = (s) => `${s.type}|${JSON.stringify(s.look)}`;
  const schedule = (seconds, fn) => later.push({ at: now + seconds, fn });

  // ---------------------------------------------------------------- roster sync
  function makeActor(student) {
    const character = new Character(student.type, student.look);
    group.add(character.root);
    const actor = new Actor(student, character);
    actor.key = appearance(student);
    picker.add(character.root, () => (tapHandler ? tapHandler(actor.student) : react(actor)));
    return actor;
  }

  function dropActor(actor) {
    picker.remove(actor.character.root);
    bubbles.clear(actor.character);
    actor.character.dispose();
  }

  /** Match the room to the class list. */
  function sync(firstTime = false) {
    const students = roster.students;
    const ids = new Set(students.map((s) => s.id));
    for (const [id, actor] of actors) {
      if (!ids.has(id)) {
        dropActor(actor);
        actors.delete(id);
      }
    }
    const fresh = [];
    for (const s of students) {
      let actor = actors.get(s.id);
      if (actor && actor.key !== appearance(s)) {
        // new look: rebuild the body but keep where they are and what they're doing
        const old = actor;
        actor = makeActor(s);
        Object.assign(actor, { brain: old.brain, seatIndex: old.seatIndex, sittingAt: old.sittingAt, faceTarget: old.faceTarget });
        actor.pos.copy(old.pos);
        actor.character.root.rotation.y = old.character.root.rotation.y;
        actor.character.setPose(old.character.pose);
        actor.character.sit = old.character.sit;
        dropActor(old);
        if (old.absent) hide(actor);
        else if (old.brain === 'toSeat') sendToSeat(actor);
        else if (old.brain === 'walk' || old.brain === 'idle') rest(actor, 0.5);
        actors.set(s.id, actor);
      } else if (!actor) {
        actor = makeActor(s);
        actors.set(s.id, actor);
        fresh.push(actor);
      }
      actor.student = s;
    }
    list = students.map((s) => actors.get(s.id));
    updatePresent();
    rebuildSeats();

    for (const actor of fresh) {
      if (firstTime) scatter(actor);
      else {
        // new classmates come in through the door
        actor.pos.set(DOOR_SPOT.x, 0, DOOR_SPOT.z);
        actor.character.root.rotation.y = Math.PI / 2;
        if (phase === 'free') wander(actor);
      }
    }
    if (phase !== 'free') {
      for (const actor of present) if (actor.sittingAt !== actor.seatIndex && actor.brain !== 'toSeat') sendToSeat(actor);
      checkAllSeated();
    }
  }

  function updatePresent() {
    present = list.filter((a) => !a.absent);
  }

  // ---------------------------------------------------------------- absent today
  /** Not in the room at all. */
  function hide(actor) {
    actor.absent = true;
    actor.stop();
    standUp(actor);
    actor.brain = 'away';
    actor.character.root.visible = false;
    picker.remove(actor.character.root);
    bubbles.clear(actor.character);
  }

  /** Come in through the door (after being absent). */
  function arrive(actor) {
    actor.absent = false;
    actor.character.root.visible = true;
    picker.add(actor.character.root, () => (tapHandler ? tapHandler(actor.student) : react(actor)));
    actor.pos.set(DOOR_SPOT.x, 0, DOOR_SPOT.z);
    actor.character.root.rotation.y = Math.PI / 2;
    if (phase === 'free') wander(actor);
    else sendToSeat(actor);
  }

  /**
   * Who is absent today. With animate, students who become absent walk out
   * the door and students who come back walk in.
   * @param {Set<string>} ids
   */
  function setAbsent(ids, { animate = false } = {}) {
    for (const actor of list) {
      const away = ids.has(actor.student.id);
      if (away && !actor.absent) {
        actor.absent = true;
        if (animate && actor.character.root.visible) {
          standUp(actor);
          actor.brain = 'leaving';
          bubbles.say(actor.character, 'Bye!', 1.5);
          if (!actor.moveTo(nav, DOOR_SPOT.x, DOOR_SPOT.z, { onArrive: () => hide(actor) })) hide(actor);
        } else {
          hide(actor);
        }
      } else if (!away && actor.absent) {
        arrive(actor);
      }
    }
    updatePresent();
    checkAllSeated();
  }

  function rebuildSeats() {
    const chairless = new Set(list.flatMap((a, i) => (isVehicle(a.student) ? [i] : [])));
    classroom.setSeatCount(Math.max(START_SEATS, list.length), { chairless });
    nav.setObstacles(classroom.obstacles);
    seats = classroom.seats;
    list.forEach((actor, i) => {
      if (actor.sittingAt >= 0 && actor.sittingAt !== i) standUp(actor);
      actor.seatIndex = i;
    });
  }

  /** Put a student somewhere random, not on top of anyone (first launch). */
  function scatter(actor) {
    let p = nav.randomFree();
    for (let tries = 0; tries < 20; tries++) {
      if (list.every((o) => o === actor || o.absent || o.pos.distanceTo(new THREE.Vector3(p.x, 0, p.z)) > 1.2)) break;
      p = nav.randomFree();
    }
    actor.pos.set(p.x, 0, p.z);
    actor.character.root.rotation.y = rand(-Math.PI, Math.PI);
    rest(actor, rand(0.2, 3));
  }

  // ---------------------------------------------------------------- seats
  function seatSpot(actor) {
    const seat = seats[actor.seatIndex];
    const back = actor.character.info.parkOffset ?? 0;
    return {
      x: seat.position.x - Math.sin(seat.facing) * back,
      z: seat.position.z - Math.cos(seat.facing) * back,
      facing: seat.facing,
    };
  }

  function sendToSeat(actor, speedScale = 1.3) {
    standUp(actor);
    actor.brain = 'toSeat';
    actor.ignoreOthers = false;
    const spot = seatSpot(actor);
    if (!actor.moveTo(nav, spot.x, spot.z, { speedScale, onArrive: () => sitDown(actor) })) sitDown(actor);
  }

  function sitDown(actor) {
    const spot = seatSpot(actor);
    actor.stop();
    actor.pos.set(spot.x, 0, spot.z);
    actor.faceTarget = spot.facing;
    actor.character.setPose('sit');
    actor.sittingAt = actor.seatIndex;
    actor.brain = 'seated';
    actor.ignoreOthers = false;
    checkAllSeated();
  }

  function standUp(actor) {
    actor.sittingAt = -1;
    actor.character.setPose('stand');
    actor.faceTarget = null;
  }

  function checkAllSeated() {
    if (phase === 'seating' && present.every((a) => a.brain === 'seated')) {
      phase = 'class';
      const done = onAllSeated;
      onAllSeated = null;
      done?.();
    }
  }

  // ---------------------------------------------------------------- free play
  /** Stand around for a bit (maybe doing a little move). */
  function rest(actor, seconds = rand(2.5, 7)) {
    actor.brain = 'idle';
    actor.wait = seconds;
    actor.chatAt = Math.max(actor.chatAt, now + rand(1, 6));
    if (Math.random() < 0.35) actor.character.play(pickFrom(IDLE_MOVES[actor.type]));
  }

  function wander(actor) {
    const p = pickDestination(actor);
    actor.brain = 'walk';
    actor.ignoreOthers = false;
    if (!p || !actor.moveTo(nav, p.x, p.z, { onArrive: () => rest(actor) })) rest(actor, 1);
  }

  /** A fun spot (or anywhere) that isn't where someone else is heading. */
  function pickDestination(actor) {
    for (let tries = 0; tries < 10; tries++) {
      let p;
      if (Math.random() < 0.6) {
        const h = pickFrom(HOTSPOTS);
        p = nav.nearestFree(h.x + rand(-0.8, 0.8), h.z + rand(-0.8, 0.8));
      } else {
        p = nav.randomFree();
      }
      if (!p) continue;
      const farEnough = Math.hypot(p.x - actor.pos.x, p.z - actor.pos.z) > 1.5;
      const free = present.every((o) => o === actor || !o.dest || Math.hypot(o.dest.x - p.x, o.dest.z - p.z) > 0.9);
      if (farEnough && free) return p;
    }
    return nav.randomFree();
  }

  /** Say something to a nearby friend, who may answer. */
  function maybeChat(actor) {
    if (now < quietUntil || now < actor.chatAt || now < actor.pauseUntil) return;
    actor.chatAt = now + rand(7, 16);
    let friend = null;
    let best = 2.4;
    for (const o of present) {
      if (o === actor || o.brain !== 'idle') continue;
      const d = o.pos.distanceTo(actor.pos);
      if (d < best) {
        best = d;
        friend = o;
      }
    }
    if (!friend && Math.random() > 0.25) return;
    bubbles.say(actor.character, pickLine(CHAT_LINES, actor.student), 2.8);
    actor.character.talk(1.2);
    if (friend) {
      actor.faceTarget = Math.atan2(friend.pos.x - actor.pos.x, friend.pos.z - actor.pos.z);
      friend.faceTarget = Math.atan2(actor.pos.x - friend.pos.x, actor.pos.z - friend.pos.z);
      friend.wait = Math.max(friend.wait, 3);
      friend.chatAt = now + rand(7, 16);
      schedule(1.4, () => {
        if (friend.brain !== 'idle' || now < quietUntil) return;
        bubbles.say(friend.character, pickFrom(REPLY_LINES), 2.2);
        friend.character.talk(0.8);
        if (Math.random() < 0.5) friend.character.play(pickFrom(IDLE_MOVES[friend.type]));
      });
    }
  }

  function think(actor, dt) {
    switch (actor.brain) {
      case 'idle':
        if (phase !== 'free') break;
        actor.wait -= dt;
        if (actor.wait <= 0 && now >= actor.pauseUntil) {
          actor.faceTarget = null;
          wander(actor);
        } else {
          maybeChat(actor);
        }
        break;
      case 'walk':
        if (actor.blocked > 1.2) {
          actor.stop(); // someone's in the way: go somewhere else instead
          rest(actor, rand(0.3, 1));
        }
        break;
      case 'toSeat':
        if (actor.blocked > 1.5) actor.ignoreOthers = true; // squeeze past rather than wait forever
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- taps
  function react(actor) {
    const { student, character } = actor;
    const line = pickLine(TAP_LINES, student);
    actor.lookUntil = now + 3.5;
    actor.pauseUntil = now + 3;
    if (actor.brain === 'idle') actor.wait = Math.max(actor.wait, 3.5);
    character.react();
    character.talk(speechSeconds(line) + 0.5);
    bubbles.say(character, line, 3);
    speakAs(student, line);
  }

  // ---------------------------------------------------------------- commands
  /** Everyone to their desk. Calls onDone when the last one sits down. */
  function goToSeats(onDone) {
    phase = 'seating';
    onAllSeated = onDone;
    for (const actor of present) {
      if (actor.sittingAt === actor.seatIndex) continue;
      actor.pauseUntil = now + rand(0, 0.7); // don't all move on the exact same frame
      sendToSeat(actor);
      if (Math.random() < 0.3) bubbles.say(actor.character, pickFrom(START_CLASS_LINES), 2);
    }
    const talker = pickFrom(present);
    if (talker) speakAs(talker.student, pickFrom(START_CLASS_LINES), { sound: false });
    checkAllSeated();
  }

  /** Class is over: everyone gets up and plays. */
  function dismiss() {
    phase = 'free';
    onAllSeated = null;
    for (const actor of present) {
      standUp(actor);
      actor.stop();
      actor.ignoreOthers = false;
      rest(actor, rand(0.2, 1.6));
      if (Math.random() < 0.4) {
        bubbles.say(actor.character, pickFrom(DISMISS_LINES), 2);
        actor.character.play(isVehicle(actor.student) ? 'hop' : 'cheer');
      }
    }
    const talker = pickFrom(present);
    if (talker) speakAs(talker.student, pickFrom(DISMISS_LINES), { sound: false });
  }

  /** Shhh: stop talking, look at the teacher, no chatting for a while. */
  function quiet(seconds = 30) {
    quietUntil = now + seconds;
    stopSpeaking();
    for (const actor of present) {
      bubbles.clear(actor.character);
      actor.lookUntil = now + 2.5;
      actor.pauseUntil = now + 2.5;
      if (actor.brain === 'idle') actor.wait = Math.max(actor.wait, 2.5);
    }
    const few = [...present].sort(() => Math.random() - 0.5).slice(0, 2);
    few.forEach((a) => bubbles.say(a.character, pickFrom(QUIET_LINES), 2));
  }

  // ---------------------------------------------------------------- loop
  function update(dt) {
    now += dt;
    for (let i = later.length - 1; i >= 0; i--) {
      if (now >= later[i].at) later.splice(i, 1)[0].fn();
    }
    for (const actor of list) {
      if (!actor.character.root.visible) continue;
      think(actor, dt);
      actor.update(dt, now, present, nav);
    }
  }

  // ---------------------------------------------------------------- attendance
  /** Called by name: pop up (or wave), face the teacher, answer. Resolves when done talking. */
  function answer(student, { again = false } = {}) {
    const actor = actors.get(student.id);
    if (!actor || actor.absent) return Promise.resolve();
    const line = again ? pickFrom(STILL_HERE_LINES) : pickLine(HERE_LINES, student);
    actor.lookUntil = now + 3;
    actor.pauseUntil = now + 2.5;
    if (actor.brain === 'idle') actor.wait = Math.max(actor.wait, 3);
    if (actor.brain === 'seated') actor.character.play('standUp');
    else actor.character.react();
    actor.character.talk(speechSeconds(line) + 0.4);
    bubbles.say(actor.character, line, 2.5);
    return speakAs(student, line);
  }

  /** A classmate says why `student` isn't here. Returns the classmate (or null). */
  function explainAbsent(student) {
    const helpers = present.filter((a) => a.character.root.visible);
    const helper = pickFrom(helpers);
    if (!helper) return null;
    const line = fillPronoun(pickFrom(ABSENT_LINES[student.type] ?? ABSENT_LINES.kid), student);
    helper.lookUntil = now + 3.5;
    helper.pauseUntil = now + 3;
    if (helper.brain === 'seated') helper.character.play('standUp');
    else helper.character.play('hop');
    helper.character.talk(speechSeconds(line) + 0.4);
    bubbles.say(helper.character, line, 3.5);
    speakAs(helper.student, line, { sound: false });
    return helper.student;
  }

  // ---------------------------------------------------------------- lessons
  /** Students in the room today. */
  function presentStudents() {
    return present.filter((a) => a.character.root.visible).map((a) => a.student);
  }

  function raiseHands(studentsToRaise) {
    const ids = new Set(studentsToRaise.map((s) => s.id));
    for (const actor of present) actor.character.handUp = ids.has(actor.student.id);
  }

  function lowerHands() {
    for (const actor of list) actor.character.handUp = false;
  }

  /**
   * A student says something: bubble, voice, facing the teacher.
   * bubbleText shows something else in the bubble than what is said out
   * loud (spelling words are heard, not shown).
   */
  function say(student, text, { sound = false, bubbleSeconds = 3, bubbleText = text } = {}) {
    const actor = actors.get(student.id);
    if (!actor || actor.absent) return Promise.resolve();
    actor.lookUntil = now + Math.max(2.5, bubbleSeconds);
    actor.pauseUntil = now + 2;
    actor.character.talk(speechSeconds(text) + 0.3);
    bubbles.say(actor.character, bubbleText, bubbleSeconds);
    return speakAs(student, text, { sound });
  }

  /** Just the speech bubble (no voice), for background chatter. */
  function bubble(student, text, seconds = 2) {
    const actor = actors.get(student.id);
    if (actor && !actor.absent) bubbles.say(actor.character, text, seconds);
  }

  function celebrate(student) {
    const actor = actors.get(student.id);
    if (!actor || actor.absent) return;
    actor.lookUntil = now + 2.5;
    actor.character.play(isVehicle(student) ? 'hop2' : 'cheer');
  }

  /** Everyone cheers (attendance finished). */
  function cheer() {
    for (const actor of present) {
      actor.lookUntil = now + 2.5;
      actor.character.play(isVehicle(actor.student) ? 'hop2' : 'cheer');
      if (Math.random() < 0.5) bubbles.say(actor.character, pickFrom(CHEER_LINES), 2.2);
    }
    const talker = pickFrom(present);
    if (talker) speakAs(talker.student, 'Hooray!', { sound: false });
  }

  roster.on('change', () => sync(false));
  sync(true);

  return {
    update,
    react,
    goToSeats,
    dismiss,
    quiet,
    answer,
    explainAbsent,
    cheer,
    setAbsent,
    presentStudents,
    raiseHands,
    lowerHands,
    say,
    bubble,
    celebrate,
    /** Let another feature (attendance) take over taps on students; null to restore. */
    setTapHandler(fn) {
      tapHandler = fn;
    },
    nav,
    get phase() {
      return phase;
    },
    get actors() {
      return list.slice();
    },
    find(id) {
      return actors.get(id) ?? null;
    },
  };
}
