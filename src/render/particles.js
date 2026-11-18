// Fluid-element view: a lattice of electron and ion "blobs", each displaced by
// Σ_j Re[ξ̂_j exp(i(k_j x − θ_j))] (exaggerated). For a plane wave each element's
// orbit is drawn faintly; that is what shows the polarization at a glance.

import * as THREE from 'three';
import { WORLD } from './world.js';
import { realVec, sumRealVec, toWorld } from './kinematics.js';

const PER_LAMBDA = 10; // elements per wavelength along k
const ROWS = 3; // rows per species across the plane (physics y → world z)
const MAX_WAVELENGTHS = 10;
const MAX_PER_SPECIES = PER_LAMBDA * MAX_WAVELENGTHS * ROWS;
const ORBIT_SAMPLES = 32;

// Electrons fill the front half of the plane, ions the back half, so the two
// species never hide each other. `side` is +1 (front) or −1 (back).
function latticePositions(side, wavelengths) {
  const { L, W } = WORLD;
  const nx = PER_LAMBDA * wavelengths;
  const dx = L / nx;
  const dz = W / 2 / ROWS;
  const pts = [];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ROWS; j++) pts.push([-L / 2 + (i + 0.5) * dx, 0, side * (j + 0.5) * dz]);
  return pts;
}

function makeSpecies(side, radius) {
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(radius, 14, 10),
    new THREE.MeshLambertMaterial(),
    MAX_PER_SPECIES,
  );
  mesh.frustumCulled = false;
  const orbitMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 });
  const orbits = new THREE.LineSegments(new THREE.BufferGeometry(), orbitMat);
  orbits.frustumCulled = false;
  return { side, radius, eq: [], mesh, orbits, orbitMat, comps: [], moving: false };
}

export function createParticles() {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-3, 8, 5);
  group.add(sun);

  const species = { e: makeSpecies(1, 0.085), i: makeSpecies(-1, 0.11) };
  for (const s of Object.values(species)) group.add(s.mesh, s.orbits);

  const m = new THREE.Matrix4();
  const d = [0, 0, 0];
  const w = [0, 0, 0];
  let showOrbits = true;
  let orbitsAllowed = true;
  let blobScale = 1;

  function buildOrbits(s) {
    s.orbits.geometry.dispose();
    s.orbits.geometry = new THREE.BufferGeometry();
    if (!s.moving || s.comps.length !== 1) return;
    // plane wave: every element has the same orbit shape, only the phase differs
    const shape = [];
    for (let n = 0; n < ORBIT_SAMPLES; n++)
      shape.push(toWorld(realVec(s.comps[0].a, (2 * Math.PI * n) / ORBIT_SAMPLES), [0, 0, 0]));
    const pos = new Float32Array(s.eq.length * ORBIT_SAMPLES * 6);
    let o = 0;
    for (const p of s.eq)
      for (let n = 0; n < ORBIT_SAMPLES; n++) {
        const a = shape[n];
        const b = shape[(n + 1) % ORBIT_SAMPLES];
        pos.set([p[0] + a[0], p[1] + a[1], p[2] + a[2], p[0] + b[0], p[1] + b[1], p[2] + b[2]], o);
        o += 6;
      }
    s.orbits.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  }

  function refreshOrbitVisibility() {
    for (const s of Object.values(species)) s.orbits.visible = showOrbits && orbitsAllowed && s.moving;
  }

  return {
    group,
    /**
     * comps: [{ kW, xi: { e, i } }] with ξ already in world-scaled units (complex
     * 3-vectors in physics axes; a missing species means frozen ions).
     */
    setComponents(comps, wavelengths) {
      orbitsAllowed = comps.length === 1;
      blobScale = Math.min(1, 3.5 / wavelengths); // denser lattice → smaller blobs
      for (const [name, s] of Object.entries(species)) {
        s.eq = latticePositions(s.side, wavelengths);
        s.mesh.count = s.eq.length;
        s.comps = comps.map((c) => ({ kW: c.kW, a: c.xi[name] ?? null }));
        s.moving = s.comps.some((c) => c.a);
        buildOrbits(s);
      }
      refreshOrbitVisibility();
    },
    setShowOrbits(on) {
      showOrbits = on;
      refreshOrbitVisibility();
    },
    update(thetas) {
      for (const s of Object.values(species)) {
        for (let n = 0; n < s.eq.length; n++) {
          const p = s.eq[n];
          m.makeScale(blobScale, blobScale, blobScale);
          if (s.moving) {
            toWorld(sumRealVec(s.comps, p[0], thetas, d), w);
            m.setPosition(p[0] + w[0], p[1] + w[1], p[2] + w[2]);
          } else {
            m.setPosition(p[0], p[1], p[2]);
          }
          s.mesh.setMatrixAt(n, m);
        }
        s.mesh.instanceMatrix.needsUpdate = true;
      }
    },
    setTheme(c) {
      species.e.mesh.material.color.set(c.electron);
      species.i.mesh.material.color.set(c.ion);
      species.e.orbitMat.color.set(c.electron);
      species.i.orbitMat.color.set(c.ion);
    },
  };
}
