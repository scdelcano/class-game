import * as THREE from 'three';
import { geo, part, group, solid } from '../world/shapes.js';
import { toon, shade } from '../world/materials.js';

const TIRE = '#3a3342';
const INK = '#2b2230';

/**
 * Monster truck: chunky body on big wheels, headlight eyes and a grille smile.
 * Faces +z, wheels on y = 0. Pivots: chassis (bounces), wheels[4] (spin).
 */
export function buildTruck({ color }) {
  const c = (hex) => toon(hex);
  const main = c(color);
  const body = new THREE.Group();
  const R = 0.24; // wheel radius

  const chassis = group();
  chassis.add(solid(
    part(geo.rbox(0.46, 0.1, 0.7, 0.04), c(TIRE), { at: [0, 0.34, 0] }),
    part(geo.rbox(0.68, 0.28, 0.9, 0.12), main, { at: [0, 0.58, 0] }),
    part(geo.rbox(0.7, 0.06, 0.6, 0.03), c(shade(color, 0.45)), { at: [0, 0.6, -0.05] }), // side stripe
    part(geo.rbox(0.58, 0.28, 0.46, 0.12), main, { at: [0, 0.84, -0.12] }), // cab
    part(geo.rbox(0.6, 0.15, 0.48, 0.06), c('#bfeaff'), { at: [0, 0.87, -0.12] }), // windows all round
    part(geo.rbox(0.74, 0.08, 0.12, 0.04), c('#ffc83d'), { at: [0, 0.42, 0.46] }), // bumper
    // face: headlight eyes, pupils, shine, grille smile
    ...[-1, 1].flatMap((s) => [
      part(geo.sphere(0.1, 14, 10), c('#ffffff'), { at: [s * 0.18, 0.62, 0.44], scale: [1, 1, 0.55] }),
      part(geo.sphere(0.05, 10, 8), c(INK), { at: [s * 0.17, 0.61, 0.495] }),
      part(geo.sphere(0.018, 6, 4), c('#ffffff'), { at: [s * 0.17 - 0.015, 0.635, 0.54] }),
    ]),
    part(geo.arc(0.09, 0.022), c(INK), { at: [0, 0.54, 0.455], rot: [0, 0, Math.PI] }),
    // roof lights
    ...[-0.15, 0, 0.15].map((x) => part(geo.sphere(0.045, 8, 6), c('#ffd84d'), { at: [x, 1.0, -0.02] })),
  ));
  body.add(chassis);

  const wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wheel = group({ at: [sx * 0.38, R, sz * 0.28] });
    wheel.add(solid(
      part(geo.cyl(R, R, 0.2, 18), c(TIRE), { rot: [0, 0, Math.PI / 2] }),
      part(geo.cyl(0.11, 0.11, 0.21, 12), c('#c9d2e3'), { rot: [0, 0, Math.PI / 2] }),
      // tread blocks so you can see the wheels turn
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return part(geo.rbox(0.2, 0.06, 0.08, 0.02), c('#50485a'), { at: [0, Math.cos(a) * R, Math.sin(a) * R], rot: [a, 0, 0] });
      }),
    ));
    body.add(wheel);
    wheels.push(wheel);
  }

  return {
    body,
    pivots: { chassis, wheels, wheelRadius: R },
    info: {
      height: 1.05,
      shadowRadius: 0.62,
      hitRadius: 0.6,
      hitY: 0.5,
      seatLift: 0,
      parkOffset: 0.3,
      portraitY: 0.6,
      portraitSize: 1.45,
      drives: true,
    },
  };
}
