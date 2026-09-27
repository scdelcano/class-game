import * as THREE from 'three';
import { geo, part, group, live, hitProxy, bake } from '../shapes.js';
import { toon, PALETTE, RAINBOW } from '../materials.js';

export const STUDENT_DESK = { width: 1.1, depth: 0.75, height: 0.78, chairOffset: 0.62, seatHeight: 0.46 };

/**
 * A student desk with its chair. Origin = desk centre on the floor.
 * The student sits on the +z side, facing -z (towards the board).
 * Vehicle students get a desk without a chair.
 */
export function buildStudentDesk(index = 0, { chair: withChair = true } = {}) {
  const { width: w, depth: d, height: h, chairOffset, seatHeight: sh } = STUDENT_DESK;
  const wood = toon(PALETTE.woodLight);
  const metal = toon(PALETTE.metal);
  const chairColor = toon(RAINBOW[index % RAINBOW.length]);
  const g = new THREE.Group();

  g.add(part(geo.rbox(w, 0.08, d, 0.035), wood, { at: [0, h - 0.04, 0] }));
  // book box under the top, kept to the front half so seated legs fit
  g.add(part(geo.rbox(w - 0.16, 0.16, d - 0.3, 0.03), toon(PALETTE.charcoal), { at: [0, h - 0.19, -0.1] }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(part(geo.cyl(0.035, 0.035, h - 0.08, 8), metal, { at: [sx * (w / 2 - 0.08), (h - 0.08) / 2, sz * (d / 2 - 0.08)] }));
  }

  if (!withChair) return g; // trucks and tanks park here instead
  const chair = group({ at: [0, 0, chairOffset] });
  chair.add(part(geo.rbox(0.56, 0.07, 0.5, 0.03), chairColor, { at: [0, sh, 0] }));
  chair.add(part(geo.rbox(0.56, 0.4, 0.07, 0.03), chairColor, { at: [0, sh + 0.3, 0.23] }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    chair.add(part(geo.cyl(0.03, 0.03, sh, 8), metal, { at: [sx * 0.22, sh / 2, sz * 0.19] }));
  }
  g.add(chair);
  return g;
}

/**
 * Teacher's desk with drawers, books, a pencil cup, a tappable apple and the
 * tappable bell. Origin = centre on the floor; the front (drawers) faces +z.
 * @returns {{group: THREE.Group, bell: THREE.Group, bellDome: THREE.Object3D, apple: THREE.Group}}
 */
export function buildTeacherDesk() {
  const W = 2.5;
  const D = 1.1;
  const H = 1.0;
  const wood = toon(PALETTE.wood);
  const woodLight = toon(PALETTE.woodLight);
  const gold = toon(PALETTE.gold);
  const g = new THREE.Group();

  g.add(part(geo.rbox(W, 0.12, D, 0.05), wood, { at: [0, H - 0.06, 0] }));
  for (const sx of [-1, 1]) {
    const px = sx * (W / 2 - 0.42);
    g.add(part(geo.rbox(0.75, H - 0.12, D - 0.1, 0.04), wood, { at: [px, (H - 0.12) / 2, 0] }));
    for (const y of [0.18, 0.46, 0.74]) {
      g.add(part(geo.rbox(0.62, 0.22, 0.04, 0.02), woodLight, { at: [px, y, D / 2 - 0.04] }));
      g.add(part(geo.sphere(0.035, 8, 6), gold, { at: [px, y, D / 2 - 0.0] }));
    }
  }
  g.add(part(geo.rbox(W - 1.5, 0.6, 0.06, 0.02), wood, { at: [0, 0.6, D / 2 - 0.1] }));

  // stack of books
  [PALETTE.blue, PALETTE.red, PALETTE.green].forEach((c, i) => {
    g.add(part(geo.rbox(0.5, 0.09, 0.36, 0.02), toon(c), { at: [-0.85, H + 0.05 + i * 0.09, -0.1], rot: [0, i * 0.2 - 0.2, 0] }));
  });
  // pencil cup
  g.add(part(geo.cyl(0.09, 0.08, 0.2, 12), toon(PALETTE.teal), { at: [-0.35, H + 0.1, -0.25] }));
  [PALETTE.yellow, PALETTE.pink, PALETTE.orange].forEach((c, i) => {
    g.add(part(geo.cyl(0.018, 0.018, 0.3, 6), toon(c), { at: [-0.37 + i * 0.03, H + 0.2, -0.25], rot: [0.15 * (i - 1), 0, 0.2 * (i - 1)], shadow: false }));
  });

  // apple (tappable)
  const apple = live(group({ at: [0.05, H, 0.15] }));
  apple.add(part(geo.sphere(0.15, 16, 12), toon(PALETTE.red), { at: [0, 0.13, 0], scale: [1, 0.9, 1] }));
  apple.add(part(geo.cyl(0.015, 0.015, 0.1, 6), toon(PALETTE.soil), { at: [0, 0.29, 0] }));
  apple.add(part(geo.sphere(0.06, 8, 6), toon(PALETTE.leaf), { at: [0.06, 0.29, 0], scale: [1.4, 0.4, 0.8], rot: [0, 0, 0.4] }));
  apple.add(hitProxy(0.4, [0, 0.15, 0]));
  g.add(apple);

  // desk bell (tappable): dark base, gold dome, little plunger on top
  const bell = live(group({ at: [0.8, H, 0.15] }));
  bell.add(part(geo.cyl(0.28, 0.3, 0.07, 20), toon(PALETTE.charcoal), { at: [0, 0.035, 0] }));
  const bellDome = group({ at: [0, 0.07, 0] });
  bellDome.add(part(geo.dome(0.24, 20), gold));
  bellDome.add(part(geo.cyl(0.025, 0.025, 0.08, 8), gold, { at: [0, 0.27, 0] }));
  bellDome.add(part(geo.sphere(0.055, 10, 8), gold, { at: [0, 0.33, 0] }));
  bell.add(bellDome);
  bell.add(hitProxy(0.5, [0, 0.2, 0]));
  g.add(bell);

  // teacher's rolling chair (behind the desk)
  const chairColor = toon(PALETTE.purple);
  const chair = group({ at: [0, 0, -0.95] });
  chair.add(part(geo.rbox(0.72, 0.12, 0.65, 0.05), chairColor, { at: [0, 0.62, 0] }));
  chair.add(part(geo.rbox(0.72, 0.75, 0.12, 0.06), chairColor, { at: [0, 1.05, -0.3] }));
  chair.add(part(geo.cyl(0.05, 0.05, 0.5, 8), toon(PALETTE.metal), { at: [0, 0.32, 0] }));
  chair.add(part(geo.cyl(0.36, 0.36, 0.06, 10), toon(PALETTE.charcoal), { at: [0, 0.08, 0] }));
  g.add(chair);

  bake(bellDome);
  return { group: g, bell, bellDome, apple };
}
