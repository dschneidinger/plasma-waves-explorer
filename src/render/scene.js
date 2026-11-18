// three.js scene: camera, controls, floor with wavelength ticks, k and B0 arrows.
//
// World layout: the wave travels along world +x, the plane is x–z, and world +y
// (up) is the displayed field value. Physics axes map as
//   physics x (along k)  → world x
//   physics y (in plane) → world −z
//   physics z            → world y
// which keeps both frames right-handed.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import { WORLD } from './world.js';
export { WORLD };

export const physToWorld = ([x, y, z]) => new THREE.Vector3(x, z, -y);

function label(text, cls) {
  const el = document.createElement('div');
  el.className = `scene-label ${cls ?? ''}`;
  el.textContent = text;
  return new CSS2DObject(el);
}

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'scene-labels';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(-5.5, 6.5, 12.5);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0.5, -0.4, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 5;
  controls.maxDistance = 40;

  // --- floor: outline plus wavelength ticks (rebuilt when the box size changes) ---
  const { L, W, floorY } = WORLD;
  const floorMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.5 });
  const floor = new THREE.LineSegments(new THREE.BufferGeometry(), floorMat);
  scene.add(floor);
  const lambdaLabel = label('λ', 'muted');
  scene.add(lambdaLabel);

  function setWavelengths(n) {
    const lambda = L / n;
    const quarters = n <= 4; // quarter-wavelength ticks only when they aren't crowded
    const pts = [];
    const seg = (a, b) => pts.push(new THREE.Vector3(...a), new THREE.Vector3(...b));
    seg([-L / 2, floorY, -W / 2], [L / 2, floorY, -W / 2]);
    seg([-L / 2, floorY, W / 2], [L / 2, floorY, W / 2]);
    const steps = quarters ? 4 * n : n;
    for (let i = 0; i <= steps; i++) {
      const x = -L / 2 + (i * L) / steps;
      const major = !quarters || i % 4 === 0;
      seg([x, floorY, -W / 2], [x, floorY, major ? W / 2 : -W / 2 + 0.3]);
    }
    floor.geometry.dispose();
    floor.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    lambdaLabel.position.set(-L / 2 + lambda / 2, floorY, W / 2 + 0.35);
  }
  setWavelengths(WORLD.wavelengths);

  // --- k and B0 arrows ------------------------------------------------------------
  const arrows = new THREE.Group();
  scene.add(arrows);
  const kColor = new THREE.Color();
  const bColor = new THREE.Color();

  let currentGeometry = 'none';
  function setArrows(geometry) {
    currentGeometry = geometry;
    arrows.clear();
    const kOrigin = new THREE.Vector3(-L / 2, floorY, W / 2 + 1.0);
    const k = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), kOrigin, 3, kColor, 0.45, 0.25);
    const kl = label('k', 'k');
    kl.position.copy(kOrigin).add(new THREE.Vector3(3.35, 0, 0));
    arrows.add(k, kl);
    if (geometry === 'none') return;
    const dir = physToWorld(geometry === 'par' ? [1, 0, 0] : [0, 1, 0]);
    // in front of the surface so it is never hidden behind the crests
    const origin =
      geometry === 'par'
        ? new THREE.Vector3(-L / 2, floorY, W / 2 + 1.8)
        : new THREE.Vector3(L / 2 + 1.6, floorY, W / 2 - 0.5);
    const len = geometry === 'par' ? 3 : W - 1;
    const b = new THREE.ArrowHelper(dir, origin, len, bColor, 0.45, 0.25);
    const bl = label('B₀', 'b0');
    bl.position.copy(origin).addScaledVector(dir, len + 0.4);
    arrows.add(b, bl);
  }

  function setTheme(c) {
    scene.background = new THREE.Color(c.bg);
    floorMat.color.set(c.floor);
    kColor.set(c.k);
    bColor.set(c.b0);
    setArrows(currentGeometry); // ArrowHelper copies its color at construction
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitCamera();
  }

  // Back the camera off along its current viewing direction until the whole plane
  // (plus arrows) fits horizontally and vertically.
  function fitCamera() {
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    const need = Math.max((0.62 * (L + 3)) / Math.tan(hHalf), (0.62 * (W + 5)) / Math.tan(vHalf));
    const dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, Math.min(need, controls.maxDistance));
  }
  new ResizeObserver(resize).observe(container);
  resize();

  return {
    scene,
    setWavelengths,
    setArrows,
    setArrowsVisible(on) {
      arrows.visible = on;
    },
    setTheme,
    render() {
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    },
  };
}
