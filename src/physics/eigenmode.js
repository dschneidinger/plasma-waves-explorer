// Solve one branch at one k and reconstruct every perturbed quantity.
//
// All amplitudes are complex and given per unit |E1|; a physical field is
// Re[ amp · exp(i(kx − ωt)) ].

import { cx, abs, arg, mul, scale, I, expi, matVec, vnorm, vscale, ZERO, add } from './complex.js';
import { makeParams } from './params.js';
import { MODES } from './modeSpecs.js';
import { dispersionValue, dispersionTensor } from './dispersion.js';
import { responseMatrix } from './species.js';
import { findRoots } from './rootfind.js';

/**
 * Resolve toggles into concrete species and B0.
 * opts.electrons: 'cold' | 'warm'; opts.ionTemp: 'cold' | 'warm';
 * opts.geometry: 'none' | 'par' (only for specs with geometry 'either').
 */
export function buildPlasma(spec, p, opts = {}) {
  const Te = opts.electrons === 'warm' ? p.Te : 0;
  const Ti = spec.ions && opts.ionTemp === 'warm' ? p.Ti : 0;
  const species = [
    { name: 'e', q: -1, m: 1, n0: 1, T: Te, gamma: spec.timescale === 'ion' ? 1 : 3 },
  ];
  if (spec.ions) species.push({ name: 'i', q: 1, m: p.M, n0: 1, T: Ti, gamma: 3 });
  const geometry = spec.geometry === 'either' ? (opts.geometry ?? 'none') : spec.geometry;
  const B0 = geometry === 'none' ? [0, 0, 0] : geometry === 'par' ? [p.B0, 0, 0] : [0, p.B0, 0];
  return { species, Te, Ti, B0, geometry };
}

/**
 * Frequency of `spec` at wavenumber k, or null if the branch does not exist there.
 * `scan` narrows the search around the seed: {span, n} searches seed/span … seed·span
 * on an n-point grid (used for fast continuation along a curve).
 */
export function solveOmega(spec, plasma, p, k, seedOverride, scan = { span: 1e3, n: 800 }) {
  const seed = seedOverride ?? spec.seed(p, k, plasma);
  if (!(seed > 0) || !(k > 0)) return null;
  let [lo, hi] = spec.interval(p, k, plasma);
  lo = Math.max(lo, seed / scan.span) * (1 + 1e-9);
  hi = Math.min(hi, seed * scan.span) * (1 - 1e-9);
  if (!(hi > lo)) return null;
  const f = (w) => dispersionValue(spec.kind, plasma, w, k).re;
  const roots = findRoots(f, lo, hi, scan.n);
  if (!roots.length) return null;
  return roots.reduce((best, r) =>
    Math.abs(Math.log(r / seed)) < Math.abs(Math.log(best / seed)) ? r : best,
  );
}

/** Null vector of the solved part of D: the wave's E1 polarization (unnormalized). */
function polarization(spec, plasma, omega, k) {
  const kind = spec.kind;
  if (kind.type === 'es') return [cx(1), ZERO, ZERO];
  if (kind.type === 'proj') return kind.vec.slice();
  const D = dispersionTensor(plasma.species, omega, [k, 0, 0], plasma.B0);
  const [a, b] = kind.idx;
  // rows of the singular 2x2 block give two candidate null vectors; take the better-scaled one
  const c1 = [scale(D[a][b], -1), D[a][a]];
  const c2 = [D[b][b], scale(D[b][a], -1)];
  const pick = vnorm(c1) >= vnorm(c2) ? c1 : c2;
  const E = [ZERO, ZERO, ZERO];
  E[a] = pick[0];
  E[b] = pick[1];
  return E;
}

/** Unit norm, with the largest component made real and positive. */
function normalize(E) {
  const n = vnorm(E);
  let big = E[0];
  for (const x of E) if (abs(x) > abs(big)) big = x;
  return vscale(E, scale(expi(-arg(big)), 1 / n));
}

/** All perturbed quantities for a solved (ω, k, E1). */
export function fieldsFromE(spec, plasma, omega, k, E) {
  const kv = [k, 0, 0];
  // B1 = k × E1 / ω with k = k x̂
  const B = [ZERO, scale(E[2], -k / omega), scale(E[1], k / omega)];
  const species = {};
  let rho = ZERO;
  let J = [ZERO, ZERO, ZERO];
  for (const s of plasma.species) {
    const v = matVec(responseMatrix(s, omega, kv, plasma.B0), E);
    const n = scale(v[0], (s.n0 * k) / omega); // n1 = n0 k·v / ω
    species[s.name] = {
      v,
      n,
      p: scale(n, s.gamma * s.T),
      xi: vscale(v, scale(I, 1 / omega)), // displacement ξ = i v / ω
    };
    rho = add(rho, scale(n, s.q));
    J = J.map((Ji, i) => add(Ji, scale(v[i], s.q * s.n0)));
  }
  // electrostatic potential: E = −ikφ ⇒ φ = i E_x / k
  const phi = spec.kind.type === 'es' ? scale(mul(I, E[0]), 1 / k) : null;
  return { E, B, species, rho, J, phi };
}

/**
 * Solve a mode. Returns null when the branch doesn't exist for these toggles.
 * opts: { k, params, electrons, ionTemp, geometry }
 */
export function solveMode(modeId, opts = {}) {
  const spec = MODES[modeId];
  if (!spec) throw new Error(`unknown mode ${modeId}`);
  const p = opts.params ?? makeParams();
  const plasma = buildPlasma(spec, p, opts);
  const k = opts.k ?? spec.defaultK(p);
  const omega = solveOmega(spec, plasma, p, k);
  if (omega == null) return null;

  // group velocity by central difference, staying on the same branch
  const dk = k * 1e-4;
  const wp = solveOmega(spec, plasma, p, k + dk, omega);
  const wm = solveOmega(spec, plasma, p, k - dk, omega);
  const vgroup = wp != null && wm != null ? (wp - wm) / (2 * dk) : NaN;

  const E = normalize(polarization(spec, plasma, omega, k));
  return {
    modeId,
    name: spec.name,
    k,
    omega,
    vphase: omega / k,
    vgroup,
    plasma,
    params: p,
    ...fieldsFromE(spec, plasma, omega, k, E),
  };
}

/** ω(k) along a branch; NaN where it doesn't exist. Uses continuation for the seed. */
export function dispersionCurve(modeId, ks, opts = {}) {
  const spec = MODES[modeId];
  const p = opts.params ?? makeParams();
  const plasma = buildPlasma(spec, p, opts);
  let prev = null;
  return ks.map((k) => {
    // narrow search near the previous point first; fall back to a full scan
    let w = prev != null ? solveOmega(spec, plasma, p, k, prev, { span: 2, n: 40 }) : null;
    if (w == null) w = solveOmega(spec, plasma, p, k);
    prev = w;
    return w ?? NaN;
  });
}
