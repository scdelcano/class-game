import * as THREE from 'three';

/** Friendly, saturated palette shared by the whole game. */
export const PALETTE = {
  wall: '#fff0cc',
  wainscot: '#8fd6c8',
  trim: '#fffaf0',
  floorSide: '#e3a86b',
  wood: '#e9b77c',
  woodDark: '#c98b52',
  woodLight: '#f6d7a7',
  frame: '#b8773f',
  gold: '#ffc83d',
  metal: '#b9c3d8',
  charcoal: '#5a5170',
  red: '#f0505a',
  orange: '#ff9f43',
  yellow: '#ffd84d',
  green: '#6cc46a',
  leaf: '#4fae5b',
  leafLight: '#7fd36e',
  teal: '#3cc6c0',
  blue: '#4aa8ff',
  purple: '#9b7bff',
  pink: '#ff7fb0',
  white: '#ffffff',
  pot: '#e07a4f',
  soil: '#7a4f33',
};

export const RAINBOW = [PALETTE.red, PALETTE.orange, PALETTE.yellow, PALETTE.green, PALETTE.blue, PALETTE.purple, PALETTE.pink];

let gradientMap = null;

/** Soft 4-step lighting ramp that gives the toy/cartoon look. */
function toonGradient() {
  if (!gradientMap) {
    const data = new Uint8Array([130, 180, 220, 255]);
    gradientMap = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return gradientMap;
}

const cache = new Map();

/** Shared cartoon material for a color. Same color = same material object (cheap to draw). */
export function toon(color) {
  const key = `toon:${new THREE.Color(color).getHexString()}`;
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() }));
  }
  return cache.get(key);
}

let vertexToon = null;

/** One shared cartoon material whose colors come from the mesh (used by characters). */
export function toonVertex() {
  vertexToon ??= new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
  return vertexToon;
}

/** Mix a color toward white (amount > 0) or black (amount < 0). Returns a hex string. */
export function shade(color, amount) {
  const c = new THREE.Color(color);
  c.lerp(new THREE.Color(amount > 0 ? '#ffffff' : '#000000'), Math.abs(amount));
  return `#${c.getHexString()}`;
}

/** Cartoon material with a picture on it (posters, board, rug). */
export function toonMapped(map, color = '#ffffff') {
  return new THREE.MeshToonMaterial({ map, color, gradientMap: toonGradient() });
}

/** Material that ignores lighting (window views, glowing things). */
export function unlit(options) {
  return new THREE.MeshBasicMaterial(options);
}

/** Glassy see-through material (fish bowl). */
export function glass(color, opacity = 0.35) {
  return new THREE.MeshPhongMaterial({
    color, transparent: true, opacity, shininess: 90, specular: '#ffffff', depthWrite: false,
  });
}
