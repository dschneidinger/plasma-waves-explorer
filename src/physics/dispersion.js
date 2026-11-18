// Dielectric tensor, dispersion tensor, and the scalar dispersion function
// whose real roots are the wave frequencies.
//
// Maxwell (c = ε0 = μ0 = 1):  B = k×E/ω,  i k×B = J − iωE
// ⇒ D(ω,k) E = 0,  D = (k kᵀ − k² I)/ω² + ε,  ε = I + (i/ω) Σ_s q_s n0_s R_s.
// For a lossless fluid D is Hermitian at real ω, so the scalar functions below
// are real (up to round-off).

import { cx, add, mul, scale, I, det2, dotH, matVec } from './complex.js';
import { responseMatrix } from './species.js';

export function dielectric(species, omega, k, B0) {
  const eps = [0, 1, 2].map((i) => [0, 1, 2].map((j) => cx(i === j ? 1 : 0)));
  for (const s of species) {
    const R = responseMatrix(s, omega, k, B0);
    const f = (s.q * s.n0) / omega;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) eps[i][j] = add(eps[i][j], mul(I, scale(R[i][j], f)));
  }
  return eps;
}

export function dispersionTensor(species, omega, k, B0) {
  const eps = dielectric(species, omega, k, B0);
  const k2 = k[0] * k[0] + k[1] * k[1] + k[2] * k[2];
  const w2 = omega * omega;
  return eps.map((row, i) =>
    row.map((e, j) => add(e, cx((k[i] * k[j] - (i === j ? k2 : 0)) / w2))),
  );
}

/**
 * Scalar dispersion function for a mode "kind" (k is along x):
 *  - {type:'es'}               electrostatic: k·ε·k / k² = ε_xx
 *  - {type:'proj', vec}        decoupled polarization e: e† D e
 *  - {type:'block', idx:[a,b]} 2x2 decoupled block: det of D restricted to (a,b)
 * Returns a complex number; its real part is the function to root-find.
 */
export function dispersionValue(kind, plasma, omega, k) {
  const kv = [k, 0, 0];
  if (kind.type === 'es') return dielectric(plasma.species, omega, kv, plasma.B0)[0][0];
  const D = dispersionTensor(plasma.species, omega, kv, plasma.B0);
  if (kind.type === 'proj') return dotH(kind.vec, matVec(D, kind.vec));
  if (kind.type === 'block') {
    const [a, b] = kind.idx;
    return det2(D[a][a], D[a][b], D[b][a], D[b][b]);
  }
  throw new Error(`unknown mode kind ${kind.type}`);
}
