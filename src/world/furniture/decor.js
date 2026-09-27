import * as THREE from 'three';
import { geo, part, group, live, hitProxy, bake } from '../shapes.js';
import { toon, toonMapped, unlit, glass, PALETTE } from '../materials.js';
import { clockTexture, posterTexture, rugTexture, windowViewTexture } from '../textures.js';

/*
 * Wall and room decorations. Unless noted, each builder's origin sits on the
 * wall surface and the front faces +z.
 */

/** Window with a sunny view, cross bars, sill and curtains. Origin = window centre. */
export function buildWindow() {
  const g = new THREE.Group();
  const white = toon(PALETTE.trim);
  const S = 2.0;
  g.add(part(geo.plane(S - 0.1, S - 0.1), unlit({ map: windowViewTexture() }), { at: [0, 0, 0.02], shadow: false }));
  for (const sy of [-1, 1]) g.add(part(geo.rbox(S + 0.1, 0.14, 0.16, 0.04), white, { at: [0, sy * S / 2, 0.08] }));
  for (const sx of [-1, 1]) g.add(part(geo.rbox(0.14, S + 0.1, 0.16, 0.04), white, { at: [sx * S / 2, 0, 0.08] }));
  g.add(part(geo.rbox(0.07, S, 0.08, 0.02), white, { at: [0, 0, 0.06] }));
  g.add(part(geo.rbox(S, 0.07, 0.08, 0.02), white, { at: [0, 0, 0.06] }));
  g.add(part(geo.rbox(S + 0.4, 0.1, 0.34, 0.04), white, { at: [0, -S / 2 - 0.08, 0.15] }));
  // curtains and rod
  g.add(part(geo.cyl(0.035, 0.035, S + 1.0, 8), toon(PALETTE.frame), { at: [0, S / 2 + 0.25, 0.22], rot: [0, 0, Math.PI / 2] }));
  for (const sx of [-1, 1]) {
    g.add(part(geo.rbox(0.38, S + 0.35, 0.1, 0.05), toon(PALETTE.pink), { at: [sx * (S / 2 + 0.2), 0.05, 0.25] }));
    g.add(part(geo.rbox(0.42, 0.1, 0.14, 0.04), toon(PALETTE.yellow), { at: [sx * (S / 2 + 0.2), -0.35, 0.27] }));
  }
  return g;
}

/** Classroom door. Origin = floor at the wall. */
export function buildDoor() {
  const g = new THREE.Group();
  g.add(part(geo.rbox(1.65, 3.05, 0.12, 0.04), toon(PALETTE.trim), { at: [0, 1.52, 0.06] }));
  g.add(part(geo.rbox(1.4, 2.85, 0.1, 0.04), toon(PALETTE.blue), { at: [0, 1.43, 0.12] }));
  g.add(part(geo.rbox(0.55, 0.6, 0.03, 0.02), unlit({ color: '#cdefff' }), { at: [0, 2.25, 0.17], shadow: false }));
  g.add(part(geo.sphere(0.08, 12, 8), toon(PALETTE.gold), { at: [0.5, 1.35, 0.22] }));
  g.add(part(geo.rbox(0.5, 0.5, 0.03, 0.08), toon(PALETTE.yellow), { at: [0, 1.4, 0.18], shadow: false }));
  return g;
}

/**
 * Wall clock with real moving hands. Origin = clock centre.
 * @returns {{group: THREE.Group, update: (date: Date) => void}}
 */
export function buildClock() {
  const g = new THREE.Group();
  const R = 0.55;
  g.add(part(geo.cyl(R + 0.05, R + 0.05, 0.1, 28), toon(PALETTE.red), { at: [0, 0, 0.05], rot: [Math.PI / 2, 0, 0] }));
  g.add(part(geo.circle(R - 0.02, 32), toonMapped(clockTexture()), { at: [0, 0, 0.105], shadow: false }));
  const ink = toon('#3a2e5c');
  const hand = (len, width, material, z) => {
    const pivot = live(group({ at: [0, 0, z] }));
    pivot.add(part(geo.rbox(width, len, 0.02, width / 2 - 0.001), material, { at: [0, len / 2 - 0.05, 0], shadow: false }));
    g.add(pivot);
    return pivot;
  };
  const hour = hand(0.3, 0.06, ink, 0.12);
  const minute = hand(0.44, 0.045, ink, 0.135);
  const second = hand(0.46, 0.02, toon(PALETTE.red), 0.15);
  g.add(part(geo.sphere(0.04, 8, 6), toon(PALETTE.red), { at: [0, 0, 0.16], shadow: false }));

  return {
    group: g,
    update(date) {
      const s = date.getSeconds() + date.getMilliseconds() / 1000;
      const m = date.getMinutes() + s / 60;
      const h = (date.getHours() % 12) + m / 60;
      second.rotation.z = -(s / 60) * Math.PI * 2;
      minute.rotation.z = -(m / 60) * Math.PI * 2;
      hour.rotation.z = -(h / 12) * Math.PI * 2;
    },
  };
}

