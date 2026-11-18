// Phase 6 checks: packets move at v_g, and dispersion curves are fast and continuous.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPacket, envelope, PACKET } from '../src/physics/packet.js';
import { solveMode, dispersionCurve } from '../src/physics/eigenmode.js';
import { MODES } from '../src/physics/modeSpecs.js';
import { validityWarnings } from '../src/physics/validity.js';
import { richText } from '../src/ui/text.js';

/** Location of the envelope peak, searched within one box length. */
function peak(packet, t, guess) {
  const L = (2 * Math.PI * PACKET.wavelengths) / packet.k0;
  let best = guess;
  let bestVal = -1;
  for (let n = 0; n <= 4000; n++) {
    const x = guess - L / 2 + (n * L) / 4000;
    const v = envelope(packet, x, t);
    if (v > bestVal) {
      bestVal = v;
      best = x;
    }
  }
  return best;
}

test('weights sum to 1 and the envelope peaks at 1 at t = 0, x = 0', () => {
  const p = buildPacket('langmuir', { electrons: 'warm' }, 6);
  const sum = p.components.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-12);
  assert.ok(Math.abs(envelope(p, 0, 0) - 1) < 1e-12);
  assert.equal(p.components.length, 2 * PACKET.halfCount + 1);
});

test('cold plasma oscillation packet stays put (v_g = 0)', () => {
  const p = buildPacket('langmuir', { electrons: 'cold' }, 6);
  const t = 50; // ~8 periods
  assert.ok(Math.abs(peak(p, t, 0)) < 1e-3);
});

test('packet envelope moves at the group velocity, not the phase velocity', () => {
  const cases = [
    ['langmuir', { electrons: 'warm' }],
    ['whistler', { electrons: 'cold' }],
    ['light', { electrons: 'cold' }],
    ['ionAcoustic', { electrons: 'warm' }],
  ];
  for (const [id, opts] of cases) {
    const k0 = MODES[id].defaultK(solveMode(id, opts).params);
    const sol0 = solveMode(id, { ...opts, k: k0 });
    const p = buildPacket(id, opts, k0);
    const lambda = (2 * Math.PI) / k0;
    const t = (2 * lambda) / Math.abs(sol0.vgroup); // time to move two wavelengths
    const x = peak(p, t, sol0.vgroup * t);
    const v = x / t;
    assert.ok(Math.abs(v - sol0.vgroup) < 0.05 * Math.abs(sol0.vgroup), `${id}: packet ${v}, v_g ${sol0.vgroup}`);
    assert.ok(Math.abs(v - sol0.vphase) > 0.05 * sol0.vphase || Math.abs(sol0.vgroup - sol0.vphase) < 0.05 * sol0.vphase);
  }
});

test('dispersion curves: every mode, 100 points, fast, finite near k0', () => {
  for (const id of Object.keys(MODES)) {
    const opts = { electrons: 'warm', ionTemp: 'warm', geometry: 'par' };
    const k0 = solveMode(id, opts).k;
    const ks = Array.from({ length: 100 }, (_, n) => k0 * 20 ** ((n - 50) / 50));
    const t0 = performance.now();
    const ws = dispersionCurve(id, ks, opts);
    const ms = performance.now() - t0;
    assert.ok(ms < 400, `${id}: ${ms.toFixed(0)} ms`);
    // the curve through k0 must exist and agree with a direct solve there
    const w0 = solveMode(id, opts).omega;
    const mid = dispersionCurve(id, [k0], opts)[0];
    assert.ok(Math.abs(mid - w0) < 1e-9 * w0, `${id}: curve ${mid} vs ${w0}`);
    assert.ok(Number.isFinite(ws[50]), `${id}: NaN at k0`);
  }
});

test('validity warnings: quiet at default k, loud where the fluid model fails', () => {
  for (const id of Object.keys(MODES)) {
    const sol = solveMode(id, { electrons: 'warm', ionTemp: 'warm', geometry: 'par' });
    assert.deepEqual(validityWarnings(sol), [], `${id} warns at its default k`);
  }
  assert.equal(validityWarnings(solveMode('langmuir', { electrons: 'warm', k: 20 })).length, 1);
  assert.equal(validityWarnings(solveMode('ionAcoustic', { electrons: 'warm', k: 40 })).length, 1);
  const p = solveMode('alfvenL', {}).params;
  const w = validityWarnings(solveMode('alfvenL', { k: (0.5 * p.wci) / p.vA }));
  assert.equal(w.length, 1);
  assert.ok(!richText(w[0]).includes('_'));
});
