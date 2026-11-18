// Scalar quantities a student can display, with a shared normalization.
//
// Quantities are grouped by physical units (densities, E, B, velocities, ...).
// Within a group every quantity is divided by the group's largest amplitude, so
// heights are comparable inside a group and an exactly-zero quantity is flat.
// Comparing heights across groups means nothing (different units), so each
// group is scaled to fill the display.

import { abs, scale, ZERO } from '../physics/complex.js';

export const ZERO_TOL = 1e-12; // relative amplitude treated as exactly zero
export const SMALL_TOL = 1e-2; // relative amplitude flagged as "tiny"

const GROUP_LABELS = {
  density: 'Density',
  phi: 'Potential',
  pressure: 'Pressure',
  E: 'Electric field E₁',
  B: 'Magnetic field B₁',
  v: 'Fluid velocity',
};

export function componentLabels(geometry) {
  return {
    x: 'x (along k)',
    y: geometry === 'perp' ? 'y (along B₀)' : 'y (⊥ k, in plane)',
    z: 'z (⊥ k, out of plane)',
  };
}

/** Every displayable quantity for a solved mode (see eigenmode.solveMode). */
export function listFields(sol) {
  // `row` / `rowLabel` / `short` drive the chip panel: one row of chips per row key.
  const out = [];
  const add = (id, label, group, amp, row, rowLabel, short) =>
    out.push({ id, label, group, amp, row, rowLabel, short });
  const comp = componentLabels(sol.plasma.geometry);
  const xyz = ['x', 'y', 'z'];
  const { e, i } = sol.species;

  add('n_e', 'Electron density nₑ₁', 'density', e.n, 'density', 'Density', 'nₑ');
  if (i) add('n_i', 'Ion density nᵢ₁', 'density', i.n, 'density', 'Density', 'nᵢ');
  add('rho', 'Charge density ρ₁', 'density', sol.rho, 'density', 'Density', 'ρ');
  if (sol.phi) add('phi', 'Potential φ₁', 'phi', sol.phi, 'phi', 'Potential', 'φ');
  if (sol.plasma.Te > 0) add('p_e', 'Electron pressure pₑ₁', 'pressure', e.p, 'pressure', 'Pressure', 'pₑ');
  if (i && sol.plasma.Ti > 0) add('p_i', 'Ion pressure pᵢ₁', 'pressure', i.p, 'pressure', 'Pressure', 'pᵢ');
  xyz.forEach((c, j) => add(`E_${c}`, `E₁ ${comp[c]}`, 'E', sol.E[j], 'E', 'E₁', c));
  xyz.forEach((c, j) => add(`B_${c}`, `B₁ ${comp[c]}`, 'B', sol.B[j], 'B', 'B₁', c));
  xyz.forEach((c, j) => add(`ve_${c}`, `Electron velocity ${comp[c]}`, 'v', e.v[j], 've', 'vₑ', c));
  if (i) xyz.forEach((c, j) => add(`vi_${c}`, `Ion velocity ${comp[c]}`, 'v', i.v[j], 'vi', 'vᵢ', c));

  const groupMax = {};
  for (const f of out) groupMax[f.group] = Math.max(groupMax[f.group] ?? 0, abs(f.amp));

  return out.map((f) => {
    const max = groupMax[f.group];
    const rel = max > 0 ? abs(f.amp) / max : 0;
    const status = rel < ZERO_TOL ? 'zero' : rel < SMALL_TOL ? 'small' : 'ok';
    return {
      ...f,
      groupLabel: GROUP_LABELS[f.group],
      rel,
      status,
      norm: status === 'zero' ? ZERO : scale(f.amp, 1 / max), // |norm| ≤ 1
    };
  });
}

/** Default quantity: density for electrostatic waves, the largest E component otherwise. */
export function defaultFieldId(fields, isElectrostatic) {
  if (isElectrostatic) return 'n_e';
  const E = fields.filter((f) => f.group === 'E');
  return E.reduce((a, b) => (b.rel > a.rel ? b : a)).id;
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const superscript = (n) => String(n).split('').map((ch) => SUP[ch] ?? ch).join('');

/** One-line explanation shown under the selector. */
export function fieldBadge(f) {
  if (f.status === 'zero') return `≡ 0 for this wave: the surface is flat on purpose.`;
  if (f.status === 'small') {
    const exp = Math.floor(Math.log10(f.rel));
    return `Tiny: about 10${superscript(exp)} × the largest ${f.groupLabel.toLowerCase()} in this wave.`;
  }
  return '';
}
