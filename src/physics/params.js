// Normalized plasma parameters.
//
// Units: ω_pe = 1, c = 1, e = 1, m_e = 1, n0 = 1, ε0 = 1 (so μ0 = 1).
// Time is in 1/ω_pe, length in c/ω_pe, B in units where Ω_e = B0.

export function makeParams({
  wce = 0.5, // Ω_e / ω_pe
  vte = 0.05, // electron thermal speed sqrt(Te/m) / c, used when electrons are "warm"
  massRatio = 1836, // M / m
  TiOverTe = 0.1, // used when ions are "warm"
} = {}) {
  const M = massRatio;
  const B0 = wce;
  const Te = vte * vte;
  const Ti = TiOverTe * Te;
  const wci = wce / M;
  const wpi = 1 / Math.sqrt(M);
  const root = Math.sqrt(wce * wce + 4);

  return {
    M,
    B0,
    Te,
    Ti,
    wpe: 1,
    wce,
    wci,
    wpi,
    wuh: Math.sqrt(1 + wce * wce),
    wlh: 1 / Math.sqrt(1 / (wce * wci) + 1 / (wpi * wpi)), // Chen 4-71
    wR: (wce + root) / 2, // R cutoff (frozen ions)
    wL: (-wce + root) / 2, // L cutoff (frozen ions)
    vA: B0 / Math.sqrt(M + 1), // ρ = n0 (M + m)
    cs: Math.sqrt(Te / M),
    lambdaD: Math.sqrt(Te), // sqrt(ε0 Te / n0 e²)
    vte,
  };
}
