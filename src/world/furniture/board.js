import * as THREE from 'three';
import { geo, part } from '../shapes.js';
import { toon, toonMapped, PALETTE, RAINBOW } from '../materials.js';
import { alphabetTexture, boardTexture } from '../textures.js';

export const BOARD = { width: 7.1, height: 2.4, centerY: 2.85 };

/**
 * Chalkboard with frame, chalk tray and the alphabet banner above it.
 * Origin = floor at the wall surface; faces +z.
 * @returns {{group: THREE.Group, boardCanvas: HTMLCanvasElement, boardTexture: THREE.Texture}}
 */
export function buildBoard() {
  const { width: w, height: h, centerY: y } = BOARD;
  const g = new THREE.Group();
  const frame = toon(PALETTE.frame);

  g.add(part(geo.rbox(w + 0.4, h + 0.4, 0.14, 0.07), frame, { at: [0, y, 0.07] }));
  const board = boardTexture();
  g.add(part(geo.plane(w, h), toonMapped(board.texture), { at: [0, y, 0.145], shadow: false }));

  // chalk tray with chalk and an eraser
  g.add(part(geo.rbox(w + 0.2, 0.08, 0.26, 0.03), frame, { at: [0, y - h / 2 - 0.16, 0.2] }));
  const trayTop = y - h / 2 - 0.1;
  [PALETTE.white, PALETTE.pink, PALETTE.yellow, RAINBOW[4]].forEach((c, i) => {
    g.add(part(geo.capsule(0.025, 0.14, 6), toon(c), { at: [-2.6 + i * 0.3, trayTop + 0.02, 0.22], rot: [0, 0, Math.PI / 2 + i * 0.1], shadow: false }));
  });
  g.add(part(geo.rbox(0.36, 0.08, 0.14, 0.02), toon(PALETTE.woodLight), { at: [2.4, trayTop + 0.04, 0.22] }));
  g.add(part(geo.rbox(0.36, 0.04, 0.14, 0.015), toon(PALETTE.charcoal), { at: [2.4, trayTop + 0.0, 0.22] }));

  // alphabet banner
  const bannerW = 7.6;
  const bannerH = bannerW * (172 / 2048);
  const bannerMaterial = toonMapped(alphabetTexture());
  bannerMaterial.alphaTest = 0.5; // see-through between the cards
  g.add(part(geo.plane(bannerW, bannerH), bannerMaterial, { at: [0, 4.75, 0.03], shadow: false }));
  g.add(part(geo.sphere(0.06, 8, 6), toon(PALETTE.red), { at: [-bannerW / 2, 4.75 + bannerH / 2 - 0.05, 0.05] }));
  g.add(part(geo.sphere(0.06, 8, 6), toon(PALETTE.red), { at: [bannerW / 2, 4.75 + bannerH / 2 - 0.05, 0.05] }));

  return { group: g, boardCanvas: board.canvas, boardTexture: board.texture };
}
