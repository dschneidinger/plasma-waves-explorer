// Phase 6 checks: display scaling for plane waves and packets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDisplay } from '../src/render/waveModel.js';
import { buildPacket } from '../src/physics/packet.js';
import { solveMode } from '../src/physics/eigenmode.js';
import { listFields } from '../src/render/fields.js';
import { abs, vnorm } from '../src/physics/complex.js';
import { WORLD } from '../src/render/world.js';

const plane = (id, opts) => {
  const sol = solveMode(id, opts);
  return { comps: [{ k: sol.k, sol, weight: 1 }], k0: sol.k };
};

test('plane wave surface amplitude equals the fields.js normalized amplitude', () => {
  const { comps, k0 } = plane('Xlower', {});
  for (const f of listFields(comps[0].sol)) {
    const d = buildDisplay(comps, k0, 3, f.id, 0.4);
    assert.ok(Math.abs(abs(d.surface[0].amp) - abs(f.norm)) < 1e-12, f.id);
  }
});

test('plane wave world wavenumber is 2π / (L/3)', () => {
  const { comps, k0 } = plane('light', {});
  const d = buildDisplay(comps, k0, 3, 'E_y', 0.4);
  assert.ok(Math.abs(d.surface[0].kW - (2 * Math.PI * 3) / WORLD.L) < 1e-12);
});

test('packet: weights carry through, zero fields stay zero, B null for ES', () => {
  const p = buildPacket('langmuir', { electrons: 'warm' }, 6);
  const d = buildDisplay(p.components, p.k0, 10, 'B_y', 0.1);
  assert.ok(d.surface.every((c) => abs(c.amp) === 0));
  assert.ok(d.vectors.every((c) => c.B === null && c.E));
  const total = d.surface.length;
  assert.equal(total, p.components.length);
  // sum of |amp| for a nonzero field is ≈ 1 at the peak
  const dn = buildDisplay(p.components, p.k0, 10, 'n_e', 0.1);
  const sum = dn.surface.reduce((s, c) => s + abs(c.amp), 0);
  assert.ok(Math.abs(sum - 1) < 0.05, `sum ${sum}`);
});

test('largest fluid displacement is λ/10 for a plane wave', () => {
  const { comps, k0 } = plane('ionAcoustic', { electrons: 'warm' });
  const d = buildDisplay(comps, k0, 3, 'n_e', 0.4);
  const max = Math.max(...Object.values(d.particles[0].xi).map(vnorm));
  assert.ok(Math.abs(max - 0.1 * (WORLD.L / 3)) < 1e-12);
});
