import * as THREE from 'three';
import { geo, part, group } from '../shapes.js';
import { toon, PALETTE, RAINBOW } from '../materials.js';
import { seededRandom } from '../../core/random.js';

/** Bookshelf full of colorful books. Origin = floor at the wall; faces +z. */
export function buildBookshelf() {
  const W = 2.4;
  const H = 1.9;
  const D = 0.55;
  const wood = toon(PALETTE.wood);
  const g = new THREE.Group();
  const rand = seededRandom(7);

  g.add(part(geo.rbox(W, H, 0.06, 0.02), toon(PALETTE.woodDark), { at: [0, H / 2, 0.03] }));
  for (const sx of [-1, 1]) g.add(part(geo.rbox(0.08, H, D, 0.03), wood, { at: [sx * (W / 2 - 0.04), H / 2, D / 2] }));
  const shelves = [0.06, 0.66, 1.26, H - 0.04];
  for (const y of shelves) g.add(part(geo.rbox(W, 0.08, D, 0.03), wood, { at: [0, y, D / 2] }));

  for (const y of shelves.slice(0, 3)) {
    let x = -W / 2 + 0.12;
    while (x < W / 2 - 0.3) {
      const bw = rand.range(0.07, 0.13);
      const bh = rand.range(0.32, 0.5);
      const lean = x > W / 2 - 0.55 && rand.chance(0.6) ? -0.25 : 0;
      g.add(part(geo.box(), toon(rand.pick(RAINBOW)), {
        at: [x + bw / 2 + (lean ? 0.08 : 0), y + 0.04 + bh / 2 - (lean ? 0.02 : 0), D / 2 + 0.02],
        rot: [0, 0, lean],
        scale: [bw, bh, 0.36],
      }));
      x += bw + 0.012 + (lean ? 0.12 : 0);
      if (rand.chance(0.08)) x += 0.15; // a gap now and then
    }
  }
  return g;
}

/**
 * Cubbies (5 × 2 cubby holes) with backpacks. Origin = floor at the wall,
 * centred along its length (x); faces +z.
 */
export function buildCubbies(length) {
  const H = 1.5;
  const D = 0.75;
  const cols = 5;
  const t = 0.06;
  const wood = toon(PALETTE.woodLight);
  const g = new THREE.Group();
  const rand = seededRandom(3);

  g.add(part(geo.rbox(length, H, 0.05, 0.02), toon(PALETTE.wood), { at: [0, H / 2, 0.025] }));
  for (const y of [t / 2, H / 2, H - t / 2]) g.add(part(geo.rbox(length, t, D, 0.02), wood, { at: [0, y, D / 2] }));
  const cellW = (length - t) / cols;
  for (let i = 0; i <= cols; i++) {
    g.add(part(geo.rbox(t, H, D, 0.02), wood, { at: [-length / 2 + t / 2 + i * cellW, H / 2, D / 2] }));
  }
  // a colored label strip on each cubby
  for (let i = 0; i < cols; i++) {
    for (const y of [t, H / 2 + t / 2]) {
      g.add(part(geo.rbox(cellW * 0.5, 0.06, 0.02, 0.01), toon(RAINBOW[(i + (y > 0.5 ? 3 : 0)) % RAINBOW.length]), {
        at: [-length / 2 + t / 2 + (i + 0.5) * cellW, y + 0.02, D + 0.01], shadow: false,
      }));
    }
  }
  // backpacks in most cubbies
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < cols; i++) {
      if (rand.chance(0.25)) continue;
      const color = rand.pick(RAINBOW);
      const bp = group({ at: [-length / 2 + t / 2 + (i + 0.5) * cellW, row === 0 ? t : H / 2 + t / 2, D * 0.55], rot: [0, rand.range(-0.25, 0.25), 0] });
      bp.add(part(geo.rbox(0.42, 0.48, 0.28, 0.12), toon(color), { at: [0, 0.26, 0] }));
      bp.add(part(geo.rbox(0.3, 0.2, 0.08, 0.05), toon(PALETTE.white), { at: [0, 0.16, 0.15] }));
      bp.add(part(geo.rbox(0.43, 0.15, 0.3, 0.06), toon(color), { at: [0, 0.46, 0.01], rot: [0.15, 0, 0] }));
      g.add(bp);
    }
  }
  return g;
}
