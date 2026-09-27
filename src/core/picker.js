import * as THREE from 'three';

/**
 * Finds which tappable 3D object is under a screen point.
 * Register an object (or a group) with a handler; tapping any mesh inside it
 * calls the handler. Small objects should include an invisible hit proxy
 * (see hitProxy in world/shapes.js) so little fingers can hit them.
 */
export class Picker {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    /** @type {Map<THREE.Object3D, (hit: THREE.Intersection) => void>} */
    this.targets = new Map();
  }

  add(object, handler) {
    this.targets.set(object, handler);
  }

  remove(object) {
    this.targets.delete(object);
  }

  /** Returns true if something was tapped. */
  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.camera.updateMatrixWorld(); // the camera may have moved since the last frame
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects([...this.targets.keys()], true);
    for (const hit of hits) {
      let o = hit.object;
      while (o && !this.targets.has(o)) o = o.parent;
      if (o) {
        this.targets.get(o)(hit);
        return true;
      }
    }
    return false;
  }
}
