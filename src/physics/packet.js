// Wave packet = a few eigenmodes of the same branch with k near k0.
//
// The display box holds `wavelengths` wavelengths of k0. Choosing k_j = k0 (1 + j/wavelengths)
// makes every component periodic in that box, so the packet wraps around cleanly.
// Each component has its own ω(k_j), so the envelope moves at the group velocity
// while the crests move at the phase velocity.

import { solveMode } from './eigenmode.js';

export const PACKET = {
  wavelengths: 10, // box length in units of λ0
  halfCount: 4, // components j = −4 … 4
  sigmaLambdas: 1.5, // envelope width (standard deviation) in units of λ0
};

/** Returns { k0, components: [{ j, k, omega, sol, weight }] } with weights summing to 1. */
export function buildPacket(modeId, opts, k0) {
  const n = PACKET.wavelengths;
  const dk = k0 / n;
  const sigmaK = 1 / (PACKET.sigmaLambdas * ((2 * Math.PI) / k0));
  const components = [];
  for (let j = -PACKET.halfCount; j <= PACKET.halfCount; j++) {
    const k = k0 + j * dk;
    const sol = solveMode(modeId, { ...opts, k });
    if (!sol) continue;
    const weight = Math.exp(-((j * dk) ** 2) / (2 * sigmaK ** 2));
    components.push({ j, k, omega: sol.omega, sol, weight });
  }
  const total = components.reduce((s, c) => s + c.weight, 0);
  for (const c of components) c.weight /= total;
  return { k0, components };
}

/** |Σ w_j e^{i(k_j x − ω_j t)}| — the packet envelope (for tests and the inset). */
export function envelope(packet, x, t) {
  let re = 0;
  let im = 0;
  for (const c of packet.components) {
    const th = c.k * x - c.omega * t;
    re += c.weight * Math.cos(th);
    im += c.weight * Math.sin(th);
  }
  return Math.hypot(re, im);
}
