// Minimal complex arithmetic and 3x3 linear algebra.
// A complex number is a plain object {re, im}; vectors are arrays of 3 complex
// numbers; matrices are arrays of 3 rows.

export const cx = (re, im = 0) => ({ re, im });
export const ZERO = cx(0);
export const ONE = cx(1);
export const I = cx(0, 1);

export const add = (a, b) => cx(a.re + b.re, a.im + b.im);
export const sub = (a, b) => cx(a.re - b.re, a.im - b.im);
export const mul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const scale = (a, s) => cx(a.re * s, a.im * s);
export const conj = (a) => cx(a.re, -a.im);
export const abs = (a) => Math.hypot(a.re, a.im);
export const arg = (a) => Math.atan2(a.im, a.re);
export const expi = (theta) => cx(Math.cos(theta), Math.sin(theta));

export function div(a, b) {
  const d = b.re * b.re + b.im * b.im;
  return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
}

export const det2 = (a, b, c, d) => sub(mul(a, d), mul(b, c));

export function det3(M) {
  return add(
    sub(
      mul(M[0][0], det2(M[1][1], M[1][2], M[2][1], M[2][2])),
      mul(M[0][1], det2(M[1][0], M[1][2], M[2][0], M[2][2])),
    ),
    mul(M[0][2], det2(M[1][0], M[1][1], M[2][0], M[2][1])),
  );
}

const OTHERS = [[1, 2], [0, 2], [0, 1]];

/** Inverse via the adjugate; fine for the small, well-scaled 3x3 systems here. */
export function inv3(M) {
  const d = det3(M);
  const cofactor = (i, j) => {
    const [r0, r1] = OTHERS[i];
    const [c0, c1] = OTHERS[j];
    const m = det2(M[r0][c0], M[r0][c1], M[r1][c0], M[r1][c1]);
    return (i + j) % 2 ? scale(m, -1) : m;
  };
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => div(cofactor(j, i), d)));
}

export const matVec = (M, v) =>
  M.map((row) => row.reduce((s, m, j) => add(s, mul(m, v[j])), ZERO));

/** Hermitian inner product a† b. */
export const dotH = (a, b) => a.reduce((s, ai, i) => add(s, mul(conj(ai), b[i])), ZERO);

export const vnorm = (v) => Math.sqrt(v.reduce((s, x) => s + x.re * x.re + x.im * x.im, 0));

export const vscale = (v, s) => v.map((x) => (typeof s === 'number' ? scale(x, s) : mul(x, s)));
