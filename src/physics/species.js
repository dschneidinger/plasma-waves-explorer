// Linear response of one warm-fluid species.
//
// Linearized momentum + continuity, all perturbations ∝ exp(i(k·x − ωt)):
//   −iω m v = q (E + v × B0) − i γ T k (n1/n0)
//   n1/n0  = k·v / ω
// ⇒ A v = q E,  A = −iω m I − q [·×B0] + i γ T k kᵀ / ω
// so v = R E with R = q A⁻¹.
//
// A species is {name, q, m, n0, T, gamma}. T = 0 gives the cold-fluid limit.

import { cx, inv3, scale } from './complex.js';

/** Real matrix C such that C v = v × B. */
export function crossMatrix(B) {
  return [
    [0, B[2], -B[1]],
    [-B[2], 0, B[0]],
    [B[1], -B[0], 0],
  ];
}

/** Velocity response matrix R (v = R E) for real ω and real wavevector k (3-array). */
export function responseMatrix(s, omega, k, B0) {
  const C = crossMatrix(B0);
  const A = [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) => {
      const re = -s.q * C[i][j];
      const im = (i === j ? -omega * s.m : 0) + (s.gamma * s.T * k[i] * k[j]) / omega;
      return cx(re, im);
    }),
  );
  return inv3(A).map((row) => row.map((x) => scale(x, s.q)));
}
