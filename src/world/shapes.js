import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonVertex } from './materials.js';

/*
 * Shape toolkit: every model in the game is built from these primitives.
 *  - geo.*    cached geometries (the same size is only built once)
 *  - part()   a mesh with position/rotation/scale and shadow flags
 *  - bake()   merges a group's still meshes into one mesh per material,
 *             so a whole room draws in a few dozen calls
 */

const cache = new Map();
const cached = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};
const key = (...parts) => parts.map((p) => (typeof p === 'number' ? +p.toFixed(3) : p)).join(',');

export const geo = {
  /** Rounded box (the workhorse). */
  rbox: (w, h, d, r = 0.06) => cached(key('rbox', w, h, d, r), () => {
    const radius = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    return new RoundedBoxGeometry(w, h, d, 2, radius);
  }),
  /** 1x1x1 box, meant to be sized with scale. */
  box: () => cached('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: (rTop, rBottom, h, seg = 16) => cached(key('cyl', rTop, rBottom, h, seg), () => new THREE.CylinderGeometry(rTop, rBottom, h, seg)),
  sphere: (r, w = 16, h = 12) => cached(key('sph', r, w, h), () => new THREE.SphereGeometry(r, w, h)),
  /** Top half of a sphere, flat side at y = 0. */
  dome: (r, seg = 16) => cached(key('dome', r, seg), () => new THREE.SphereGeometry(r, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
  capsule: (r, len, radial = 12) => cached(key('cap', r, len, radial), () => new THREE.CapsuleGeometry(r, len, 4, radial)),
  torus: (R, t, radial = 8, tubular = 24) => cached(key('tor', R, t, radial, tubular), () => new THREE.TorusGeometry(R, t, radial, tubular)),
  /** Top part of a sphere down to `fraction` of the way to the bottom (0.5 = dome). */
  cap: (r, fraction, seg = 20) => cached(key('capS', r, fraction, seg), () => new THREE.SphereGeometry(r, seg, 12, 0, Math.PI * 2, 0, Math.PI * fraction)),
  cone: (r, h, seg = 12) => cached(key('cone', r, h, seg), () => new THREE.ConeGeometry(r, h, seg)),
  /** Part of a ring; with arc = PI and rotated upside down it makes a smile. */
  arc: (R, t, arc = Math.PI) => cached(key('arc', R, t, arc), () => new THREE.TorusGeometry(R, t, 6, 14, arc)),
  plane: (w, h) => cached(key('pln', w, h), () => new THREE.PlaneGeometry(w, h)),
  circle: (r, seg = 32) => cached(key('cir', r, seg), () => new THREE.CircleGeometry(r, seg)),
};

/**
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {{at?: number[], rot?: number[], scale?: number|number[], shadow?: boolean, receive?: boolean}} [opts]
 */
export function part(geometry, material, { at = [0, 0, 0], rot = [0, 0, 0], scale = 1, shadow = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(at[0], at[1], at[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  if (typeof scale === 'number') m.scale.setScalar(scale);
  else m.scale.set(scale[0], scale[1], scale[2]);
  m.castShadow = shadow;
  m.receiveShadow = receive;
  return m;
}

/** A group positioned in its parent. */
export function group({ at = [0, 0, 0], rot = [0, 0, 0] } = {}, ...children) {
  const g = new THREE.Group();
  g.position.set(at[0], at[1], at[2]);
  g.rotation.set(rot[0], rot[1], rot[2]);
  if (children.length) g.add(...children);
  return g;
}

const hitMaterial = new THREE.MeshBasicMaterial({ visible: false });

/** Invisible sphere that makes a small object easier to tap. Never drawn, only tapped. */
export function hitProxy(radius, at = [0, 0, 0]) {
  const m = new THREE.Mesh(geo.sphere(radius, 8, 6), hitMaterial);
  m.position.set(at[0], at[1], at[2]);
  return m;
}

/** Mark an object as moving/tappable so bake() leaves it alone. */
export function live(obj) {
  obj.userData.live = true;
  return obj;
}

/**
 * Merge all still meshes under `root` into one mesh per material (+ shadow
 * flags). Objects marked live() and their children are kept as they are.
 * Empty groups are left behind as harmless transforms.
 */
export function bake(root) {
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const meshes = [];
  (function visit(o) {
    if (o !== root && o.userData.live) return;
    if (o.isMesh && o.material.visible !== false) meshes.push(o);
    o.children.forEach(visit);
  })(root);

  const buckets = new Map();
  const m4 = new THREE.Matrix4();
  for (const mesh of meshes) {
    const bucketKey = `${mesh.material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}`;
    let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    }
    g.morphAttributes = {};
    g.clearGroups();
    g.applyMatrix4(m4.multiplyMatrices(toRoot, mesh.matrixWorld));
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, { mesh, parts: [] });
    buckets.get(bucketKey).parts.push(g);
    mesh.removeFromParent();
  }

  for (const { mesh, parts } of buckets.values()) {
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    const out = new THREE.Mesh(merged, mesh.material);
    out.castShadow = mesh.castShadow;
    out.receiveShadow = mesh.receiveShadow;
    out.userData.baked = true;
    root.add(out);
  }
  return root;
}

/**
 * Merge every mesh passed in (in the caller's coordinate space) into ONE mesh
 * that stores each part's color per vertex. A whole body part (a head with
 * eyes, hair and glasses) then costs a single draw call.
 * The returned mesh owns its geometry: call geometry.dispose() when done.
 */
export function solid(...meshes) {
  const holder = new THREE.Group();
  holder.add(...meshes);
  holder.updateMatrixWorld(true);
  const parts = [];
  holder.traverse((o) => {
    if (!o.isMesh || o.material.visible === false) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    g.clearGroups();
    g.applyMatrix4(o.matrixWorld);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const { r, g: gr, b } = o.material.color;
    for (let i = 0; i < count; i++) {
      colors[i * 3] = r;
      colors[i * 3 + 1] = gr;
      colors[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(g);
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  const mesh = new THREE.Mesh(merged, toonVertex());
  mesh.userData.ownsGeometry = true;
  return mesh;
}

/** Remove everything under a group, freeing geometries made by bake(). */
export function clearGroup(g) {
  g.traverse((o) => { if (o.userData.baked) o.geometry.dispose(); });
  g.clear();
}
