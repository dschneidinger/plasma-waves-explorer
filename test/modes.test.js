// Phase 2 checks: every toggle combination resolves to a sensible wave or a
// "no wave" card, and the UI hints (hidden / inert toggles) are honest.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOGGLES, normalizeState, visibleToggles, resolveMode } from '../src/physics/modes.js';
import { MODES } from '../src/physics/modeSpecs.js';
import { solveMode } from '../src/physics/eigenmode.js';

// Every raw combination, including invalid ones the UI could never produce.
const RAW_VALUES = {
  B0: ['off', 'on'],
  kDir: ['par', 'perp'],
  character: ['es', 'em'],
  polarization: ['Epar', 'Eperp', 'R', 'L'],
  ions: ['frozen', 'mobile'],
  electrons: ['cold', 'warm'],
  ionTemp: ['cold', 'warm'],
  branch: ['high', 'low'],
};

function* allStates() {
  const keys = Object.keys(RAW_VALUES);
  const rec = function* (i, acc) {
    if (i === keys.length) return yield { ...acc };
    for (const v of RAW_VALUES[keys[i]]) yield* rec(i + 1, { ...acc, [keys[i]]: v });
  };
  yield* rec(0, {});
}

const STATES = [...allStates()];
const key = (r) => (r.status === 'mode' ? `${r.modeId}|${r.name}|${JSON.stringify(r.solveOpts)}` : r.title);

// cache solves: many states share the same (mode, options)
const solveCache = new Map();
function solved(r) {
  const k = `${r.modeId}|${JSON.stringify(r.solveOpts)}`;
  if (!solveCache.has(k)) solveCache.set(k, solveMode(r.modeId, r.solveOpts));
  return solveCache.get(k);
}

test('normalizeState is idempotent and leaves every visible toggle on a valid option', () => {
  for (const raw of STATES) {
    const s = normalizeState(raw);
    assert.deepEqual(normalizeState(s), s);
    for (const t of visibleToggles(s))
      assert.ok(t.options.some((o) => o.value === t.value), `${t.id}=${t.value} invalid`);
  }
});

test('every combination resolves; every resolved mode actually solves', () => {
  for (const raw of STATES) {
    const r = resolveMode(raw);
    if (r.status === 'none') {
      assert.ok(r.title && r.explanation && r.suggestions.length, 'incomplete no-mode card');
      continue;
    }
    assert.ok(MODES[r.modeId], `unknown mode ${r.modeId}`);
    assert.ok(r.name && r.equation && r.facts.length, `${r.modeId}: missing text`);
    assert.ok(solved(r), `${r.modeId} ${JSON.stringify(r.solveOpts)} has no solution`);
  }
});

test('every physics mode is reachable from the toggles', () => {
  const reached = new Set(STATES.map(resolveMode).filter((r) => r.status === 'mode').map((r) => r.modeId));
  assert.deepEqual([...reached].sort(), Object.keys(MODES).sort());
});

test('hidden toggles never change the result', () => {
  for (const raw of STATES) {
    const s = normalizeState(raw);
    const shown = new Set(visibleToggles(s).map((t) => t.id));
    const base = key(resolveMode(s));
    for (const t of TOGGLES) {
      if (shown.has(t.id)) continue;
      for (const v of RAW_VALUES[t.id])
        assert.equal(key(resolveMode({ ...s, [t.id]: v })), base, `hidden ${t.id} changed result`);
    }
  }
});

test('"no wave" suggestions lead to a wave', () => {
  for (const raw of STATES) {
    const r = resolveMode(raw);
    if (r.status !== 'none') continue;
    for (const sug of r.suggestions)
      assert.equal(resolveMode({ ...normalizeState(raw), ...sug.patch }).status, 'mode', sug.label);
  }
});

