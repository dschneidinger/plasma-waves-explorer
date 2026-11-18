// Number and unit formatting for the readout and clock.

import { superscript } from '../render/fields.js';
import { MODES } from '../physics/modeSpecs.js';

export function fmt(x, digits = 3) {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e-2 && a < 1e4) return String(Number(x.toPrecision(digits)));
  const exp = Math.floor(Math.log10(a));
  const mant = Number((x / 10 ** exp).toPrecision(digits));
  return `${mant}×10${superscript(exp)}`;
}

/** Natural frequency unit for a mode: ωpe for electron waves, Ωi or ωpi for ion waves. */
export function frequencyUnit(sol) {
  const p = sol.params;
  if (MODES[sol.modeId].timescale !== 'ion') return { sym: 'ωₚₑ', value: 1 };
  return sol.plasma.geometry === 'none' ? { sym: 'ωₚᵢ', value: p.wpi } : { sym: 'Ωᵢ', value: p.wci };
}

/** Natural speed unit besides c, if any. */
function speedUnit(sol) {
  const p = sol.params;
  if (MODES[sol.modeId].timescale !== 'ion') return null;
  if (sol.plasma.geometry === 'none' || sol.modeId === 'lowerHybrid')
    return sol.plasma.Te > 0 ? { sym: 'c_s', value: Math.sqrt(sol.plasma.Te / p.M) } : null;
  return { sym: 'v_A', value: p.vA };
}

const speed = (v, unit) => `${fmt(v)} c` + (unit ? ` = ${fmt(v / unit.value)} ${unit.sym}` : '');

/** [term, value] rows for the side panel. */
export function readoutRows(sol) {
  const w = frequencyUnit(sol);
  const su = speedUnit(sol);
  const rows = [
    ['ω', `${fmt(sol.omega / w.value)} ${w.sym}`],
    ['k', `${fmt(sol.k)} ωₚₑ/c`],
    ['λ', `${fmt((2 * Math.PI) / sol.k)} c/ωₚₑ`],
  ];
  if (MODES[sol.modeId].kind.type === 'es' && sol.plasma.Te > 0)
    rows.push(['kλ_D', fmt(sol.k * Math.sqrt(sol.plasma.Te))]);
  rows.push(['v_φ', speed(sol.vphase, su)], ['v_g', speed(sol.vgroup, su)]);
  return rows;
}

export function clockText(sol, tPhys) {
  const w = frequencyUnit(sol);
  const periods = (sol.omega * tPhys) / (2 * Math.PI);
  return `t = ${fmt(tPhys * w.value)} ${w.sym}⁻¹  ·  ${periods.toFixed(2)} periods`;
}
