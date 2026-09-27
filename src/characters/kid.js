import * as THREE from 'three';
import { geo, part, group, solid } from '../world/shapes.js';
import { toon } from '../world/materials.js';

const PANTS = '#4a5fa8';
const SHOES = '#3a2e5c';
const INK = '#2b2230';
const CHEEK = '#ff9db5';

/**
 * Chibi kid: big round head, small body. Faces +z, feet on y = 0.
 * Pivots: head, armL, armR, legL, legR (for waving, walking, sitting).
 */
export function buildKid({ skin, hair, hairColor, shirt, glasses }) {
  const c = (hex) => toon(hex);
  const body = new THREE.Group();

  // torso with shorts
  body.add(solid(
    part(geo.rbox(0.44, 0.34, 0.32, 0.13), c(shirt), { at: [0, 0.56, 0] }),
    part(geo.rbox(0.42, 0.14, 0.3, 0.06), c(PANTS), { at: [0, 0.37, 0] }),
  ));

  // legs pivot at the hips
  const legs = [-1, 1].map((s) => {
    const leg = group({ at: [s * 0.1, 0.36, 0] });
    leg.add(solid(
      part(geo.capsule(0.085, 0.16), c(PANTS), { at: [0, -0.16, 0] }),
      part(geo.sphere(0.1, 12, 8), c(SHOES), { at: [0, -0.31, 0.04], scale: [1, 0.6, 1.3] }),
    ));
    body.add(leg);
    return leg;
  });

  // arms pivot at the shoulders, hanging slightly outward
  const arms = [-1, 1].map((s) => {
    const arm = group({ at: [s * 0.26, 0.67, 0], rot: [0, 0, s * 0.15] });
    arm.add(solid(
      part(geo.capsule(0.065, 0.16), c(shirt), { at: [0, -0.12, 0] }),
      part(geo.sphere(0.075, 10, 8), c(skin), { at: [0, -0.27, 0] }),
    ));
    arm.userData.side = s;
    arm.userData.rest = s * 0.15;
    body.add(arm);
    return arm;
  });

  // head pivots at the neck; head centre is 0.3 above it
  const head = group({ at: [0, 0.73, 0] });
  const H = 0.3;
  const face = [
    part(geo.sphere(0.33, 22, 16), c(skin), { at: [0, H, 0] }),
    part(geo.sphere(0.07, 8, 6), c(skin), { at: [-0.32, H, 0] }),
    part(geo.sphere(0.07, 8, 6), c(skin), { at: [0.32, H, 0] }),
    part(geo.arc(0.055, 0.016), c(INK), { at: [0, H - 0.11, 0.305], rot: [0, 0, Math.PI] }),
  ];
  for (const s of [-1, 1]) {
    face.push(
      part(geo.sphere(0.055, 10, 8), c(INK), { at: [s * 0.12, H + 0.01, 0.29], scale: [1, 1.3, 0.6] }),
      part(geo.sphere(0.02, 6, 4), c('#ffffff'), { at: [s * 0.12 + 0.02, H + 0.04, 0.325] }),
      part(geo.sphere(0.055, 8, 6), c(CHEEK), { at: [s * 0.2, H - 0.08, 0.25], scale: [1, 0.6, 0.5] }),
    );
  }
  face.push(...hairParts(hair, c(hairColor), H));
  if (glasses) {
    const frame = c('#3a2e5c');
    for (const s of [-1, 1]) face.push(part(geo.torus(0.085, 0.016, 6, 20), frame, { at: [s * 0.12, H + 0.01, 0.315] }));
    face.push(part(geo.cyl(0.012, 0.012, 0.07, 6), frame, { at: [0, H + 0.02, 0.33], rot: [0, 0, Math.PI / 2] }));
  }
  head.add(solid(...face));
  body.add(head);

  return {
    body,
    pivots: { head, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1] },
    info: {
      height: 1.38,
      shadowRadius: 0.36,
      hitRadius: 0.55,
      hitY: 0.7,
      seatLift: 0.2,
      sitLegAngle: -1.45,
      portraitY: 0.98,
      portraitSize: 0.95,
      walks: true,
    },
  };
}

/** Hair meshes around a head centred at (0, H, 0) with radius 0.33. */
function hairParts(style, mat, H) {
  const parts = [];
  const cap = () => part(geo.cap(0.35, 0.56), mat, { at: [0, H, -0.01], rot: [-0.35, 0, 0] });
  const fringe = () => [-0.13, 0, 0.13].map((x) => part(geo.sphere(0.11, 10, 8), mat, {
    at: [x, H + 0.21 - Math.abs(x) * 0.25, 0.22], scale: [1, 0.7, 0.8],
  }));

  switch (style) {
    case 'long':
      parts.push(cap(), ...fringe(), part(geo.rbox(0.64, 0.56, 0.24, 0.11), mat, { at: [0, H - 0.14, -0.17] }));
      break;
    case 'pigtails':
      parts.push(cap(), ...fringe());
      for (const s of [-1, 1]) {
        parts.push(
          part(geo.sphere(0.13, 12, 10), mat, { at: [s * 0.4, H - 0.06, -0.06], scale: [0.9, 1.2, 0.9] }),
          part(geo.sphere(0.05, 8, 6), toon('#ff5d8f'), { at: [s * 0.32, H + 0.02, -0.04] }),
        );
      }
      break;
    case 'bun':
      parts.push(cap(), ...fringe(), part(geo.sphere(0.15, 14, 10), mat, { at: [0, H + 0.36, -0.1] }));
      break;
    case 'curly': {
      // a fluffy cloud of little balls over the top and back of the head
      const rings = [[0, 1], [0.45, 7], [0.85, 10], [1.2, 11], [1.55, 9]];
      for (const [lat, count] of rings) {
        for (let i = 0; i < count; i++) {
          const lon = (i / count) * Math.PI * 2;
          const x = Math.sin(lat) * Math.sin(lon);
          const z = Math.sin(lat) * Math.cos(lon);
          if (z > 0.35 && lat > 0.8) continue; // keep the face clear
          parts.push(part(geo.sphere(0.12, 10, 8), mat, { at: [x * 0.34, H + Math.cos(lat) * 0.34 + 0.02, z * 0.34 - 0.02] }));
        }
      }
      break;
    }
    case 'spiky':
      parts.push(cap());
      [[0, 0.1, 0], [-0.17, 0, 0.35], [0.17, 0, -0.35], [0, -0.05, 0.6], [-0.2, -0.12, -0.2], [0.2, -0.12, 0.2]].forEach(([x, z, tilt], i) => {
        parts.push(part(geo.cone(0.09, 0.24, 8), mat, { at: [x, H + 0.36 - i * 0.015, z + 0.02], rot: [z * -2, 0, tilt * -0.9 + x * -2] }));
      });
      break;
    default: // short
      parts.push(cap(), ...fringe());
  }
  return parts;
}
