import * as THREE from 'three';
import { hitProxy } from '../world/shapes.js';
import { buildKid } from './kid.js';
import { buildPlush } from './plush.js';
import { buildTruck } from './truck.js';
import { buildTank } from './tank.js';

const BUILDERS = { kid: buildKid, plush: buildPlush, truck: buildTruck, tank: buildTank };

/** How long each one-off action lasts (seconds). */
const ACTIONS = { wave: 1.6, hop: 0.55, hop2: 1.0, cheer: 1.6, spin: 0.9, look: 1.4, wheelie: 1.1, standUp: 1.8 };

/** The move each type does when tapped. */
export const REACTION = { kid: 'wave', plush: 'hop2', truck: 'wheelie', tank: 'look' };

let shadowTexture = null;
let shadowMaterial = null;
const shadowGeometry = new THREE.CircleGeometry(1, 24);

/** Soft round "blob" shadow under a character (cheaper than real shadows). */
function blobShadow(radius) {
  if (!shadowMaterial) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.9)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    shadowTexture = new THREE.CanvasTexture(c);
    shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, color: '#5a3a1a', transparent: true, opacity: 0.35, depthWrite: false });
  }
  const m = new THREE.Mesh(shadowGeometry, shadowMaterial);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  m.scale.setScalar(radius);
  m.renderOrder = -1;
  return m;
}

/**
 * A student's 3D body plus all of its animation. Movement code
 * (students/actor.js) sets `speed` while walking or driving; everything else
 * is play(), talk() and setPose().
 *
 * Structure: root (placed on the floor, turned to face a direction)
 *              ├─ shadow
 *              └─ body (hops, spins, squashes) ─ parts with pivots
 */
export class Character {
  /** @param {'kid'|'plush'|'truck'|'tank'} type */
  constructor(type, look) {
    const rig = BUILDERS[type](look);
    this.type = type;
    this.info = rig.info;
    this.pivots = rig.pivots;
    this.body = rig.body;
    this.shadow = blobShadow(rig.info.shadowRadius);
    this.body.add(hitProxy(rig.info.hitRadius, [0, rig.info.hitY, 0]));
    this.root = new THREE.Group();
    this.root.add(this.shadow, this.body);

    this.pose = 'stand';
    this.sit = 0; // 0 standing .. 1 seated, eased so sitting down is smooth
    this.time = Math.random() * 10; // so a class doesn't bob in sync
    this.action = null;
    this.talkLeft = 0;
    this.speed = 0;
    this.stride = 0;
    this.handUp = false; // "I know! Pick me!" during lessons
    this.update(0);
  }

  /** 'stand' or 'sit' (vehicles always stand). */
  setPose(pose) {
    this.pose = pose;
  }

  /** One-off move: 'wave', 'hop', 'hop2', 'cheer', 'spin', 'look', 'wheelie'. */
  play(kind) {
    this.action = { kind, t: 0, duration: ACTIONS[kind] ?? 1 };
  }

  /** The type's own tap reaction. */
  react() {
    this.play(REACTION[this.type]);
  }

  /** Bob the head (or cannon, or truck nose) while speaking. */
  talk(seconds) {
    this.talkLeft = Math.max(this.talkLeft, seconds);
  }

  /** World position just above the character's head (for speech bubbles). */
  topPosition(target = new THREE.Vector3()) {
    target.set(0, this.info.height + (this.info.seatLift ?? 0) * this.sit + this.body.position.y * 0.5 + 0.15, 0);
    return this.root.localToWorld(target);
  }

