import * as THREE from 'three';
import { geo, part } from './shapes.js';
import { toon, toonMapped, unlit, PALETTE } from './materials.js';
import { floorTexture, sunPatchTexture } from './textures.js';
import { ROOM, HALF_W, HALF_D, PLACES } from './layout.js';
import { buildDoor, buildWindow } from './furniture/decor.js';

/**
 * Floor, the two walls (back and left; the other two are "removed" like a
 * dollhouse), trim, windows, door and patches of sunlight.
 */
export function buildRoom() {
  const g = new THREE.Group();
  const { width: W, depth: D, height: H, wall: T } = ROOM;

  // floor slab and tiles
  g.add(part(geo.rbox(W + T, 0.4, D + T, 0.1), toon(PALETTE.floorSide), { at: [-T / 2, -0.2, -T / 2], shadow: false }));
  g.add(part(geo.plane(W, D), toonMapped(floorTexture([W / 2, D / 2])), { at: [0, 0.004, 0], rot: [-Math.PI / 2, 0, 0], shadow: false }));

  // walls don't cast shadows so the sunlight can reach the floor
  const wall = toon(PALETTE.wall);
  g.add(part(geo.rbox(W + T, H + 0.4, T, 0.1), wall, { at: [-T / 2, H / 2 - 0.2, -HALF_D - T / 2], shadow: false }));
  g.add(part(geo.rbox(T, H + 0.4, D + T, 0.1), wall, { at: [-HALF_W - T / 2, H / 2 - 0.2, -T / 2], shadow: false }));

  // lower wall panel, chair rail and baseboard on both walls
  const panel = toon(PALETTE.wainscot);
  const trim = toon(PALETTE.trim);
  const trimPieces = [
    [panel, 1.3, 0.03, 0.65],
    [trim, 0.1, 0.07, 1.32],
    [trim, 0.18, 0.06, 0.09],
  ];
  for (const [mat, h, depth, y] of trimPieces) {
    g.add(part(geo.rbox(W, h, depth, 0.02), mat, { at: [0, y, -HALF_D + depth / 2], shadow: false }));
    g.add(part(geo.rbox(depth, h, D, 0.02), mat, { at: [-HALF_W + depth / 2, y, 0], shadow: false }));
  }

  // windows and door on the left wall (rotate to face +x)
  const sun = sunPatchTexture();
  const sunMaterial = unlit({ map: sun, color: '#ffe7a0', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const z of PLACES.windows) {
    const win = buildWindow();
    win.position.set(-HALF_W, 3.05, z);
    win.rotation.y = Math.PI / 2;
    g.add(win);
    // sunlight falling through the window onto the floor
    g.add(part(geo.plane(3.0, 2.1), sunMaterial, { at: [-HALF_W + 2.1, 0.02, z + 0.4], rot: [-Math.PI / 2, 0, 0.12], shadow: false, receive: false }));
  }
  const door = buildDoor();
  door.position.set(-HALF_W, 0, PLACES.door.z);
  door.rotation.y = Math.PI / 2;
  g.add(door);

  return g;
}

/** The part of the room the camera should frame for "whole room". */
export function roomBounds() {
  return new THREE.Box3(
    new THREE.Vector3(-HALF_W - ROOM.wall, -0.4, -HALF_D - ROOM.wall),
    new THREE.Vector3(HALF_W, ROOM.height, HALF_D),
  );
}
