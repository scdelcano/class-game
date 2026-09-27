import * as THREE from 'three';
import { bake, clearGroup } from './shapes.js';
import { buildRoom, roomBounds } from './room.js';
import { buildBoard } from './furniture/board.js';
import { buildStudentDesk, buildTeacherDesk, STUDENT_DESK } from './furniture/desks.js';
import { buildBookshelf, buildCubbies } from './furniture/storage.js';
import { buildClock, buildFishbowl, buildPlant, buildPoster, buildRug } from './furniture/decor.js';
import { HALF_W, HALF_D, PLACES, SEAT_SLOTS, SEAT_FACING, MAX_SEATS, START_SEATS, getObstacles } from './layout.js';
import { createEmitter } from '../core/emitter.js';
import { squash, wiggle } from '../core/anim.js';
import { sfx } from '../audio/sfx.js';

/**
 * Builds the whole classroom and wires up its tappable props.
 *
 * Events (classroom.on(type, fn)):
 *   'bell'  the teacher tapped the bell (the session starts or ends class)
 *
 * @param {{picker: import('../core/picker.js').Picker}} deps
 */
export function createClassroom({ picker }) {
  const root = new THREE.Group();
  root.name = 'classroom';
  const events = createEmitter();
  const updaters = [];

  // ---------------------------------------------------------- still scenery
  const scenery = new THREE.Group();
  root.add(scenery);
  scenery.add(buildRoom());

  const board = buildBoard();
  board.group.position.set(PLACES.board.x, 0, -HALF_D);
  scenery.add(board.group);

  const teacher = buildTeacherDesk();
  teacher.group.position.set(PLACES.teacherDesk.x, 0, PLACES.teacherDesk.z);
  scenery.add(teacher.group);

  const clock = buildClock();
  clock.group.position.set(PLACES.clock.x, PLACES.clock.y, -HALF_D);
  scenery.add(clock.group);
  updaters.push(() => clock.update(new Date()));

  const shelf = buildBookshelf();
  shelf.position.set(PLACES.bookshelf.x, 0, -HALF_D);
  scenery.add(shelf);

  const rug = buildRug(PLACES.rug.r);
  rug.position.set(PLACES.rug.x, 0, PLACES.rug.z);
  scenery.add(rug);

  const cubbies = buildCubbies(PLACES.cubbies.length);
  cubbies.position.set(-HALF_W, 0, PLACES.cubbies.z);
  cubbies.rotation.y = Math.PI / 2;
  scenery.add(cubbies);

  const fishbowl = buildFishbowl();
  fishbowl.group.position.set(-HALF_W + 0.4, 1.53, PLACES.fishbowl.z);
  scenery.add(fishbowl.group);
  updaters.push((dt) => fishbowl.update(dt));

  const plant = buildPlant();
  plant.group.position.set(PLACES.plant.x, 0, PLACES.plant.z);
  scenery.add(plant.group);

  for (const p of PLACES.posters) {
    const poster = buildPoster(p.kind, p.small ? 0.75 : 1);
    if (p.wall === 'back') {
      poster.position.set(p.x, p.y, -HALF_D);
    } else {
      poster.position.set(-HALF_W, p.y, p.z);
      poster.rotation.y = Math.PI / 2;
    }
    scenery.add(poster);
  }

  bake(scenery);

  // ---------------------------------------------------------- desks
  const deskRoot = new THREE.Group();
  root.add(deskRoot);
  let seatCount = 0;

  /**
   * Show desks for n students (rebuilt and merged in one go; it's cheap).
   * @param {number} n
   * @param {{chairless?: Set<number>}} [opts] seat indexes that get no chair (vehicles)
   */
  function setSeatCount(n, { chairless = new Set() } = {}) {
    seatCount = THREE.MathUtils.clamp(n, 1, MAX_SEATS);
    clearGroup(deskRoot);
    SEAT_SLOTS.slice(0, seatCount).forEach(({ x, z }, i) => {
      const desk = buildStudentDesk(i, { chair: !chairless.has(i) });
      desk.position.set(x, 0, z);
      deskRoot.add(desk);
    });
    bake(deskRoot);
  }
  setSeatCount(START_SEATS);

  // ---------------------------------------------------------- taps
  function ringBell() {
    sfx.bell();
    squash(teacher.bellDome, { amount: 0.35, duration: 0.6 });
  }
  picker.add(teacher.bell, () => {
    ringBell();
    events.emit('bell');
  });
  picker.add(teacher.apple, () => {
    sfx.pop();
    wiggle(teacher.apple, { amount: 0.35 });
  });
  picker.add(plant.leaves, () => {
    sfx.rustle();
    wiggle(plant.leaves, { amount: 0.12, duration: 0.9 });
  });
  picker.add(fishbowl.tapTarget, () => {
    sfx.bubble();
    fishbowl.excite();
  });

  return {
    root,
    on: events.on,
    bounds: roomBounds(),
    boardCanvas: board.boardCanvas,
    boardTexture: board.boardTexture,
    setSeatCount,
    /** Ring the desk bell (sound + bounce) without starting/ending class. */
    ringBell,
    get seatCount() { return seatCount; },
    /** Where each student sits: chair position on the floor (world) and facing angle. */
    get seats() {
      return SEAT_SLOTS.slice(0, seatCount).map(({ x, z }, index) => ({
        index,
        position: new THREE.Vector3(x, 0, z + STUDENT_DESK.chairOffset),
        facing: SEAT_FACING,
      }));
    },
    get obstacles() { return getObstacles(seatCount); },
    update(dt, elapsed) {
      for (const fn of updaters) fn(dt, elapsed);
    },
  };
}