  update(dt) {
    const p = this.pivots;
    const info = this.info;
    this.time += dt;
    const t = this.time;
    const moving = this.speed > 0.05;
    const wantSit = this.pose === 'sit' && !info.drives ? 1 : 0;
    this.sit += (wantSit - this.sit) * (dt ? Math.min(1, dt * 7) : 1);
    const sitting = this.sit > 0.5;
    this.stride += dt * this.speed * 7;

    let lift = info.seatLift ? info.seatLift * this.sit : 0;
    let squash = Math.sin(t * 2.2) * 0.012; // breathing
    let spin = 0;
    let tilt = 0;
    let pitch = 0;

    if (p.legL) {
      const swing = moving ? Math.sin(this.stride) * 0.6 : 0;
      p.legL.rotation.x = info.sitLegAngle * this.sit + swing * (1 - this.sit);
      p.legR.rotation.x = info.sitLegAngle * this.sit - swing * (1 - this.sit);
      p.armL.rotation.x = moving ? -swing * 0.8 : 0;
      p.armR.rotation.x = moving ? swing * 0.8 : 0;
      p.armL.rotation.z = p.armL.userData.rest - Math.sin(t * 2) * 0.03;
      p.armR.rotation.z = p.armR.userData.rest + Math.sin(t * 2) * 0.03;
      p.head.rotation.set(0, 0, Math.sin(t * 1.3) * 0.04);
      if (moving) {
        lift += Math.abs(Math.sin(this.stride)) * 0.05;
        if (info.waddles) tilt = Math.sin(this.stride) * 0.12;
      }
    }
    if (p.wheels) {
      for (const w of p.wheels) w.rotation.x += (dt * this.speed) / p.wheelRadius;
      p.chassis.position.y = moving ? Math.abs(Math.sin(t * 18)) * 0.02 : Math.sin(t * 30) * 0.004; // engine rumble
      p.chassis.rotation.x = 0;
    }
    if (p.turret) {
      p.hull.position.y = moving ? Math.abs(Math.sin(t * 16)) * 0.015 : 0;
      p.turret.rotation.y = Math.sin(t * 0.5) * 0.15;
      p.cannon.rotation.x = 0;
    }

    if (this.handUp && !this.action) {
      // kids and plushies raise an arm; tanks raise the cannon; trucks bounce
      if (p.armR) {
        p.armR.rotation.z = 2.75 + Math.sin(t * 7) * 0.12;
        p.head.rotation.z = -0.1;
      } else if (p.cannon) {
        p.cannon.rotation.x = -0.55 + Math.sin(t * 6) * 0.06;
        p.turret.rotation.y = 0;
      } else {
        lift += Math.abs(Math.sin(t * 7)) * 0.07;
      }
    }

    if (this.talkLeft > 0) {
      this.talkLeft -= dt;
      const k = Math.sin(t * 16);
      if (p.head) p.head.rotation.x = k * 0.07;
      else if (p.cannon) p.cannon.rotation.x = -Math.abs(k) * 0.2;
      else if (p.chassis) p.chassis.rotation.x = k * 0.03;
    }

    const a = this.action;
    if (a) {
      a.t += dt;
      const k = Math.min(1, a.t / a.duration);
      const fade = 1 - k;
      switch (a.kind) {
        case 'wave':
          if (p.armR) p.armR.rotation.z = 2.5 + Math.sin(a.t * 12) * 0.35;
          else lift += Math.sin(k * Math.PI) * 0.3;
          break;
        case 'hop':
          lift += Math.sin(k * Math.PI) * 0.35;
          break;
        case 'hop2':
          lift += Math.abs(Math.sin(k * Math.PI * 2)) * 0.3;
          if (p.armR) {
            p.armR.rotation.z = p.armR.userData.rest + Math.sin(k * Math.PI) * 1.8;
            p.armL.rotation.z = p.armL.userData.rest - Math.sin(k * Math.PI) * 1.8;
          }
          break;
        case 'cheer':
          lift += Math.abs(Math.sin(k * Math.PI * 2)) * 0.3;
          if (p.armR) {
            p.armR.rotation.z = 2.7 + Math.sin(a.t * 10) * 0.2;
            p.armL.rotation.z = -2.7 - Math.sin(a.t * 10) * 0.2;
          }
          break;
        case 'spin':
          spin = (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2) * Math.PI * 2;
          break;
        case 'look':
          if (p.turret) {
            p.turret.rotation.y = Math.sin(k * Math.PI * 4) * 0.6 * fade;
            p.cannon.rotation.x = -Math.sin(k * Math.PI * 2) * 0.3 * fade;
          }
          lift += Math.abs(Math.sin(k * Math.PI * 3)) * 0.06;
          break;
        case 'wheelie':
          pitch = -Math.sin(k * Math.PI) * 0.35;
          lift += Math.sin(-pitch) * 0.3;
          if (p.wheels) for (const w of p.wheels) w.rotation.x += dt * 12 * fade;
          break;
        case 'standUp':
          // pop up out of the chair, wave, sit back down (attendance)
          if (sitting) lift += Math.sin(k * Math.PI) * 0.45;
          if (p.armR) p.armR.rotation.z = 2.5 + Math.sin(a.t * 12) * 0.35 * Math.sin(k * Math.PI);
          else lift += Math.abs(Math.sin(k * Math.PI * 2)) * 0.25;
          break;
        default:
          break;
      }
      if (k >= 1) this.action = null;
    }

    this.body.position.y = lift;
    this.body.rotation.set(pitch, spin, tilt);
    this.body.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);
  }

  /** Free the GPU memory for this character's merged meshes. */
  dispose() {
    this.root.traverse((o) => {
      if (o.userData.ownsGeometry) o.geometry.dispose();
    });
    this.root.removeFromParent();
  }
}
