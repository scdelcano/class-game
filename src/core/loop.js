/**
 * Main animation loop. Calls tick(dt, elapsed) every frame (dt in seconds,
 * capped so a hiccup never makes things jump), and fully stops while the app
 * is in the background to save battery.
 */
export function startLoop(tick) {
  let raf = 0;
  let last = 0;
  let elapsed = 0;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    elapsed += dt;
    tick(dt, elapsed);
  };

  const start = () => {
    if (raf) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();
  return { start, stop };
}
