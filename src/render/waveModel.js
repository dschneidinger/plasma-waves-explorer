// Turn solved components (one for a plane wave, several for a packet) into the
// scaled inputs each renderer needs. Pure (no three.js), so it is unit-tested.
//
// All scale factors come from the k0 component, so a packet's peak looks like
// the plane wave it is built from, and zero-vs-nonzero stays honest.

import { scale, vnorm, vscale, ZERO } from '../physics/complex.js';
import { WORLD } from './world.js';
import { listFields } from './fields.js';
import { displacementScale } from './kinematics.js';

const MAX_ARROW = 1.3; // world length of the largest vector arrow
const MAX_DISPLACEMENT_LAMBDAS = 0.1; // largest fluid displacement, in wavelengths

/**
 * components: [{ k, sol, weight }] (weights sum to 1); k0: central wavenumber;
 * wavelengths: how many λ0 fit across the plane; arrowSpacing: world spacing of arrows.
 */
export function buildDisplay(components, k0, wavelengths, fieldId, arrowSpacing) {
  const sol0 = components.reduce((a, b) => (Math.abs(b.k - k0) < Math.abs(a.k - k0) ? b : a)).sol;
  const lambdaW = WORLD.L / wavelengths;
  const kW = (k) => ((2 * Math.PI) / lambdaW) * (k / k0);

  // surface: one scalar quantity, normalized by its group max at k0
  const fields0 = listFields(sol0);
  const f0 = fields0.find((f) => f.id === fieldId);
  const groupMax = Math.max(...fields0.filter((f) => f.group === f0.group).map((f) => Math.hypot(f.amp.re, f.amp.im)));
  const surface = components.map((c) => {
    const f = listFields(c.sol).find((x) => x.id === fieldId);
    const amp = f0.status === 'zero' || !f ? ZERO : scale(f.amp, c.weight / groupMax);
    return { kW: kW(c.k), amp };
  });

  // particles: shared displacement scale across species
  const dScale = displacementScale(sol0, MAX_DISPLACEMENT_LAMBDAS * lambdaW);
  const particles = components.map((c) => ({
    kW: kW(c.k),
    xi: Object.fromEntries(Object.entries(c.sol.species).map(([n, s]) => [n, vscale(s.xi, dScale * c.weight)])),
  }));

  // vectors: E and B scaled separately; along-k length capped near the arrow spacing
  const vecScale = (v) => {
    const n = vnorm(v);
    if (n === 0) return 0;
    const along = Math.hypot(v[0].re, v[0].im);
    return Math.min(MAX_ARROW / n, along > 0 ? (1.4 * arrowSpacing) / along : Infinity);
  };
  const sE = vecScale(sol0.E);
  const sB = vecScale(sol0.B);
  const vectors = components.map((c) => ({
    kW: kW(c.k),
    E: sE ? vscale(c.sol.E, sE * c.weight) : null,
    B: sB ? vscale(c.sol.B, sB * c.weight) : null,
  }));

  return { sol0, lambdaW, surface, particles, vectors };
}
