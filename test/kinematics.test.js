// Phase 5 checks: what the fluid-element view will show matches the textbook picture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveMode } from '../src/physics/eigenmode.js';
import { orbitShape, realVec, displacementScale } from '../src/render/kinematics.js';
import { abs, vnorm } from '../src/physics/complex.js';

const warm = { electrons: 'warm', ionTemp: 'warm' };
const cold = { electrons: 'cold', ionTemp: 'cold' };

test('Langmuir / ion acoustic: electrons move only along k (longitudinal)', () => {
  for (const id of ['langmuir', 'ionAcoustic']) {
    const xi = solveMode(id, warm).species.e.xi;
    assert.ok(abs(xi[1]) === 0 && abs(xi[2]) === 0, `${id}: transverse displacement`);
    assert.ok(orbitShape(xi).ellipticity < 1e-9, `${id}: orbit should be a line`);
  }
});

test('light and O mode: electrons move only ⊥ k (transverse), along a line', () => {
  for (const id of ['light', 'O']) {
    const xi = solveMode(id, cold).species.e.xi;
    assert.equal(abs(xi[0]), 0, `${id}: displacement along k`);
    assert.ok(orbitShape(xi).ellipticity < 1e-9);
  }
  // O mode: along B0 (physics y)
  const xi = solveMode('O', cold).species.e.xi;
  assert.ok(abs(xi[1]) > 0 && abs(xi[2]) === 0);
});

test('R, L, whistler: electrons move on circles ⊥ k', () => {
  for (const id of ['Rhigh', 'L', 'whistler']) {
    const xi = solveMode(id, cold).species.e.xi;
    assert.equal(abs(xi[0]), 0);
    assert.ok(Math.abs(orbitShape(xi).ellipticity - 1) < 1e-9, `${id}: not circular`);
  }
});

test('upper hybrid and X mode: electrons trace ellipses in the plane ⊥ B0', () => {
  for (const id of ['upperHybrid', 'Xlower', 'Xupper']) {
    const xi = solveMode(id, cold).species.e.xi;
    assert.equal(abs(xi[1]), 0, `${id}: motion along B0`); // B0 ∥ physics y
    const e = orbitShape(xi).ellipticity;
    assert.ok(e > 0.01 && e < 0.999, `${id}: ellipticity ${e}`);
  }
});

test('shear Alfvén: electrons and ions drift together', () => {
  const s = solveMode('alfvenL', { ...cold, k: 1e-4 }).species;
  const rel = vnorm(s.e.xi.map((x, j) => ({ re: x.re - s.i.xi[j].re, im: x.im - s.i.xi[j].im }))) / vnorm(s.e.xi);
  assert.ok(rel < 0.01, `relative difference ${rel}`);
});

test('shared displacement scale keeps the largest species at maxWorld', () => {
  for (const id of ['langmuir', 'ionAcoustic', 'lowerHybrid', 'alfvenR']) {
    const sol = solveMode(id, warm);
    const sc = displacementScale(sol, 0.4);
    const biggest = Math.max(...Object.values(sol.species).map((s) => vnorm(s.xi) * sc));
    assert.ok(Math.abs(biggest - 0.4) < 1e-12);
  }
});

test('realVec matches Re[a e^{iφ}]', () => {
  const a = [{ re: 1, im: 0 }, { re: 0, im: 1 }, { re: 2, im: -1 }];
  const v = realVec(a, Math.PI / 2); // e^{iπ/2} = i
  assert.deepEqual(v.map((x) => Math.round(x * 1e12) / 1e12), [0, -1, 1]);
});
