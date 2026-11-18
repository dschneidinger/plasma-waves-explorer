// Phase 3 checks: field list and shared normalization tell the truth about zeros.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveMode } from '../src/physics/eigenmode.js';
import { MODES } from '../src/physics/modeSpecs.js';
import { listFields, defaultFieldId } from '../src/render/fields.js';
import { abs } from '../src/physics/complex.js';

const warm = { electrons: 'warm', ionTemp: 'warm' };
const get = (fields, id) => fields.find((f) => f.id === id);

test('each group is scaled so its largest member has |norm| = 1', () => {
  for (const id of Object.keys(MODES)) {
    const fields = listFields(solveMode(id, warm));
    const groups = new Set(fields.map((f) => f.group));
    for (const g of groups) {
      const max = Math.max(...fields.filter((f) => f.group === g).map((f) => abs(f.norm)));
      assert.ok(max === 0 || Math.abs(max - 1) < 1e-12, `${id}/${g}: max |norm| = ${max}`);
      for (const f of fields.filter((f) => f.group === g)) assert.ok(abs(f.norm) <= 1 + 1e-12);
    }
  }
});

test('electrostatic waves: every B₁ component is flagged ≡ 0', () => {
  for (const id of ['langmuir', 'ionAcoustic', 'upperHybrid', 'lowerHybrid']) {
    const fields = listFields(solveMode(id, warm));
    for (const c of ['x', 'y', 'z']) assert.equal(get(fields, `B_${c}`).status, 'zero', `${id} B_${c}`);
  }
});

test('transverse waves: densities flagged ≡ 0', () => {
  for (const id of ['light', 'O', 'Rhigh', 'whistler', 'L', 'alfvenR', 'alfvenL']) {
    const fields = listFields(solveMode(id, warm));
    assert.equal(get(fields, 'n_e').status, 'zero', id);
  }
});

test('frozen ions: no ion quantities offered', () => {
  const fields = listFields(solveMode('langmuir', warm));
  assert.ok(!fields.some((f) => f.id.startsWith('n_i') || f.id.startsWith('vi_')));
});

test('ion acoustic is quasi-neutral: ρ₁ is tiny compared with the densities', () => {
  const fields = listFields(solveMode('ionAcoustic', warm));
  const rho = get(fields, 'rho');
  assert.ok(rho.rel < 0.1, `ρ rel = ${rho.rel}`);
  assert.equal(get(fields, 'n_i').status, 'ok');
});

test('magnetosonic is strongly quasi-neutral: ρ₁ flagged small', () => {
  const rho = get(listFields(solveMode('magnetosonic', warm)), 'rho');
  assert.equal(rho.status, 'small');
});

test('default field is n_e for ES waves and a nonzero E component for EM waves', () => {
  for (const id of Object.keys(MODES)) {
    const fields = listFields(solveMode(id, warm));
    const es = MODES[id].kind.type === 'es';
    const f = get(fields, defaultFieldId(fields, es));
    assert.equal(f.status, 'ok', `${id}: default ${f.id} is ${f.status}`);
    if (es) assert.equal(f.id, 'n_e');
  }
});
