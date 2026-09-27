import * as THREE from 'three';
import { Character } from './character.js';
import { lookKey } from './options.js';

/**
 * Makes little picture portraits of characters (for the class list, the
 * "make a student" buttons, and the attendance clipboard).
 * Pictures are cached, so each look is only drawn once.
 *
 * @param {{snapshot: Function}} view the game renderer (see core/renderer.js)
 */
export function createPortraits(view, size = 192) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff8ea', '#e9d2b5', 1.9));
  const key = new THREE.DirectionalLight('#ffffff', 1.5);
  key.position.set(2, 3, 4);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 30);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const cache = new Map();

  /**
   * @param {string} type
   * @param {object} look
   * @param {{angle?: number, full?: boolean}} [opts] full = whole body instead of head and shoulders
   * @returns {string} image URL
   */
  function get(type, look, { angle = 0.45, full = false } = {}) {
    const cacheKey = `${lookKey(type, look)}|${angle}|${full}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const ch = new Character(type, look);
    ch.time = 0;
    ch.update(0);
    ch.root.rotation.y = angle;
    ch.shadow.visible = false;
    scene.add(ch.root);

    const y = full ? ch.info.height / 2 : ch.info.portraitY;
    const frame = full ? Math.max(ch.info.height, 1.1) * 1.15 : ch.info.portraitSize;
    const dist = frame / (2 * tanHalf);
    camera.position.set(0, y + dist * 0.12, dist);
    camera.lookAt(0, y, 0);

    view.snapshot(scene, camera, canvas);
    scene.remove(ch.root);
    ch.dispose();

    const url = canvas.toDataURL('image/png');
    cache.set(cacheKey, url);
    return url;
  }

  return { get };
}
