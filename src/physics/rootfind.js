// Real root finding for the dispersion function on a frequency interval.
//
// The function has poles (cyclotron / thermal resonances) as well as zeros, and
// both flip its sign. We scan a log grid, refine every sign change with Brent's
// method, and keep only points where |f| actually went to zero.

export function brent(f, a, b, fa = f(a), fb = f(b), tol = 1e-14, maxIter = 200) {
  let c = a, fc = fa, d = b - a, e = d;
  for (let iter = 0; iter < maxIter; iter++) {
    if (fb * fc > 0) { c = a; fc = fa; d = b - a; e = d; }
    if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * tol * Math.abs(b);
    const m = 0.5 * (c - b);
    if (Math.abs(m) <= tol1 || fb === 0) return b;
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      let p, q, r;
      const s = fb / fa;
      if (a === c) {
        p = 2 * m * s; q = 1 - s;
      } else {
        q = fa / fc; r = fb / fc;
        p = s * (2 * m * q * (q - r) - (b - a) * (r - 1));
        q = (q - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q; else p = -p;
      if (2 * p < Math.min(3 * m * q - Math.abs(tol1 * q), Math.abs(e * q))) { e = d; d = p / q; }
      else { d = m; e = d; }
    } else { d = m; e = d; }
    a = b; fa = fb;
    b += Math.abs(d) > tol1 ? d : (m > 0 ? tol1 : -tol1);
    fb = f(b);
  }
  return b;
}

/** All genuine roots of f in (lo, hi), lo > 0, found on an n-point log grid. */
export function findRoots(f, lo, hi, n = 800) {
  const roots = [];
  const r = Math.log(hi / lo) / (n - 1);
  let xPrev = lo, fPrev = f(lo);
  for (let i = 1; i < n; i++) {
    const x = lo * Math.exp(r * i);
    const fx = f(x);
    if (Number.isFinite(fPrev) && Number.isFinite(fx)) {
      if (fx === 0) roots.push(x);
      else if (fPrev * fx < 0) {
        const root = brent(f, xPrev, x, fPrev, fx);
        // A pole also flips the sign; there |f| blows up instead of vanishing.
        if (Math.abs(f(root)) <= 1e-4 * Math.max(Math.abs(fPrev), Math.abs(fx))) roots.push(root);
      }
    }
    xPrev = x; fPrev = fx;
  }
  return roots;
}