test('temperature toggles marked inert really leave ω unchanged, and others really change it', () => {
  for (const raw of STATES) {
    const s = normalizeState(raw);
    const r = resolveMode(s);
    if (r.status !== 'mode') continue;
    for (const t of visibleToggles(s).filter((t) => t.id === 'electrons' || t.id === 'ionTemp')) {
      const other = t.value === 'cold' ? 'warm' : 'cold';
      const r2 = resolveMode({ ...s, [t.id]: other });
      if (t.inertReason) {
        assert.equal(r2.modeId, r.modeId);
        const w1 = solved(r).omega, w2 = solved(r2).omega;
        assert.ok(Math.abs(w1 - w2) <= 1e-9 * w1, `${r.modeId}: inert ${t.id} changed ω ${w1} → ${w2}`);
      } else if (r2.status === 'mode' && r2.modeId === r.modeId) {
        const w1 = solved(r).omega, w2 = solved(r2).omega;
        assert.ok(Math.abs(w1 - w2) > 1e-9 * w1, `${r.modeId}: ${t.id} has no effect but isn't marked inert`);
      }
    }
  }
});

// The table in plan.md, row by row.
const TABLE = [
  [{ character: 'es', ions: 'frozen', electrons: 'cold' }, 'langmuir', 'Plasma oscillation'],
  [{ character: 'es', ions: 'frozen', electrons: 'warm' }, 'langmuir', 'Langmuir wave (Bohm–Gross)'],
  [{ B0: 'on', kDir: 'par', character: 'es', ions: 'frozen', electrons: 'warm' }, 'langmuir'],
  [{ character: 'es', ions: 'mobile', electrons: 'warm' }, 'ionAcoustic'],
  [{ B0: 'on', kDir: 'par', character: 'es', ions: 'mobile', electrons: 'warm' }, 'ionAcoustic'],
  [{ character: 'es', ions: 'mobile', electrons: 'cold' }, null],
  [{ B0: 'on', kDir: 'perp', character: 'es', ions: 'frozen' }, 'upperHybrid'],
  [{ B0: 'on', kDir: 'perp', character: 'es', ions: 'mobile' }, 'lowerHybrid'],
  [{ character: 'em', ions: 'frozen' }, 'light'],
  [{ character: 'em', ions: 'mobile' }, null],
  [{ B0: 'on', kDir: 'perp', character: 'em', polarization: 'Epar', ions: 'frozen' }, 'O'],
  [{ B0: 'on', kDir: 'perp', character: 'em', polarization: 'Epar', ions: 'mobile' }, null],
  [{ B0: 'on', kDir: 'perp', character: 'em', polarization: 'Eperp', ions: 'frozen', branch: 'high' }, 'Xupper'],
  [{ B0: 'on', kDir: 'perp', character: 'em', polarization: 'Eperp', ions: 'frozen', branch: 'low' }, 'Xlower'],
  [{ B0: 'on', kDir: 'perp', character: 'em', polarization: 'Eperp', ions: 'mobile' }, 'magnetosonic'],
  [{ B0: 'on', kDir: 'par', character: 'em', polarization: 'R', ions: 'frozen', branch: 'high' }, 'Rhigh'],
  [{ B0: 'on', kDir: 'par', character: 'em', polarization: 'R', ions: 'frozen', branch: 'low' }, 'whistler'],
  [{ B0: 'on', kDir: 'par', character: 'em', polarization: 'L', ions: 'frozen' }, 'L'],
  [{ B0: 'on', kDir: 'par', character: 'em', polarization: 'R', ions: 'mobile' }, 'alfvenR'],
  [{ B0: 'on', kDir: 'par', character: 'em', polarization: 'L', ions: 'mobile' }, 'alfvenL'],
];

test('toggle → mode table matches the plan', () => {
  for (const [state, modeId, name] of TABLE) {
    const r = resolveMode(state);
    if (modeId == null) assert.equal(r.status, 'none', JSON.stringify(state));
    else {
      assert.equal(r.modeId, modeId, JSON.stringify(state));
      if (name) assert.equal(r.name, name);
    }
  }
});

test('branch toggle appears only where two branches exist', () => {
  for (const raw of STATES) {
    const s = normalizeState(raw);
    const hasBranch = visibleToggles(s).some((t) => t.id === 'branch');
    const r = resolveMode(s);
    const multi = r.status === 'mode' && ['Xupper', 'Xlower', 'Rhigh', 'whistler'].includes(r.modeId);
    assert.equal(hasBranch, multi, JSON.stringify(s));
  }
});
