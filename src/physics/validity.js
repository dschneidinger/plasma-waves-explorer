// Warnings that depend on the chosen k (students can pick any k on the dispersion
// plot, including places where the fluid picture stops being trustworthy).

export function validityWarnings(sol) {
  const out = [];
  const id = sol.modeId;
  const kLD = sol.plasma.Te > 0 ? sol.k * Math.sqrt(sol.plasma.Te) : 0;

  if ((id === 'langmuir' || id === 'upperHybrid') && kLD > 0.5)
    out.push(
      `kλ_D = ${kLD.toFixed(2)}: a real plasma would Landau-damp this wave within a few periods. ` +
        'The fluid model only describes it well for kλ_D ≪ 1.',
    );
  if (id === 'ionAcoustic' && kLD > 1)
    out.push(
      `kλ_D = ${kLD.toFixed(2)}: the electrons no longer shield the ions, so the wave turns into an ion plasma oscillation near ω_pi.`,
    );
  if ((id === 'alfvenR' || id === 'alfvenL') && sol.omega > 0.3 * sol.params.wci)
    out.push(
      `ω = ${(sol.omega / sol.params.wci).toFixed(2)} Ω_i is not ≪ Ω_i, so R and L split: ` +
        (id === 'alfvenL' ? 'L heads toward the ion cyclotron resonance.' : 'R heads toward the whistler.'),
    );
  return out;
}
