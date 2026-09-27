/**
 * Tiny tween helper for one-off animations (wiggles, bounces, pops).
 * Call updateAnimations(dt) once per frame from the main loop.
 */
const running = new Set();

export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
};

/**
 * @param {number} duration seconds
 * @param {(t: number) => void} onUpdate receives eased progress 0..1
 * @returns {() => void} cancel function
 */
export function animate(duration, onUpdate, { easing = ease.linear, onDone } = {}) {
  const a = { duration, elapsed: 0, onUpdate, easing, onDone };
  running.add(a);
  return () => running.delete(a);
}

export function updateAnimations(dt) {
  for (const a of running) {
    a.elapsed += dt;
    const t = Math.min(1, a.elapsed / a.duration);
    a.onUpdate(a.easing(t));
    if (t >= 1) {
      running.delete(a);
      a.onDone?.();
    }
  }
}

/** Only one animation of each kind per object: starting a new one cancels the old. */
function exclusive(obj, kind, start) {
  const key = `_anim_${kind}`;
  obj.userData[key]?.();
  obj.userData[key] = start();
}

/** Side-to-side wobble, like something being poked. */
export function wiggle(obj, { amount = 0.25, duration = 0.7, axis = 'z' } = {}) {
  const base = obj.userData.baseRotation ??= obj.rotation[axis];
  exclusive(obj, 'wiggle', () => animate(duration, (t) => {
    obj.rotation[axis] = base + Math.sin(t * Math.PI * 6) * amount * (1 - t);
  }));
}

/** Squash-and-stretch bounce (scales from the object's origin). */
export function squash(obj, { amount = 0.3, duration = 0.5 } = {}) {
  exclusive(obj, 'squash', () => animate(duration, (t) => {
    const s = Math.sin(t * Math.PI * 3) * amount * (1 - t);
    obj.scale.set(1 + s * 0.5, 1 - s, 1 + s * 0.5);
  }));
}

/** Little jump straight up. */
export function hop(obj, { height = 0.3, duration = 0.45 } = {}) {
  const base = obj.userData.baseY ??= obj.position.y;
  exclusive(obj, 'hop', () => animate(duration, (t) => {
    obj.position.y = base + Math.sin(t * Math.PI) * height;
  }));
}
