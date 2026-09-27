import * as THREE from 'three';

/**
 * WebGL renderer with two quality levels:
 *   high: device pixel ratio (max 2) + soft shadows
 *   low:  pixel ratio 1, no shadows
 * With ?quality=auto (the default) it starts high and drops to low once if the
 * first few seconds run below ~45 fps. Force a level with ?quality=low|high.
 * Add ?fps to the URL to show a frame-rate counter.
 */
export function createRenderer(canvas, scene) {
  const params = new URLSearchParams(location.search);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  let quality = params.get('quality') === 'low' ? 'low' : 'high';
  let autoQuality = !params.has('quality') || params.get('quality') === 'auto';

  function setQuality(level) {
    quality = level;
    renderer.setPixelRatio(level === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    const shadows = level !== 'low';
    if (renderer.shadowMap.enabled !== shadows) {
      renderer.shadowMap.enabled = shadows;
      scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
    resize();
  }

  function resize() {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  }

  // Frame-rate sampling for auto quality and the optional counter.
  const fpsEl = params.has('fps') ? document.getElementById('fps') : null;
  if (fpsEl) fpsEl.hidden = false;
  let sampleTime = 0;
  let sampleFrames = 0;
  let totalTime = 0;

  function measure(dt) {
    totalTime += dt;
    sampleTime += dt;
    sampleFrames += 1;
    if (sampleTime < 1) return;
    const fps = sampleFrames / sampleTime;
    if (fpsEl) fpsEl.textContent = `${Math.round(fps)} fps · ${quality}`;
    // Skip the first 2 s (shader compiling), then judge the next second.
    if (autoQuality && totalTime > 3) {
      autoQuality = false;
      if (fps < 45 && quality === 'high') {
        console.info(`[renderer] ${fps.toFixed(0)} fps, switching to low quality`);
        setQuality('low');
      }
    }
    sampleTime = 0;
    sampleFrames = 0;
  }

  setQuality(quality);

  return {
    renderer,
    resize,
    setQuality,
    get quality() { return quality; },
    /** Draw a frame. `sceneToDraw` defaults to the main scene (the editor passes its own). */
    render(camera, dt, sceneToDraw = scene) {
      renderer.render(sceneToDraw, camera);
      measure(dt);
    },
    /**
     * Draw a scene into a corner of the game canvas and copy it into `out` (a 2D
     * canvas) right away. Used for portraits: this keeps colors identical to
     * the game and needs no second WebGL context. The next frame paints over it.
     */
    snapshot(snapScene, camera, out) {
      const px = Math.min(out.width, canvas.height, canvas.width);
      const ratio = renderer.getPixelRatio();
      const css = px / ratio;
      renderer.setScissorTest(true);
      renderer.setViewport(0, 0, css, css);
      renderer.setScissor(0, 0, css, css);
      renderer.clear();
      renderer.render(snapScene, camera);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);
      const ctx = out.getContext('2d');
      ctx.clearRect(0, 0, out.width, out.height);
      ctx.drawImage(canvas, 0, canvas.height - px, px, px, 0, 0, out.width, out.height);
    },
  };
}