/** Poster with a colored border and pushpins. Origin = poster centre. */
export function buildPoster(kind, scale = 1) {
  const w = 1.1 * scale;
  const h = 1.375 * scale;
  const g = new THREE.Group();
  g.add(part(geo.rbox(w + 0.12, h + 0.12, 0.04, 0.03), toon(PALETTE.white), { at: [0, 0, 0.02], shadow: false }));
  g.add(part(geo.plane(w, h), toonMapped(posterTexture(kind)), { at: [0, 0, 0.045], shadow: false }));
  for (const sx of [-1, 1]) g.add(part(geo.sphere(0.045, 8, 6), toon(PALETTE.red), { at: [sx * (w / 2 - 0.08), h / 2 - 0.08, 0.07], shadow: false }));
  return g;
}

/** Round reading rug with two floor cushions. Origin = rug centre on the floor. */
export function buildRug(radius) {
  const g = new THREE.Group();
  g.add(part(geo.circle(radius, 40), toonMapped(rugTexture()), { at: [0, 0.012, 0], rot: [-Math.PI / 2, 0, 0], shadow: false }));
  g.add(part(geo.sphere(0.42, 16, 10), toon(PALETTE.teal), { at: [0.7, 0.2, 0.55], scale: [1, 0.5, 1] }));
  g.add(part(geo.sphere(0.42, 16, 10), toon(PALETTE.orange), { at: [-0.6, 0.2, 0.75], scale: [1, 0.5, 1] }));
  return g;
}

/**
 * Big leafy class plant. The leaves are one tappable, wiggly group.
 * Origin = pot centre on the floor.
 */
export function buildPlant() {
  const g = new THREE.Group();
  g.add(part(geo.cyl(0.4, 0.3, 0.62, 18), toon(PALETTE.pot), { at: [0, 0.31, 0] }));
  g.add(part(geo.cyl(0.45, 0.45, 0.12, 18), toon(PALETTE.pot), { at: [0, 0.62, 0] }));
  g.add(part(geo.cyl(0.39, 0.39, 0.02, 18), toon(PALETTE.soil), { at: [0, 0.67, 0], shadow: false }));
  const leaves = live(group({ at: [0, 0.65, 0] }));
  const blobs = [[0, 0.75, 0, 0.45], [-0.3, 0.55, 0.15, 0.35], [0.3, 0.6, -0.1, 0.36], [0.1, 1.2, 0.1, 0.38], [-0.2, 1.05, -0.2, 0.33], [0.25, 1.0, 0.25, 0.3]];
  const leafy = new THREE.Group();
  blobs.forEach(([x, y, z, r], i) => {
    leafy.add(part(geo.sphere(r, 14, 10), toon(i % 2 ? PALETTE.leafLight : PALETTE.leaf), { at: [x, y, z], scale: [1, 1.15, 1] }));
  });
  bake(leafy);
  leaves.add(leafy, hitProxy(0.8, [0, 0.9, 0]));
  g.add(leaves);
  return { group: g, leaves };
}

/**
 * Fish bowl with a swimming goldfish. Origin = bottom of the bowl.
 * @returns {{group: THREE.Group, update: (dt: number) => void, excite: () => void}}
 */
export function buildFishbowl() {
  const g = new THREE.Group();
  const R = 0.34;
  g.add(part(geo.cyl(0.2, 0.22, 0.05, 16), toon(PALETTE.purple), { at: [0, 0.025, 0] }));
  g.add(part(geo.cyl(0.2, 0.2, 0.04, 16), toon('#ffe9a8'), { at: [0, 0.1, 0], shadow: false }));
  const water = new THREE.Mesh(new THREE.SphereGeometry(R - 0.03, 20, 14, 0, Math.PI * 2, Math.PI * 0.28, Math.PI * 0.72), glass('#5cc3ff', 0.4));
  water.position.y = R;
  water.renderOrder = 1;
  const bowl = part(geo.sphere(R, 20, 14), glass('#e6f7ff', 0.25), { at: [0, R, 0], shadow: false });
  bowl.renderOrder = 2;
  const glassParts = live(group({}, water, bowl)); // kept separate so see-through layers draw in order

  const fishPivot = live(group({ at: [0, R - 0.02, 0] }));
  const fish = group({ at: [0.16, 0, 0], rot: [0, Math.PI, 0] }); // faces the way it swims
  fish.add(part(geo.sphere(0.07, 12, 8), toon(PALETTE.orange), { scale: [1, 0.8, 1.5], shadow: false }));
  fish.add(part(geo.sphere(0.05, 8, 6), toon(PALETTE.orange), { at: [0, 0, -0.12], scale: [0.25, 1, 1], shadow: false }));
  fish.add(part(geo.sphere(0.015, 6, 4), toon('#3a2e5c'), { at: [0.05, 0.02, 0.07], shadow: false }));
  fishPivot.add(fish);

  const tap = live(group());
  tap.add(hitProxy(0.55, [0, R, 0]));
  g.add(fishPivot, glassParts, tap);

  let speed = 0.8;
  let time = 0;
  return {
    group: g,
    tapTarget: tap,
    update(dt) {
      time += dt;
      speed += (0.8 - speed) * Math.min(1, dt * 1.5);
      fishPivot.rotation.y += dt * speed;
      fish.position.y = Math.sin(time * 2) * 0.03;
    },
    excite() {
      speed = 6;
    },
  };
}
