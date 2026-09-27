import * as THREE from 'three';
import { geo, part, group, solid } from '../world/shapes.js';
import { toon, shade } from '../world/materials.js';

const INK = '#2b2230';
const PINK = '#ff9db5';

/**
 * Stuffed animal (bear, bunny, cat or puppy): round and soft with button eyes.
 * Faces +z, feet on y = 0. Pivots: head, armL, armR, legL, legR.
 */
export function buildPlush({ animal, color }) {
  const c = (hex) => toon(hex);
  const main = c(color);
  const light = c(shade(color, 0.5));
  const dark = c(shade(color, -0.25));
  const body = new THREE.Group();

  // round belly with a lighter tummy patch, and a tail
  const torso = [
    part(geo.sphere(0.3, 20, 14), main, { at: [0, 0.38, 0], scale: [1, 1.05, 0.92] }),
    part(geo.sphere(0.2, 16, 12), light, { at: [0, 0.36, 0.17], scale: [1, 1.1, 0.5] }),
  ];
  if (animal === 'bunny') torso.push(part(geo.sphere(0.1, 10, 8), c('#ffffff'), { at: [0, 0.25, -0.28] }));
  else if (animal === 'cat') torso.push(part(geo.capsule(0.045, 0.3, 8), main, { at: [0.05, 0.4, -0.32], rot: [-0.7, 0, -0.3] }));
  else if (animal === 'puppy') torso.push(part(geo.capsule(0.05, 0.14, 8), main, { at: [0, 0.38, -0.3], rot: [-0.9, 0, 0] }));
  else torso.push(part(geo.sphere(0.07, 8, 6), main, { at: [0, 0.22, -0.27] }));
  body.add(solid(...torso));

  // stubby legs with lighter paw pads
  const legs = [-1, 1].map((s) => {
    const leg = group({ at: [s * 0.15, 0.17, 0.04] });
    leg.add(solid(
      part(geo.sphere(0.12, 12, 8), main, { at: [0, -0.06, 0.05], scale: [1, 0.9, 1.3] }),
      part(geo.sphere(0.075, 10, 6), light, { at: [0, -0.06, 0.2], scale: [1, 1, 0.35] }),
    ));
    body.add(leg);
    return leg;
  });

  const arms = [-1, 1].map((s) => {
    const arm = group({ at: [s * 0.27, 0.52, 0.02], rot: [0, 0, s * 0.5] });
    arm.add(solid(part(geo.capsule(0.08, 0.12, 10), main, { at: [0, -0.1, 0] })));
    arm.userData.side = s;
    arm.userData.rest = s * 0.5;
    body.add(arm);
    return arm;
  });

  // head (centre 0.25 above the neck pivot)
  const head = group({ at: [0, 0.66, 0] });
  const H = 0.25;
  const face = [part(geo.sphere(0.3, 20, 14), main, { at: [0, H, 0] })];
  for (const s of [-1, 1]) {
    // button eyes with a shiny dot, and rosy cheeks
    face.push(
      part(geo.cyl(0.055, 0.055, 0.035, 14), c(INK), { at: [s * 0.11, H + 0.05, 0.27], rot: [Math.PI / 2 - 0.2, 0, 0] }),
      part(geo.sphere(0.016, 6, 4), c('#ffffff'), { at: [s * 0.11 + 0.02, H + 0.07, 0.3] }),
      part(geo.sphere(0.05, 8, 6), c(PINK), { at: [s * 0.19, H - 0.04, 0.23], scale: [1, 0.6, 0.5] }),
    );
  }

  const muzzle = (color2) => part(geo.sphere(0.11, 12, 8), color2, { at: [0, H - 0.07, 0.24], scale: [1.25, 0.85, 0.8] });
  const smile = part(geo.arc(0.04, 0.012), c(INK), { at: [0, H - 0.12, 0.315], rot: [0, 0, Math.PI] });

  switch (animal) {
    case 'bunny':
      face.push(muzzle(light), smile, part(geo.sphere(0.035, 8, 6), c(PINK), { at: [0, H - 0.04, 0.33] }));
      face.push(part(geo.rbox(0.05, 0.05, 0.02, 0.01), c('#ffffff'), { at: [0, H - 0.15, 0.3] }));
      for (const s of [-1, 1]) {
        face.push(
          part(geo.capsule(0.075, 0.3, 10), main, { at: [s * 0.11, H + 0.42, -0.02], rot: [0, 0, -s * 0.15] }),
          part(geo.capsule(0.04, 0.24, 8), c(PINK), { at: [s * 0.115, H + 0.42, 0.035], rot: [0, 0, -s * 0.15], scale: [1, 1, 0.4] }),
        );
      }
      break;
    case 'cat':
      face.push(smile, part(geo.sphere(0.03, 8, 6), c(PINK), { at: [0, H - 0.05, 0.3], scale: [1.3, 0.9, 1] }));
      for (const s of [-1, 1]) {
        face.push(
          part(geo.cone(0.11, 0.2, 12), main, { at: [s * 0.18, H + 0.27, 0], rot: [0, 0, -s * 0.35] }),
          part(geo.cone(0.06, 0.12, 10), c(PINK), { at: [s * 0.175, H + 0.25, 0.05], rot: [0, 0, -s * 0.35] }),
        );
        for (const tilt of [-0.12, 0.12]) {
          face.push(part(geo.cyl(0.006, 0.006, 0.18, 4), c(INK), { at: [s * 0.2, H - 0.07 + tilt * 0.3, 0.25], rot: [0, 0, Math.PI / 2 + s * tilt] }));
        }
      }
      break;
    case 'puppy':
      face.push(muzzle(light), smile, part(geo.sphere(0.045, 8, 6), c(INK), { at: [0, H - 0.03, 0.335], scale: [1.3, 0.9, 0.8] }));
      face.push(part(geo.sphere(0.035, 8, 6), c('#ff6f8a'), { at: [0, H - 0.16, 0.29], scale: [1, 1.2, 0.5] }));
      for (const s of [-1, 1]) {
        face.push(part(geo.sphere(0.13, 12, 8), dark, { at: [s * 0.3, H - 0.02, -0.01], rot: [0, 0, s * 0.25], scale: [0.45, 1.15, 0.8] }));
      }
      break;
    default: // bear
      face.push(muzzle(light), smile, part(geo.sphere(0.045, 8, 6), c(INK), { at: [0, H - 0.03, 0.335], scale: [1.3, 0.9, 0.8] }));
      for (const s of [-1, 1]) {
        face.push(
          part(geo.sphere(0.11, 12, 8), main, { at: [s * 0.2, H + 0.23, -0.02] }),
          part(geo.sphere(0.06, 8, 6), light, { at: [s * 0.2, H + 0.23, 0.05], scale: [1, 1, 0.5] }),
        );
      }
  }
  head.add(solid(...face));
  body.add(head);

  return {
    body,
    pivots: { head, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1] },
    info: {
      height: animal === 'bunny' ? 1.35 : 1.2,
      shadowRadius: 0.4,
      hitRadius: 0.55,
      hitY: 0.6,
      seatLift: 0.44,
      sitLegAngle: -1.2,
      portraitY: animal === 'bunny' ? 0.98 : 0.85,
      portraitSize: animal === 'bunny' ? 1.3 : 0.95,
      walks: true,
      waddles: true,
    },
  };
}
