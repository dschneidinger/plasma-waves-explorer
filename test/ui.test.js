// Phase 4 checks: text helper is safe, chip labels exist, mode text renders.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { richText } from '../src/ui/text.js';
import { solveMode } from '../src/physics/eigenmode.js';
import { MODES } from '../src/physics/modeSpecs.js';
import { listFields } from '../src/render/fields.js';
import { resolveMode, normalizeState } from '../src/physics/modes.js';

test('richText subscripts and escapes', () => {
  assert.equal(richText('v_φ'), 'v<sub>φ</sub>');
  assert.equal(richText('ω_UH and ω_L'), 'ω<sub>UH</sub> and ω<sub>L</sub>');
  assert.equal(richText('kλ_D'), 'kλ<sub>D</sub>');
  assert.equal(richText('0.951 v_A'), '0.951 v<sub>A</sub>');
  assert.equal(richText('<b>x</b> & y'), '&lt;b&gt;x&lt;/b&gt; &amp; y');
  // long identifiers are left alone
  assert.equal(richText('some_identifier'), 'some_identifier');
});

test('every field has a chip label and a row', () => {
  for (const id of Object.keys(MODES)) {
    for (const f of listFields(solveMode(id, { electrons: 'warm', ionTemp: 'warm' }))) {
      assert.ok(f.short && f.row && f.rowLabel, `${id}/${f.id} missing chip info`);
    }
  }
});

test('all mode text is free of stray markup and renders through richText', () => {
  const seen = new Set();
  for (const B0 of ['off', 'on'])
    for (const kDir of ['par', 'perp'])
      for (const character of ['es', 'em'])
        for (const polarization of ['Epar', 'Eperp', 'R', 'L'])
          for (const ions of ['frozen', 'mobile'])
            for (const electrons of ['cold', 'warm'])
              for (const branch of ['high', 'low']) {
                const r = resolveMode(normalizeState({ B0, kDir, character, polarization, ions, electrons, branch, ionTemp: 'warm' }));
                const texts = r.status === 'mode' ? [...r.facts, ...r.notes, ...r.warnings] : [r.explanation];
                for (const t of texts) {
                  if (seen.has(t)) continue;
                  seen.add(t);
                  assert.ok(!/<\/?[a-z]/i.test(t), `markup in: ${t}`); // "<" as less-than is fine
                  assert.ok(!richText(t).includes('_'), `unconverted subscript in: ${t}`);
                }
              }
});
