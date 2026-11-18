// Pure helpers shared by the particle and vector views (no three.js, testable).
//
// A physical vector at position x and phase θ = ωt is Re[â exp(i(kx − θ))].
// Physics axes map to world axes as (x, y, z) → (x, z, −y); see scene.js.

import { vnorm } from '../physics/complex.js';

/** Re[â e^{iφ}] for a complex 3-vector â, as a plain [x, y, z] in physics axes. */
export function realVec(a, phi) {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return [a[0].re * c - a[0].im * s, a[1].re * c - a[1].im * s, a[2].re * c - a[2].im * s];
}

/**
 * Σ_j Re[â_j e^{i(k_j x − θ_j)}] for components [{kW, a}] (a = complex 3-vector or
 * null), as physics [x, y, z] written into `out`.
 */
export function sumRealVec(comps, x, thetas, out = [0, 0, 0]) {
  out[0] = out[1] = out[2] = 0;
  for (let j = 0; j < comps.length; j++) {
    const a = comps[j].a;
    if (!a) continue;
    const phi = comps[j].kW * x - thetas[j];
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    out[0] += a[0].re * c - a[0].im * s;
    out[1] += a[1].re * c - a[1].im * s;
    out[2] += a[2].re * c - a[2].im * s;
  }
  return out;
}

/** Physics [x, y, z] → world [x, y, z] (in place into `out`). */
export function toWorld(v, out = [0, 0, 0]) {
  out[0] = v[0];
  out[1] = v[2];
  out[2] = -v[1];
  return out;
}

/**
 * Displacement amplitudes ξ̂ for every species present, plus one shared scale
 * factor so the largest displacement is `maxWorld` world units. A shared scale
 * keeps electron vs ion motion honest (ions barely move in a Langmuir wave).
 */
export function displacementScale(sol, maxWorld) {
  const max = Math.max(...Object.values(sol.species).map((s) => vnorm(s.xi)));
  return max > 0 ? maxWorld / max : 0;
}

/**
 * Shape of a species' orbit over one period: how far it moves along each axis
 * and whether it is a line (linear polarization) or a loop. Used by tests and
 * the legend.
 */
export function orbitShape(a, samples = 64) {
  let maxR = 0;
  let minR = Infinity;
  for (let n = 0; n < samples; n++) {
    const r = Math.hypot(...realVec(a, (2 * Math.PI * n) / samples));
    maxR = Math.max(maxR, r);
    minR = Math.min(minR, r);
  }
  // ratio of minor to major axis: 0 = straight line, 1 = circle
  return { major: maxR, ellipticity: maxR > 0 ? minR / maxR : 0 };
}
