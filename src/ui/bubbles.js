import * as THREE from 'three';
import { h } from './dom.js';

/**
 * Speech bubbles that float above characters' heads in the room.
 * Call update() after each rendered frame so they follow the camera.
 */
export function createBubbles(layer, camera, canvas) {
  const active = new Map(); // character -> { el, until }
  const v = new THREE.Vector3();

  function remove(character) {
    const b = active.get(character);
    if (!b) return;
    active.delete(character);
    b.el.classList.add('bubble-out');
    setTimeout(() => b.el.remove(), 250);
  }

  return {
    /** Show `text` over `character` for `seconds`. */
    say(character, text, seconds = 3) {
      let b = active.get(character);
      if (!b) {
        b = { el: h('div', { class: 'bubble' }) };
        layer.append(b.el);
        active.set(character, b);
      }
      b.el.textContent = text;
      b.el.classList.remove('bubble-pop');
      void b.el.offsetWidth; // restart the pop-in animation
      b.el.classList.add('bubble-pop');
      b.until = performance.now() + seconds * 1000;
    },

    clear: remove,

    set visible(on) {
      layer.hidden = !on;
    },

    update() {
      if (!active.size) return;
      const now = performance.now();
      const w = canvas.clientWidth;
      const hgt = canvas.clientHeight;
      for (const [character, b] of active) {
        if (now > b.until || !character.root.parent) {
          remove(character);
          continue;
        }
        character.topPosition(v).project(camera);
        const x = ((v.x + 1) / 2) * w;
        const y = ((1 - v.y) / 2) * hgt;
        b.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      }
    },
  };
}
