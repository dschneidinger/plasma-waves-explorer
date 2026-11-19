// "Predict first": before the wave is named, the student picks which wave these
// toggles produce (or that none exists). Pure logic, unit-tested.

import { normalizeState, resolveMode } from '../physics/modes.js';

export const ANSWERS = {
  plasmaOsc: 'Plasma oscillation',
  langmuir: 'Langmuir wave',
  ionAcoustic: 'Ion acoustic wave',
  upperHybrid: 'Upper hybrid',
  lowerHybrid: 'Lower hybrid',
  light: 'Light wave',
  O: 'O mode',
  X: 'X mode',
  R: 'R wave',
  whistler: 'Whistler',
  L: 'L wave',
  alfven: 'Shear Alfvén wave',
  magnetosonic: 'Magnetosonic wave',
  none: 'No wave exists here',
};

/** Which answer a resolveMode() result corresponds to. */
export function answerKey(res) {
  if (res.status !== 'mode') return 'none';
  switch (res.modeId) {
    case 'langmuir':
      return res.name.startsWith('Plasma oscillation') ? 'plasmaOsc' : 'langmuir';
    case 'Xupper':
    case 'Xlower':
      return 'X';
    case 'Rhigh':
      return 'R';
    case 'alfvenR':
    case 'alfvenL':
      return 'alfven';
    default:
      return res.modeId;
  }
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Four options (the answer plus three distractors), stable for a given seed so
 * re-rendering never reshuffles them under the student's cursor.
 */
export function quizFor(res, seed) {
  const answer = answerKey(res);
  const rand = rng(hashString(seed));
  const others = shuffle(
    Object.keys(ANSWERS).filter((k) => k !== answer),
    rand,
  ).slice(0, 3);
  const options = shuffle([answer, ...others], rand).map((key) => ({ key, label: ANSWERS[key] }));
  return { answer, options };
}

// --- "Random wave": a toggle state for the student to identify ---------------------


let statesByAnswer = null;

/** Every distinct normalized toggle state, grouped by its answer key. */
export function statesByAnswerKey() {
  if (statesByAnswer) return statesByAnswer;
  const seen = new Set();
  statesByAnswer = {};
  for (const B0 of ['off', 'on'])
    for (const kDir of ['par', 'perp'])
      for (const character of ['es', 'em'])
        for (const polarization of ['Epar', 'Eperp', 'R', 'L'])
          for (const ions of ['frozen', 'mobile'])
            for (const electrons of ['cold', 'warm'])
              for (const ionTemp of ['cold', 'warm'])
                for (const branch of ['high', 'low']) {
                  const s = normalizeState({ B0, kDir, character, polarization, ions, electrons, ionTemp, branch });
                  const key = new URLSearchParams(s).toString();
                  if (seen.has(key)) continue;
                  seen.add(key);
                  (statesByAnswer[answerKey(resolveMode(s))] ??= []).push(s);
                }
  return statesByAnswer;
}

/**
 * A random toggle state: first an answer chosen uniformly (so rare waves come up as
 * often as common ones, and "no wave" is one of them), then a state producing it.
 * `avoid` is an answer key not to repeat.
 */
export function randomState(rand = Math.random, avoid = null) {
  const groups = statesByAnswerKey();
  const keys = Object.keys(groups).filter((k) => k !== avoid);
  const pool = groups[keys[Math.floor(rand() * keys.length)]];
  return pool[Math.floor(rand() * pool.length)];
}
