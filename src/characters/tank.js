import * as THREE from 'three';
import { geo, part, group, solid } from '../world/shapes.js';
import { toon, shade } from '../world/materials.js';

const TREAD = '#4a4356';
const INK = '#2b2230';

/**
 * Friendly toy tank: round turret with a face, a stubby cannon with a bright
 * rounded tip (like a cork), and soft treads. Faces +z, treads on y = 0.
 * Pivots: hull (bounces), turret (turns), cannon (nods), treadL/R.
 */
export function buildTank({ color }) {
  const c = (hex) => toon(hex);
  const main = c(color);
  const body = new THREE.Group();

  const hull = group();
  hull.add(solid(
    part(geo.rbox(0.62, 0.22, 0.82, 0.1), main, { at: [0, 0.33, 0] }),
    part(geo.rbox(0.66, 0.05, 0.86, 0.02), c(shade(color, -0.2)), { at: [0, 0.24, 0] }),
    // a little star on each side
    ...[-1, 1].map((s) => part(geo.sphere(0.06, 10, 6), c('#ffd84d'), { at: [s * 0.31, 0.34, 0.1], scale: [0.3, 1, 1] })),
  ));
  body.add(hull);

  const treads = [-1, 1].map((s) => {
    const tread = group({ at: [s * 0.32, 0, 0] });
    tread.add(solid(
      part(geo.rbox(0.2, 0.26, 0.92, 0.12), c(TREAD), { at: [0, 0.14, 0] }),
      ...[-0.28, 0, 0.28].map((z) => part(geo.cyl(0.085, 0.085, 0.04, 12), c('#c9d2e3'), { at: [s * 0.1, 0.13, z], rot: [0, 0, Math.PI / 2] })),
    ));
    body.add(tread);
    return tread;
  });

  // turret with the face; the cannon is its "nose"
  const turret = group({ at: [0, 0.43, -0.02] });
  turret.add(solid(
    part(geo.dome(0.3, 20), main, { scale: [1, 0.85, 1] }),
    part(geo.cyl(0.3, 0.3, 0.04, 20), c(shade(color, -0.2)), { at: [0, 0.01, 0] }),
    part(geo.cyl(0.1, 0.1, 0.05, 14), c(shade(color, 0.3)), { at: [0, 0.25, -0.05] }), // hatch
    part(geo.cyl(0.012, 0.012, 0.34, 6), c(INK), { at: [-0.15, 0.36, -0.12] }), // antenna
    part(geo.sphere(0.04, 8, 6), c('#f0505a'), { at: [-0.15, 0.54, -0.12] }),
    ...[-1, 1].flatMap((s) => [
      part(geo.sphere(0.075, 12, 8), c('#ffffff'), { at: [s * 0.12, 0.15, 0.22], scale: [1, 1.1, 0.6] }),
      part(geo.sphere(0.04, 8, 6), c(INK), { at: [s * 0.12, 0.15, 0.26] }),
      part(geo.sphere(0.014, 6, 4), c('#ffffff'), { at: [s * 0.12 + 0.015, 0.17, 0.29] }),
      part(geo.sphere(0.05, 8, 6), c('#ff9db5'), { at: [s * 0.21, 0.07, 0.19], scale: [1, 0.6, 0.5] }),
    ]),
  ));
  const cannon = group({ at: [0, 0.07, 0.24] });
  cannon.add(solid(
    part(geo.cyl(0.06, 0.07, 0.26, 12), c(shade(color, -0.15)), { at: [0, 0, 0.12], rot: [Math.PI / 2, 0, 0] }),
    part(geo.sphere(0.085, 12, 8), c('#ffd84d'), { at: [0, 0, 0.27] }),
  ));
  turret.add(cannon);
  body.add(turret);

  return {
    body,
    pivots: { hull, turret, cannon, treadL: treads[0], treadR: treads[1] },
    info: {
      height: 0.95,
      shadowRadius: 0.58,
      hitRadius: 0.55,
      hitY: 0.4,
      seatLift: 0,
      parkOffset: 0.3,
      portraitY: 0.55,
      portraitSize: 1.3,
      drives: true,
    },
  };
}
