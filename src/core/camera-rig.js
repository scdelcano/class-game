import * as THREE from 'three';

const VIEW_HEIGHT = 14; // world units visible top-to-bottom (at the look-at point) at zoom 1
const DRAG_START_PX = 8; // finger must move this far before a tap becomes a drag
const TAP_MAX_MS = 800;
const MAX_ZOOM_IN = 3.2; // relative to "whole room"

/**
 * Perspective camera looking into the room from a fixed corner angle, with touch controls:
 *   one finger drag = pan, two finger pinch = zoom (and pan), mouse wheel = zoom,
 *   a quick touch without moving = tap (reported through onTap).
 * Panning is limited so the room can never be lost off-screen.
 */
export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} el element receiving pointer events (the canvas)
   * @param {THREE.Box3} bounds what "whole room" should frame
   */
  constructor(camera, el, bounds, { azimuthDeg = 45, elevationDeg = 33 } = {}) {
    this.camera = camera;
    this.el = el;
    this.bounds = bounds;
    /** @type {((clientX: number, clientY: number) => void) | null} */
    this.onTap = null;

    const az = THREE.MathUtils.degToRad(azimuthDeg);
    const elev = THREE.MathUtils.degToRad(elevationDeg);
    this.dir = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));
    camera.position.copy(this.dir);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    this.right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    this.up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    this.home = bounds.getCenter(new THREE.Vector3());
    this.frame = bounds; // what "whole view" frames right now (the room, or part of it)

    // pan = offset from home in screen-plane world units
    this.pan = new THREE.Vector2();
    this.goalPan = new THREE.Vector2();
    this.zoom = 0;
    this.goalZoom = 0;
    this.fitZoom = 1;
    this.extent = new THREE.Vector2(1, 1);
    /** @type {THREE.Vector3[]} framed box corners as (right, up, toward-camera) offsets */
    this.corners = [];
    this.width = 1;
    this.height = 1;
    // Part of the screen width the room should use (1 = all). Less than 1
    // when a panel (the clipboard) covers the right side.
    this.area = 1;
    this.goalArea = 1;

    this.pointers = new Map();
    this.gesture = null;
    this.pinch = null;
    this.bindEvents();
  }

  get aspect() {
    return this.width / this.height;
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.camera.aspect = this.aspect;

    this.measureFrame();
    const relative = this.zoom ? this.goalZoom / this.fitZoom : 1;
    this.fitZoom = this.fitZoomFor(this.goalArea);
    this.minZoom = this.fitZoom * 0.9;
    this.maxZoom = this.fitZoom * MAX_ZOOM_IN;
    this.zoom = this.goalZoom = THREE.MathUtils.clamp(this.fitZoom * relative, this.minZoom, this.maxZoom);
    this.clampPan(this.goalPan, this.goalZoom);
    this.pan.copy(this.goalPan);
    this.apply(true);
  }

  /** How far the framed box's corners reach from its centre, as seen on screen. */
  measureFrame() {
    const { min, max } = this.frame;
    let ex = 0;
    let ey = 0;
    const v = new THREE.Vector3();
    this.corners = [];
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      v.set(x, y, z).sub(this.home);
      const c = new THREE.Vector3(v.dot(this.right), v.dot(this.up), v.dot(this.dir));
      this.corners.push(c);
      ex = Math.max(ex, Math.abs(c.x));
      ey = Math.max(ey, Math.abs(c.y));
    }
    this.extent.set(ex, ey);
  }

  /** Camera distance from the look-at point that shows VIEW_HEIGHT / zoom world units top-to-bottom. */
  distanceFor(zoom) {
    return VIEW_HEIGHT / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * zoom);
  }

  /** Zoom that fits the framed box into `area` (fraction of the screen width). */
  fitZoomFor(area) {
    const fit = (ex, ey) => Math.min((VIEW_HEIGHT * this.aspect * area) / 2 / ex, VIEW_HEIGHT / 2 / ey) * 0.94;
    // Corners nearer the camera look bigger, and how much bigger depends on
    // the distance, which depends on the zoom: a few rounds settle it.
    let zoom = fit(this.extent.x, this.extent.y);
    for (let i = 0; i < 4; i++) {
      const dist = this.distanceFor(zoom);
      let ex = 0;
      let ey = 0;
      for (const c of this.corners) {
        const grow = dist / Math.max(dist * 0.2, dist - c.z);
        ex = Math.max(ex, Math.abs(c.x) * grow);
        ey = Math.max(ey, Math.abs(c.y) * grow);
      }
      zoom = fit(ex, ey);
    }
    return zoom;
  }

  /** Smoothly go back to seeing the whole room. */
  reset() {
    this.goalPan.set(0, 0);
    this.goalZoom = this.fitZoom;
  }

  /**
   * Frame `bounds` (default: the whole room) in the left `area` of the screen,
   * e.g. 0.55 while a panel covers the right side. The camera glides there.
   * Pass area 1 and no bounds to go back to the full room on the full screen.
   */
  setFocusArea(area, bounds = this.bounds) {
    // switch to the new centre without a jump, then glide (pan -> 0)
    const shift = this.home.clone().sub(bounds.getCenter(new THREE.Vector3()));
    this.pan.x += shift.dot(this.right);
    this.pan.y += shift.dot(this.up);
    this.frame = bounds;
    this.home = bounds.getCenter(new THREE.Vector3());
    this.measureFrame();
    this.goalArea = area;
    this.fitZoom = this.fitZoomFor(area);
    this.minZoom = this.fitZoom * 0.9;
    this.maxZoom = this.fitZoom * MAX_ZOOM_IN;
    this.reset();
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 10);
    const changed = Math.abs(this.goalZoom - this.zoom) > 1e-5 || Math.abs(this.goalArea - this.area) > 1e-4;
    this.pan.lerp(this.goalPan, k);
    this.zoom += (this.goalZoom - this.zoom) * k;
    this.area += (this.goalArea - this.area) * k;
    this.apply(changed);
  }

  apply(projectionChanged = false) {
    const target = this.home.clone()
      .addScaledVector(this.right, this.pan.x)
      .addScaledVector(this.up, this.pan.y);
    this.camera.position.copy(target).addScaledVector(this.dir, this.distanceFor(this.zoom));
    if (projectionChanged) {
      if (this.area < 0.999) {
        // slide the picture left so the room is centred in the uncovered part
        this.camera.setViewOffset(this.width, this.height, (this.width * (1 - this.area)) / 2, 0, this.width, this.height);
      } else {
        this.camera.clearViewOffset();
      }
      this.camera.updateProjectionMatrix();
    }
  }

  // ------------------------------------------------------------- gestures
  worldPerPixel(zoom) {
    return VIEW_HEIGHT / (zoom * this.height);
  }

  clampPan(p, zoom) {
    const halfW = (VIEW_HEIGHT * this.aspect) / 2 / zoom;
    const halfH = VIEW_HEIGHT / 2 / zoom;
    const limX = Math.max(0, this.extent.x - halfW) + 0.5;
    const limY = Math.max(0, this.extent.y - halfH) + 0.5;
    p.x = THREE.MathUtils.clamp(p.x, -limX, limX);
    p.y = THREE.MathUtils.clamp(p.y, -limY, limY);
  }

  panBy(dxPx, dyPx) {
    const wpp = this.worldPerPixel(this.goalZoom);
    this.goalPan.x -= dxPx * wpp;
    this.goalPan.y += dyPx * wpp;
    this.clampPan(this.goalPan, this.goalZoom);
    this.pan.copy(this.goalPan);
  }

  /** Zoom keeping the point under (clientX, clientY) in place. */
  zoomAbout(factor, clientX, clientY) {
    const rect = this.el.getBoundingClientRect();
    // centre of the picture (it's shifted left while a side panel is open)
    const cx = clientX - rect.left - (this.width * this.area) / 2;
    const cy = clientY - rect.top - this.height / 2;
    const next = THREE.MathUtils.clamp(this.goalZoom * factor, this.minZoom, this.maxZoom);
    const delta = this.worldPerPixel(this.goalZoom) - this.worldPerPixel(next);
    this.goalPan.x += cx * delta;
    this.goalPan.y -= cy * delta;
    this.goalZoom = next;
    this.clampPan(this.goalPan, next);
    this.pan.copy(this.goalPan);
    this.zoom = next;
    this.apply(true);
  }

  pinchState() {
    const [a, b] = [...this.pointers.values()];
    return { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
  }

  bindEvents() {
    const el = this.el;

    el.addEventListener('pointerdown', (e) => {
      try {
        el.setPointerCapture(e.pointerId); // keep getting moves even if the finger slides off
      } catch {
        // pointer already gone; nothing to capture
      }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.gesture = { startX: e.clientX, startY: e.clientY, startTime: performance.now(), dragging: false, multi: false };
      } else if (this.gesture) {
        this.gesture.multi = true;
        this.gesture.dragging = true;
        this.pinch = this.pinchState();
      }
    });

    el.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev || !this.gesture) return;
      const p = { x: e.clientX, y: e.clientY };
      this.pointers.set(e.pointerId, p);

      if (this.pointers.size === 1) {
        const g = this.gesture;
        if (!g.dragging && Math.hypot(p.x - g.startX, p.y - g.startY) > DRAG_START_PX) g.dragging = true;
        if (g.dragging) this.panBy(p.x - prev.x, p.y - prev.y);
      } else if (this.pointers.size === 2 && this.pinch) {
        const next = this.pinchState();
        this.zoomAbout(next.dist / this.pinch.dist, next.midX, next.midY);
        this.panBy(next.midX - this.pinch.midX, next.midY - this.pinch.midY);
        this.pinch = next;
      }
    });

    const end = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      const g = this.gesture;
      if (e.type === 'pointerup' && g && !g.multi && !g.dragging && this.pointers.size === 0
        && performance.now() - g.startTime < TAP_MAX_MS) {
        this.onTap?.(e.clientX, e.clientY);
      }
      if (this.pointers.size === 2) this.pinch = this.pinchState();
      if (this.pointers.size === 0) {
        this.gesture = null;
        this.pinch = null;
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomAbout(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    }, { passive: false });
  }
}
