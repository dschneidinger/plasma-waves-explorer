// Phase 7 checks: the predict-first quiz is well formed for every toggle state.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, resolveMode } from '../src/physics/modes.js';
import { quizFor, answerKey, ANSWERS } from '../src/ui/predict.js';

function* states() {
  for (const B0 of ['off', 'on'])
    for (const kDir of ['par', 'perp'])
      for (const character of ['es', 'em'])
        for (const polarization of ['Epar', 'Eperp', 'R', 'L'])
          for (const ions of ['frozen', 'mobile'])
            for (const electrons of ['cold', 'warm'])
              for (const branch of ['high', 'low'])
                yield normalizeState({ B0, kDir, character, polarization, ions, electrons, branch });
}

test('every state has a valid answer, 4 distinct options including it, stable per seed', () => {
  const seen = new Set();
  for (const s of states()) {
    const res = resolveMode(s);
    const seed = new URLSearchParams(s).toString();
    const q = quizFor(res, seed);
    seen.add(q.answer);
    assert.ok(ANSWERS[q.answer], `unknown answer ${q.answer}`);
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map((o) => o.key)).size, 4);
    assert.ok(q.options.some((o) => o.key === q.answer));
    assert.deepEqual(quizFor(res, seed), q, 'options must not reshuffle');
  }
  // every answer can actually come up
  assert.deepEqual([...seen].sort(), Object.keys(ANSWERS).sort());
});

test('answer keys for a few named cases', () => {
  assert.equal(answerKey(resolveMode({ character: 'es', electrons: 'cold' })), 'plasmaOsc');
  assert.equal(answerKey(resolveMode({ character: 'es', electrons: 'warm' })), 'langmuir');
  assert.equal(answerKey(resolveMode({ character: 'em', ions: 'mobile' })), 'none');
  assert.equal(
    answerKey(resolveMode({ B0: 'on', kDir: 'par', character: 'em', polarization: 'L', ions: 'mobile' })),
    'alfven',
  );
});

test('random state: every answer is reachable, never repeats the avoided one', async () => {
  const { randomState, statesByAnswerKey } = await import('../src/ui/predict.js');
  assert.deepEqual(Object.keys(statesByAnswerKey()).sort(), Object.keys(ANSWERS).sort());
  let x = 1;
  const rand = () => ((x = (x * 48271) % 2147483647) / 2147483647);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const s = randomState(rand, 'whistler');
    assert.deepEqual(normalizeState(s), s);
    const a = answerKey(resolveMode(s));
    assert.notEqual(a, 'whistler');
    seen.add(a);
  }
  assert.equal(seen.size, Object.keys(ANSWERS).length - 1);
});
