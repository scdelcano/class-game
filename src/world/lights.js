import * as THREE from 'three';

/**
 * Warm, cheerful lighting: a soft sky/ground fill plus one "sunlight" key
 * light coming in from the windows side. Only the key light casts shadows.
 */
export function addLights(scene) {
  const fill = new THREE.HemisphereLight('#fff8ea', '#f1d6b4', 1.6);
  scene.add(fill);

  const sun = new THREE.DirectionalLight('#fff0d2', 2.0);
  sun.position.set(-9, 14, 7);
  sun.target.position.set(1, 0, 0);
  sun.castShadow = true;
  const cam = sun.shadow.camera;
  cam.left = -12;
  cam.right = 12;
  cam.top = 12;
  cam.bottom = -12;
  cam.near = 1;
  cam.far = 45;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  return { fill, sun };
}
