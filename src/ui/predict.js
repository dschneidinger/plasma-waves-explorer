// "Predict first": before the wave is named, the student picks which wave these
// toggles produce (or that none exists). Pure logic, unit-tested.

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
