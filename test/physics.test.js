// Phase 1 checks: the 2-fluid eigenmode solver reproduces Chen's dispersion
// relations in their limits, and the eigenvectors have the right character.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeParams } from '../src/physics/params.js';
import { MODES, POL_L } from '../src/physics/modeSpecs.js';
import { solveMode, solveOmega, buildPlasma } from '../src/physics/eigenmode.js';
import { dispersionTensor, dispersionValue } from '../src/physics/dispersion.js';
import { abs, matVec, vnorm, mul, I, scale, sub } from '../src/physics/complex.js';

const p = makeParams();
const cold = { electrons: 'cold', ionTemp: 'cold' };
const warm = { electrons: 'warm', ionTemp: 'cold' };

function close(got, want, tol, msg) {
  assert.ok(
    Math.abs(got - want) <= tol * Math.abs(want),
    `${msg}: got ${got}, expected ${want} (rel tol ${tol})`,
  );
}

const solve = (id, opts) => {
  const m = solveMode(id, opts);
  assert.ok(m, `${id} should exist for ${JSON.stringify(opts)}`);
  return m;
};

// --- electrostatic electron modes -------------------------------------------

test('cold plasma oscillation: ω = ωpe and it does not propagate', () => {
  for (const geometry of ['none', 'par']) {
    const m = solve('langmuir', { ...cold, geometry, k: 3 });
    close(m.omega, 1, 1e-10, 'ω');
    assert.ok(Math.abs(m.vgroup) < 1e-8, `v_g should be 0, got ${m.vgroup}`);
  }
});

test('Langmuir (Bohm–Gross): ω² = ωpe² + 3k²Te, v_g = 3kTe/ω', () => {
  const k = 6;
  const want = Math.sqrt(1 + 3 * k * k * p.Te);
  for (const geometry of ['none', 'par']) {
    const m = solve('langmuir', { ...warm, geometry, k });
    close(m.omega, want, 1e-10, `ω (${geometry})`);
    close(m.vgroup, (3 * k * p.Te) / want, 1e-5, 'v_g');
  }
});

test('upper hybrid: ω² = ωpe² + Ωe² (+3k²Te warm)', () => {
  close(solve('upperHybrid', { ...cold, k: 4 }).omega, p.wuh, 1e-10, 'cold');
  close(
    solve('upperHybrid', { ...warm, k: 4 }).omega,
    Math.sqrt(p.wuh ** 2 + 3 * 16 * p.Te),
    1e-10,
    'warm',
  );
});

// --- electrostatic ion modes -------------------------------------------------

test('ion acoustic matches Chen (cold and warm ions)', () => {
  const k = 0.3 / p.lambdaD;
  const l2 = k * k * p.Te;
  const coldIons = Math.sqrt(p.Te / p.M / (1 + l2)) * k;
  const warmIons = Math.sqrt(p.Te / p.M / (1 + l2) + (3 * p.Ti) / p.M) * k;
  close(solve('ionAcoustic', { ...warm, k }).omega, coldIons, 1e-3, 'Ti = 0');
  close(
    solve('ionAcoustic', { electrons: 'warm', ionTemp: 'warm', k }).omega,
    warmIons,
    1e-2,
    'Ti = 0.1 Te',
  );
});

test('no ion acoustic wave with cold electrons', () => {
  assert.equal(solveMode('ionAcoustic', { electrons: 'cold', ionTemp: 'warm' }), null);
  assert.equal(solveMode('ionAcoustic', cold), null);
});

test('lower hybrid matches Chen 1/ωLH² = 1/(ΩeΩi) + 1/ωpi² (cold)', () => {
  close(solve('lowerHybrid', { ...cold, k: 2 }).omega, p.wlh, 1e-3, 'ωLH');
});

// --- high-frequency electromagnetic modes (cold formulas are exact here) ----

const nX = (w) => 1 - ((w * w - 1) / (w * w)) * (1 / (w * w - p.wuh ** 2));
const nR = (w) => 1 - 1 / (w * (w - p.wce));
const nL = (w) => 1 - 1 / (w * (w + p.wce));

test('light wave and O mode: ω² = ωpe² + c²k²', () => {
  for (const id of ['light', 'O'])
    for (const opts of [cold, warm]) close(solve(id, { ...opts, k: 1.5 }).omega, Math.sqrt(1 + 2.25), 1e-10, id);
});

test('X, R, L, whistler satisfy Chen n²(ω) and lie on the right branch', () => {
  const cases = [
    ['Xupper', nX, (w) => w > p.wR],
    ['Xlower', nX, (w) => w > p.wL && w < p.wuh],
    ['Rhigh', nR, (w) => w > p.wR],
    ['whistler', nR, (w) => w < p.wce],
    ['L', nL, (w) => w > p.wL],
  ];
  for (const [id, n2, onBranch] of cases) {
    for (const k of [0.5, 1.5, 4]) {
      const m = solve(id, { ...cold, k });
      close((k * k) / m.omega ** 2, n2(m.omega), 1e-8, `${id} k=${k}`);
      assert.ok(onBranch(m.omega), `${id} k=${k}: ω=${m.omega} off branch`);
    }
  }
});

