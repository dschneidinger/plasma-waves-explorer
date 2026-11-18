// Physics definition of each wave branch.
//
// Geometry: k = k x̂ always.
//   'none' : B0 = 0
//   'par'  : B0 = B0 x̂  (k ∥ B0)
//   'perp' : B0 = B0 ŷ  (k ⊥ B0; B0 lies in the rendered x–y plane)
//   'either': B0 is irrelevant (the user's toggle picks 'none' or 'par')
//
// Each spec gives:
//   ions       – whether ions respond (false = frozen ions)
//   timescale  – 'electron' (γe = 3, 1D adiabatic) or 'ion' (γe = 1, isothermal)
//   kind       – which part of D(ω,k) to solve (see dispersion.js)
//   interval   – frequency range that contains this branch only
//   seed       – Chen-style estimate of ω, used to pick the root if several remain
//   defaultK   – wavenumber shown by default
//
// `pl` below is the resolved plasma (actual Te, Ti after the warm/cold toggles).

import { cx } from './complex.js';

const sq = Math.sqrt;
const h = 1 / Math.SQRT2;

// With B0 along +x, (ŷ + iẑ) rotates right-handed about B0, like the electrons.
export const POL_R = [cx(0), cx(h), cx(0, h)];
export const POL_L = [cx(0), cx(h), cx(0, -h)];
export const POL_Y = [cx(0), cx(1), cx(0)];

const ES = { type: 'es' };
const XBLOCK = { type: 'block', idx: [0, 2] }; // E in the plane ⊥ B0 (x, z)
const upTo = (w) => 3 * w + 1; // generous upper bound for high-frequency branches

const alfvenSeed = (p, k) => (k * p.vA) / sq(1 + p.vA * p.vA);
const alfvenK = (p) => (0.1 * p.wci) / p.vA;

export const MODES = {
  langmuir: {
    name: 'Langmuir wave',
    ions: false, timescale: 'electron', geometry: 'either', kind: ES,
    seed: (p, k, pl) => sq(1 + 3 * k * k * pl.Te),
    interval: (p, k, pl) => [k * sq(3 * pl.Te), upTo(sq(1 + 3 * k * k * pl.Te))],
    defaultK: (p) => 0.3 / p.lambdaD,
  },
  ionAcoustic: {
    name: 'Ion acoustic wave',
    ions: true, timescale: 'ion', geometry: 'either', kind: ES,
    seed: (p, k, pl) =>
      pl.Te > 0 ? k * sq(pl.Te / p.M / (1 + k * k * pl.Te) + (3 * pl.Ti) / p.M) : NaN,
    // between the ion thermal pole and the electron thermal pole
    interval: (p, k, pl) => [k * sq((3 * pl.Ti) / p.M), k * sq(pl.Te)],
    defaultK: (p) => 0.3 / p.lambdaD,
  },
  upperHybrid: {
    name: 'Upper hybrid oscillation',
    ions: false, timescale: 'electron', geometry: 'perp', kind: ES,
    seed: (p, k, pl) => sq(1 + p.wce * p.wce + 3 * k * k * pl.Te),
    interval: (p, k, pl) => [p.wce, upTo(sq(1 + p.wce * p.wce + 3 * k * k * pl.Te))],
    defaultK: () => 4,
  },
  lowerHybrid: {
    name: 'Lower hybrid oscillation',
    ions: true, timescale: 'ion', geometry: 'perp', kind: ES,
    seed: (p) => p.wlh,
    interval: (p) => [p.wci, p.wce],
    defaultK: () => 2,
  },
  light: {
    name: 'Light wave',
    ions: false, timescale: 'electron', geometry: 'none', kind: { type: 'proj', vec: POL_Y },
    seed: (p, k) => sq(1 + k * k),
    interval: (p, k) => [1, upTo(sq(1 + k * k))],
    defaultK: () => 1.5,
  },
  O: {
    name: 'O mode',
    ions: false, timescale: 'electron', geometry: 'perp', kind: { type: 'proj', vec: POL_Y },
    seed: (p, k) => sq(1 + k * k),
    interval: (p, k) => [1, upTo(sq(1 + k * k))],
    defaultK: () => 1.5,
  },
  Xupper: {
    name: 'X mode (upper branch)',
    ions: false, timescale: 'electron', geometry: 'perp', kind: XBLOCK,
    seed: (p, k) => sq(p.wR * p.wR + k * k),
    interval: (p, k) => [p.wR, upTo(sq(p.wR * p.wR + k * k))],
    defaultK: () => 1.5,
  },
  Xlower: {
    name: 'X mode (lower branch)',
    ions: false, timescale: 'electron', geometry: 'perp', kind: XBLOCK,
    seed: (p) => sq(p.wL * p.wuh),
    // cold branch lives in (ωL, ωUH); warm electrons let it rise past ωUH
    interval: (p) => [p.wL, p.wR],
    defaultK: () => 1.5,
  },
  Rhigh: {
    name: 'R wave (high-frequency branch)',
    ions: false, timescale: 'electron', geometry: 'par', kind: { type: 'proj', vec: POL_R },
    seed: (p, k) => sq(p.wR * p.wR + k * k),
    interval: (p, k) => [p.wR, upTo(sq(p.wR * p.wR + k * k))],
    defaultK: () => 1.5,
  },
  whistler: {
    name: 'Whistler (R wave, low branch)',
    ions: false, timescale: 'electron', geometry: 'par', kind: { type: 'proj', vec: POL_R },
    seed: (p, k) => (p.wce * k * k) / (1 + k * k),
    interval: (p) => [0, p.wce],
    defaultK: () => 1,
  },
  L: {
    name: 'L wave',
    ions: false, timescale: 'electron', geometry: 'par', kind: { type: 'proj', vec: POL_L },
    seed: (p, k) => sq(p.wL * p.wL + k * k),
    interval: (p, k) => [p.wL, upTo(sq(p.wL * p.wL + k * k))],
    defaultK: () => 1.5,
  },
  alfvenR: {
    name: 'Shear Alfvén wave (R polarization)',
    ions: true, timescale: 'ion', geometry: 'par', kind: { type: 'proj', vec: POL_R },
    seed: alfvenSeed,
    interval: (p) => [0, p.wce],
    defaultK: alfvenK,
  },
  alfvenL: {
    name: 'Shear Alfvén wave (L polarization)',
    ions: true, timescale: 'ion', geometry: 'par', kind: { type: 'proj', vec: POL_L },
    seed: alfvenSeed,
    interval: (p) => [0, p.wci],
    defaultK: alfvenK,
  },
  magnetosonic: {
    name: 'Magnetosonic wave',
    ions: true, timescale: 'ion', geometry: 'perp', kind: XBLOCK,
    seed: (p, k, pl) => {
      const cs2 = (pl.Te + 3 * pl.Ti) / p.M;
      return k * sq((cs2 + p.vA * p.vA) / (1 + p.vA * p.vA)); // Chen's magnetosonic relation
    },
    interval: (p) => [0, Math.min(p.wL, p.wce)],
    defaultK: alfvenK,
  },
};
