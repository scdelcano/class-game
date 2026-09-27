import * as THREE from 'three';

/** Walking/driving speed (units per second) and how fast each type turns. */
export const SPEED = { kid: 1.5, plush: 1.1, truck: 2.2, tank: 1.4 };
const TURN_RATE = { kid: 9, plush: 8, truck: 4, tank: 3.5 };
/** Personal space, for not bumping into each other. */
export const RADIUS = { kid: 0.3, plush: 0.34, truck: 0.5, tank: 0.48 };

/** Facing angle that points a character at the camera (camera sits at 45°). */
export const TOWARD_CAMERA = Math.PI / 4;

/**
 * One student in the room: their 3D character plus movement.
 * The class manager (class-actors.js) decides *where* to go; the actor
 * follows the path, turns smoothly, and waits politely when someone is in
 * the way (stepping aside a little).
 */
export class Actor {
  constructor(student, character) {
    this.student = student;
    this.character = character;
    /** What the manager has this student doing: 'idle' | 'walk' | 'toSeat' | 'seated'. */
    this.brain = 'idle';
    this.path = [];
    this.arrive = null;
    this.speedScale = 1;
    this.ignoreOthers = false; // set when stuck for too long, so nobody is stuck forever
    this.blocked = 0; // seconds spent waiting for someone to move
    this.wait = 0; // idle countdown
    this.pauseUntil = 0; // stand still until this time (e.g. while talking)
    this.lookUntil = 0; // face the teacher (camera) until this time
    this.faceTarget = null; // angle to turn to when standing still
    this.chatAt = 0;
    this.dest = null;
    this.seatIndex = -1; // desk this student should use
    this.sittingAt = -1; // desk they are sitting at right now (-1 = not sitting)
  }

  get type() {
    return this.student.type;
  }

  get pos() {
    return this.character.root.position;
  }

  get radius() {
    return RADIUS[this.type];
  }

  get moving() {
    return this.path.length > 0;
  }

  /** Walk to (x, z) around furniture. Returns false if there's no way there. */
  moveTo(nav, x, z, { onArrive = null, speedScale = 1 } = {}) {
    const path = nav.findPath(this.pos, { x, z });
    if (!path) return false;
    this.path = path;
    this.arrive = onArrive;
    this.speedScale = speedScale;
    this.blocked = 0;
    this.dest = { x, z };
    return true;
  }

  stop() {
    this.path = [];
    this.arrive = null;
  }

  update(dt, now, others, nav) {
    const root = this.character.root;
    let speed = 0;
    let heading = null;

    if (this.path.length && now >= this.pauseUntil) {
      const target = this.path[0];
      const dx = target.x - this.pos.x;
      const dz = target.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.08) {
        this.path.shift();
        if (!this.path.length) {
          const done = this.arrive;
          this.arrive = null;
          done?.(this);
        }
      } else {
        const fx = dx / dist;
        const fz = dz / dist;
        heading = Math.atan2(dx, dz);
        const align = Math.max(0, Math.cos(angleDiff(heading, root.rotation.y)));
        speed = SPEED[this.type] * this.speedScale * align * align; // slow down to turn
        if (!this.ignoreOthers && this.blockedBy(others, fx, fz)) {
          speed = 0;
          this.blocked += dt;
          // shuffle a little to the right to get around them
          const sx = this.pos.x + fz * 0.6 * dt;
          const sz = this.pos.z - fx * 0.6 * dt;
          if (nav.isFree(sx, sz)) this.pos.set(sx, 0, sz);
        } else {
          this.blocked = Math.max(0, this.blocked - dt * 0.5);
        }
        const step = Math.min(speed * dt, dist);
        this.pos.x += fx * step;
        this.pos.z += fz * step;
      }
    }

    let face = heading;
    if (now < this.lookUntil) face = TOWARD_CAMERA;
    else if (face === null) face = this.faceTarget;
    if (face !== null) root.rotation.y = turnToward(root.rotation.y, face, TURN_RATE[this.type] * dt);
    root.rotation.y = angleDiff(root.rotation.y, 0); // keep within -PI..PI

    this.character.speed = speed;
    this.character.update(dt);
  }

  /** Is another (standing) student right in front of us? */
  blockedBy(others, fx, fz) {
    for (const o of others) {
      if (o === this || o.sittingAt >= 0) continue;
      const ox = o.pos.x - this.pos.x;
      const oz = o.pos.z - this.pos.z;
      const d = Math.hypot(ox, oz);
      if (d > 0.001 && d < this.radius + o.radius + 0.12 && (ox * fx + oz * fz) / d > 0.55) return true;
    }
    return false;
  }
}

/** Signed smallest difference between two angles. */
export function angleDiff(a, b) {
  return THREE.MathUtils.euclideanModulo(a - b + Math.PI, Math.PI * 2) - Math.PI;
}

/** Smoothly rotate an angle toward a target the short way round. */
export function turnToward(current, target, k) {
  return current + angleDiff(target, current) * Math.min(1, k);
}
