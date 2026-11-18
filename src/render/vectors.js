// Vector view: E₁ and B₁ arrows sampled along the k axis, plus the curve traced by
// their tips. Circular polarization shows up as the classic helix; electrostatic
// waves show E₁ arrows pointing along k and no B₁ at all.

import * as THREE from 'three';
import { WORLD } from './world.js';
import { sumRealVec, toWorld } from './kinematics.js';

const ARROWS_PER_LAMBDA = 32 / 3;
const MAX_ARROWS = 128;
const N_CURVE = 600;
const HEAD_LEN = 0.22;
const UP = new THREE.Vector3(0, 1, 0);

function makeField() {
  const shaftGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 8).translate(0, 0.5, 0);
  const headGeo = new THREE.ConeGeometry(0.075, HEAD_LEN, 12).translate(0, HEAD_LEN / 2, 0);
  const mat = new THREE.MeshLambertMaterial();
  const shafts = new THREE.InstancedMesh(shaftGeo, mat, MAX_ARROWS);
  const heads = new THREE.InstancedMesh(headGeo, mat, MAX_ARROWS);
  shafts.frustumCulled = heads.frustumCulled = false;
  const curveMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7 });
  const curve = new THREE.Line(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_CURVE * 3), 3)),
    curveMat,
  );
  curve.frustumCulled = false;
  const group = new THREE.Group();
  group.add(shafts, heads, curve);
  return { group, shafts, heads, curve, mat, curveMat, comps: [], present: false };
}

export function createVectors() {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(-3, 8, 5);
  group.add(sun);

  const { L } = WORLD;
  const axisMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.6 });
  const axis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-L / 2, 0, 0), new THREE.Vector3(L / 2, 0, 0)]),
    axisMat,
  );
  group.add(axis);

  const fields = { E: makeField(), B: makeField() };
  for (const f of Object.values(fields)) group.add(f.group);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const dir = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const d = [0, 0, 0];
  const w = [0, 0, 0];
  const show = { E: true, B: true };
  let nArrows = 32;

  function updateField(f, thetas) {
    if (!f.present) return;
    for (let n = 0; n < nArrows; n++) {
      const x = -L / 2 + ((n + 0.5) * L) / nArrows;
      toWorld(sumRealVec(f.comps, x, thetas, d), w);
      dir.set(w[0], w[1], w[2]);
      const len = dir.length();
      if (len < 1e-4) {
        m.makeScale(0, 0, 0);
        f.shafts.setMatrixAt(n, m);
        f.heads.setMatrixAt(n, m);
        continue;
      }
      dir.divideScalar(len);
      q.setFromUnitVectors(UP, dir);
      const head = Math.min(HEAD_LEN, len);
      pos.set(x, 0, 0);
      m.compose(pos, q, scl.set(1, Math.max(len - head, 1e-4), 1));
      f.shafts.setMatrixAt(n, m);
      pos.addScaledVector(dir, len - head);
      m.compose(pos, q, scl.set(head / HEAD_LEN, head / HEAD_LEN, head / HEAD_LEN));
      f.heads.setMatrixAt(n, m);
    }
    f.shafts.instanceMatrix.needsUpdate = true;
    f.heads.instanceMatrix.needsUpdate = true;

    const arr = f.curve.geometry.attributes.position.array;
    for (let n = 0; n < N_CURVE; n++) {
      const x = -L / 2 + (n * L) / (N_CURVE - 1);
      toWorld(sumRealVec(f.comps, x, thetas, d), w);
      arr[3 * n] = x + w[0];
      arr[3 * n + 1] = w[1];
      arr[3 * n + 2] = w[2];
    }
    f.curve.geometry.attributes.position.needsUpdate = true;
  }

  return {
    group,
    /** Arrow spacing in world units for a given number of wavelengths shown. */
    spacingFor: (wavelengths) => L / Math.min(MAX_ARROWS, Math.round(ARROWS_PER_LAMBDA * wavelengths)),
    /** comps: [{ kW, E, B }] with E, B already in world-scaled units (or null if ≡ 0). */
    setComponents(comps, wavelengths) {
      nArrows = Math.min(MAX_ARROWS, Math.round(ARROWS_PER_LAMBDA * wavelengths));
      for (const name of ['E', 'B']) {
        const f = fields[name];
        f.comps = comps.map((c) => ({ kW: c.kW, a: c[name] }));
        f.present = f.comps.some((c) => c.a);
        f.shafts.count = f.heads.count = nArrows;
        f.group.visible = show[name] && f.present;
      }
    },
    setShown(name, on) {
      show[name] = on;
      fields[name].group.visible = on && fields[name].present;
    },
    hasField: (name) => fields[name].present,
    update(thetas) {
      for (const f of Object.values(fields)) updateField(f, thetas);
    },
    setTheme(c) {
      fields.E.mat.color.set(c.vecE);
      fields.E.curveMat.color.set(c.vecE);
      fields.B.mat.color.set(c.vecB);
      fields.B.curveMat.color.set(c.vecB);
      axisMat.color.set(c.axis);
    },
  };
}