test('R/L labels: only right-hand polarization has a branch below Ωe', () => {
  const spec = { ...MODES.whistler, kind: { type: 'proj', vec: POL_L } };
  const plasma = buildPlasma(spec, p, cold);
  assert.equal(solveOmega(spec, plasma, p, 1), null);
  // and the electrons in a whistler co-rotate with E: v_z = i v_y
  const m = solve('whistler', cold);
  const v = m.species.e.v;
  assert.ok(abs(sub(v[2], mul(I, v[1]))) < 1e-10 * vnorm(v));
});

test('whistler approaches Ωe at large k (resonance)', () => {
  const m = solve('whistler', { ...cold, k: 50 });
  assert.ok(m.omega < p.wce && m.omega > 0.99 * p.wce, `ω = ${m.omega}`);
});

// --- low-frequency electromagnetic modes -------------------------------------

test('shear Alfvén: R and L both give ω ≈ k vA / √(1 + vA²/c²) for ω ≪ Ωi', () => {
  const k = (0.02 * p.wci) / p.vA;
  const want = (k * p.vA) / Math.sqrt(1 + p.vA ** 2);
  for (const id of ['alfvenR', 'alfvenL']) close(solve(id, { ...cold, k }).omega, want, 2e-2, id);
});

test('magnetosonic matches Chen ω²/k² = c²(vs² + vA²)/(c² + vA²)', () => {
  const k = (0.02 * p.wci) / p.vA;
  const want = (vs2) => k * Math.sqrt((vs2 + p.vA ** 2) / (1 + p.vA ** 2));
  close(solve('magnetosonic', { ...cold, k }).omega, want(0), 1e-2, 'cold');
  const vs2 = (p.Te + 3 * p.Ti) / p.M;
  close(
    solve('magnetosonic', { electrons: 'warm', ionTemp: 'warm', k }).omega,
    want(vs2),
    1e-2,
    'warm',
  );
});

// --- eigenvector character ---------------------------------------------------

const ALL = Object.keys(MODES);
const variants = [cold, warm, { electrons: 'warm', ionTemp: 'warm' }];

test("Gauss's law i k E_x = ρ1 holds for every mode", () => {
  for (const id of ALL)
    for (const opts of variants) {
      const m = solveMode(id, opts);
      if (!m) continue;
      const lhs = scale(mul(I, m.E[0]), m.k);
      const err = abs(sub(lhs, m.rho));
      assert.ok(err <= 1e-6 * Math.max(abs(m.rho), abs(lhs), 1e-300) + 1e-12, `${id}: |ikEx − ρ| = ${err}`);
    }
});

test('electromagnetic eigenvectors satisfy the full D·E = 0', () => {
  for (const id of ALL.filter((id) => MODES[id].kind.type !== 'es'))
    for (const opts of variants) {
      const m = solveMode(id, opts);
      if (!m) continue;
      const D = dispersionTensor(m.plasma.species, m.omega, [m.k, 0, 0], m.plasma.B0);
      const scaleD = Math.max(...D.flat().map(abs));
      const res = vnorm(matVec(D, m.E));
      assert.ok(res < 1e-8 * scaleD, `${id}: |D·E| = ${res}, |D| ~ ${scaleD}`);
    }
});

test('purely transverse modes have no density perturbation', () => {
  for (const id of ['light', 'O', 'Rhigh', 'whistler', 'L', 'alfvenR', 'alfvenL']) {
    const m = solve(id, warm);
    for (const s of Object.values(m.species)) assert.equal(abs(s.n), 0, `${id}: n1 ≠ 0`);
  }
});

test('X mode and magnetosonic are partly longitudinal (n1 ≠ 0)', () => {
  for (const id of ['Xupper', 'Xlower', 'magnetosonic']) {
    const m = solve(id, cold);
    assert.ok(abs(m.E[0]) > 1e-6, `${id}: E_x should be nonzero`);
    assert.ok(abs(m.species.e.n) > 0, `${id}: n_e1 should be nonzero`);
  }
});

test('electrostatic modes have B1 = 0 and a potential', () => {
  for (const id of ['langmuir', 'ionAcoustic', 'upperHybrid', 'lowerHybrid']) {
    const m = solve(id, warm);
    assert.equal(vnorm(m.B), 0, `${id}: B1 ≠ 0`);
    assert.ok(m.phi && abs(m.phi) > 0, `${id}: φ missing`);
  }
});

test('Langmuir: ions frozen; ion acoustic: ions and electrons move together', () => {
  assert.equal(solve('langmuir', warm).species.i, undefined);
  const ia = solve('ionAcoustic', warm);
  // quasi-neutral at kλD = 0.3: n_i ≈ n_e (1 + k²λD²)
  close(abs(ia.species.i.n) / abs(ia.species.e.n), 1 + 0.09, 1e-2, 'n_i / n_e');
});

test('dispersion function is real at real ω (lossless, Hermitian D)', () => {
  for (const id of ALL) {
    const spec = MODES[id];
    const plasma = buildPlasma(spec, p, { electrons: 'warm', ionTemp: 'warm', geometry: 'par' });
    const k = spec.defaultK(p);
    const w = spec.seed(p, k, plasma) * 1.37;
    const f = dispersionValue(spec.kind, plasma, w, k);
    assert.ok(Math.abs(f.im) <= 1e-10 * Math.max(1, Math.abs(f.re)), `${id}: Im f = ${f.im}`);
  }
});

test('every mode exists at its default k with warm electrons', () => {
  for (const id of ALL) assert.ok(solveMode(id, warm), `${id} missing`);
});
