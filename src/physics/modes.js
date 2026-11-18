// Toggle state → which wave the student is looking at.
//
// Pure logic, no DOM: the UI calls `normalizeState`, renders `visibleToggles`,
// and passes the state to `resolveMode`. A resolution is either
//   { status: 'mode', modeId, solveOpts, name, equation, facts, notes, warnings, inert }
// or
//   { status: 'none', title, explanation, suggestions }
// `inert` maps toggle ids to the reason that toggle has no effect on this wave.

import { MODES } from './modeSpecs.js';

const opt = (value, label) => ({ value, label });

function branchOptions(s) {
  if (s.B0 !== 'on' || s.character !== 'em' || s.ions !== 'frozen') return null;
  if (s.kDir === 'perp' && s.polarization === 'Eperp')
    return [opt('high', 'Upper (ω > ω_R)'), opt('low', 'Lower (ω_L < ω < ω_UH)')];
  if (s.kDir === 'par' && s.polarization === 'R')
    return [opt('high', 'High (ω > ω_R)'), opt('low', 'Whistler (ω < Ω_e)')];
  return null;
}

export const TOGGLES = [
  {
    id: 'B0',
    label: 'Background field B₀',
    options: () => [opt('off', 'Off'), opt('on', 'On')],
    visible: () => true,
    help: 'A uniform background magnetic field. It only matters for particle motion ⊥ B₀.',
  },
  {
    id: 'kDir',
    label: 'Propagation',
    options: () => [opt('par', 'k ∥ B₀'), opt('perp', 'k ⊥ B₀')],
    visible: (s) => s.B0 === 'on',
    help: 'Direction the wave travels (k) relative to B₀. Only exactly ∥ or ⊥ are offered.',
  },
  {
    id: 'character',
    label: 'Wave type',
    options: () => [opt('es', 'Electrostatic'), opt('em', 'Electromagnetic')],
    visible: () => true,
    help: 'Electrostatic: E₁ ∥ k and B₁ = 0. Electromagnetic: B₁ ≠ 0 (E₁ mostly ⊥ k).',
  },
  {
    id: 'polarization',
    label: 'Polarization',
    options: (s) =>
      s.kDir === 'perp'
        ? [opt('Epar', 'E₁ ∥ B₀'), opt('Eperp', 'E₁ ⊥ B₀')]
        : [opt('R', 'Right-hand'), opt('L', 'Left-hand')],
    visible: (s) => s.B0 === 'on' && s.character === 'em',
    help: (s) =>
      s.kDir === 'perp'
        ? 'E₁ ∥ B₀: electrons move along B₀ and never feel it. E₁ ⊥ B₀: electrons are pushed across B₀.'
        : 'Right-hand rotates the same way electrons gyrate about B₀; left-hand the way ions do.',
  },
  {
    id: 'ions',
    label: 'Ions',
    options: () => [opt('frozen', 'Frozen'), opt('mobile', 'Mobile')],
    visible: () => true,
    help: 'Frozen ions = electron timescale (ω far above the ion frequencies). Mobile ions = ion timescale.',
  },
  {
    id: 'electrons',
    label: 'Electrons',
    options: () => [opt('cold', 'Cold'), opt('warm', 'Warm')],
    visible: () => true,
    help:
      'Cold: no electron pressure. Warm: pressure pushes along k, with γ = 3 on electron timescales and ' +
      'γ = 1 (isothermal) on ion timescales. Which γ is right is really a kinetic question.',
  },
  {
    id: 'ionTemp',
    label: 'Ion temperature',
    options: () => [opt('cold', 'Cold'), opt('warm', 'Warm (Tᵢ = 0.1 Tₑ)')],
    visible: (s) => s.ions === 'mobile',
    help: 'Warm ions add ion pressure (γ = 3). Kept below Tₑ: with Tᵢ ≈ Tₑ real ion waves are Landau damped.',
  },
  {
    id: 'branch',
    label: 'Branch',
    options: (s) => branchOptions(s) ?? [opt('high', 'High'), opt('low', 'Low')],
    visible: (s) => branchOptions(s) != null,
    help: 'At this geometry the same polarization propagates in two separate frequency bands.',
  },
];

export const DEFAULT_STATE = {
  B0: 'off',
  kDir: 'par',
  character: 'es',
  polarization: 'R',
  ions: 'frozen',
  electrons: 'cold',
  ionTemp: 'cold',
  branch: 'high',
};

/** Fill missing values and replace any value that isn't a valid option for a visible toggle. */
export function normalizeState(partial = {}) {
  const s = { ...DEFAULT_STATE, ...partial };
  for (const t of TOGGLES) {
    const values = t.options(s).map((o) => o.value);
    if (!values.includes(s[t.id])) s[t.id] = values[0];
  }
  return s;
}

/** Toggles to draw, in order, with their current options/value and any "no effect" reason. */
export function visibleToggles(state) {
  const s = normalizeState(state);
  const res = resolveMode(s);
  const inert = res.status === 'mode' ? res.inert : {};
  return TOGGLES.filter((t) => t.visible(s)).map((t) => ({
    id: t.id,
    label: t.label,
    help: typeof t.help === 'function' ? t.help(s) : t.help,
    options: t.options(s),
    value: s[t.id],
    inertReason: inert[t.id] ?? null,
  }));
}

// --- "no propagating wave" cards ------------------------------------------------

const NONE = {
  noIonAcoustic: {
    title: 'No ion acoustic wave with cold electrons',
    explanation:
      'An ion acoustic wave is pushed along by electron pressure and carried by ion inertia: ' +
      'c_s² = KTₑ/M. With Tₑ = 0 there is nothing to push it, so c_s = 0. ' +
      '(Warm ions alone do not rescue it: a real plasma Landau-damps that wave.)',
    suggestions: [
      { label: 'Warm the electrons', patch: { electrons: 'warm' } },
      { label: 'Freeze the ions (Langmuir / plasma oscillation)', patch: { ions: 'frozen' } },
    ],
  },
  noLowFreqEM: {
    title: 'No low-frequency electromagnetic wave without B₀',
    explanation:
      'Mobile ions means ion timescales, ω ≪ ωₚₑ. Below ωₚₑ the electrons short out any transverse ' +
      'field, so light is cut off. Without B₀ there is no Alfvén or magnetosonic wave to replace it.',
    suggestions: [
      { label: 'Freeze the ions (light wave above ωₚₑ)', patch: { ions: 'frozen' } },
      { label: 'Turn on B₀ with k ∥ B₀ (shear Alfvén)', patch: { B0: 'on', kDir: 'par' } },
    ],
  },
  noLowFreqO: {
    title: 'The O mode is cut off at ion timescales',
    explanation:
      'With E₁ ∥ B₀ the electrons move along B₀ and never feel it, so the O mode behaves exactly like ' +
      'light in an unmagnetized plasma: cut off below ωₚₑ. The ions add no low-frequency branch.',
    suggestions: [
      { label: 'Freeze the ions (O mode)', patch: { ions: 'frozen' } },
      { label: 'Switch to E₁ ⊥ B₀ (magnetosonic)', patch: { polarization: 'Eperp' } },
    ],
  },
};

// --- text for each wave -----------------------------------------------------------

const TRANSVERSE_INERT =
  'No effect on this wave: fluid pressure only pushes along k, and this wave moves particles ⊥ k.';

function describe(modeId, s) {
  const warmE = s.electrons === 'warm';
  switch (modeId) {
    case 'langmuir':
      return warmE
        ? {
            name: 'Langmuir wave (Bohm–Gross)',
            equation: String.raw`\omega^2 = \omega_{pe}^2 + 3k^2\frac{KT_e}{m}`,
            facts: [
              'Electrons slosh back and forth along k; the ions stay put.',
              'Electron pressure lets the oscillation propagate: v_g = 3k KTₑ/(mω) < v_φ.',
              'Purely electrostatic: B₁ = 0.',
            ],
          }
        : {
            name: 'Plasma oscillation',
            equation: String.raw`\omega = \omega_{pe}`,
            facts: [
              'Electrons slosh back and forth along k; the ions stay put.',
              'v_g = 0: the crests move but no energy travels. Warm the electrons to make it propagate.',
              'Purely electrostatic: B₁ = 0.',
            ],
          };
    case 'ionAcoustic':
      return {
        name: 'Ion acoustic wave',
        equation: String.raw`\frac{\omega}{k} = \left(\frac{KT_e}{M}\frac{1}{1+k^2\lambda_D^2} + \frac{3KT_i}{M}\right)^{1/2}`,
        facts: [
          'Electrons and ions move together; the wave is nearly neutral (nᵢ ≈ nₑ).',
          'Pushed by electron pressure, carried by ion inertia: a sound wave.',
          'Nearly dispersionless when kλ_D ≪ 1.',
        ],
      };
    case 'upperHybrid':
      return {
        name: warmE ? 'Upper hybrid wave' : 'Upper hybrid oscillation',
        equation: warmE
          ? String.raw`\omega^2 = \omega_{pe}^2 + \Omega_e^2 + 3k^2\frac{KT_e}{m}`
          : String.raw`\omega^2 = \omega_{UH}^2 = \omega_{pe}^2 + \Omega_e^2`,
        facts: [
          'Two restoring forces on the electrons: the space-charge field and the Lorentz force from B₀.',
          'Electrons trace ellipses in the plane ⊥ B₀.',
          'It is the electrostatic resonance of the X mode.',
        ],
      };
    case 'lowerHybrid':
      return {
        name: warmE ? 'Lower hybrid wave' : 'Lower hybrid oscillation',
        equation: String.raw`\omega_{LH}^2 \approx \left[\frac{1}{\Omega_e\Omega_i} + \frac{1}{\omega_{pi}^2}\right]^{-1}`,
        facts: [
          'Both species move ⊥ B₀; needs k almost exactly ⊥ B₀.',
          'Electrons are strongly magnetized (ω ≪ Ωₑ); ions are nearly unmagnetized (ω ≫ Ωᵢ).',
          'It is the resonance of the magnetosonic / X branch.',
        ],
      };
    case 'light':
      return {
        name: 'Light wave in a plasma',
        equation: String.raw`\omega^2 = \omega_{pe}^2 + c^2k^2`,
        facts: [
          'Transverse: E₁ and B₁ ⊥ k, and n₁ = 0.',
          'Cut off below ωₚₑ. v_φ > c but v_g < c, with v_φ v_g = c².',
        ],
      };
    case 'O':
      return {
        name: 'O mode (ordinary wave)',
        equation: String.raw`\omega^2 = \omega_{pe}^2 + c^2k^2`,
        facts: [
          'E₁ ∥ B₀: electrons move along B₀ and never feel it, so this is identical to the unmagnetized light wave.',
          'Transverse: n₁ = 0.',
          'Cutoff at ωₚₑ.',
        ],
      };
    case 'Xupper':
    case 'Xlower':
      return {
        name: modeId === 'Xupper' ? 'X mode (upper branch)' : 'X mode (lower branch)',
        equation: String.raw`\frac{c^2k^2}{\omega^2} = 1 - \frac{\omega_{pe}^2}{\omega^2}\,\frac{\omega^2-\omega_{pe}^2}{\omega^2-\omega_{UH}^2}`,
        facts: [
          'E₁ has a component along k, so the wave is partly longitudinal and n₁ ≠ 0.',
          'Electrons trace ellipses in the plane ⊥ B₀.',
          modeId === 'Xupper'
            ? 'Cutoff at ω_R; approaches the light line ω = ck at large k.'
            : 'Lives between ω_L and ω_UH; at large k it becomes the upper hybrid oscillation.',
        ],
      };
    case 'Rhigh':
      return {
        name: 'R wave (high-frequency branch)',
        equation: String.raw`\frac{c^2k^2}{\omega^2} = 1 - \frac{\omega_{pe}^2/\omega^2}{1-\Omega_e/\omega}`,
        facts: [
          'E₁ rotates the same way the electrons gyrate.',
          'Transverse: n₁ = 0. Cutoff at ω_R.',
        ],
      };
    case 'whistler':
      return {
        name: 'Whistler (R wave, low branch)',
        equation: String.raw`\frac{c^2k^2}{\omega^2} = 1 - \frac{\omega_{pe}^2/\omega^2}{1-\Omega_e/\omega}`,
        facts: [
          'E₁ rotates with the electrons; resonance as ω → Ωₑ.',
          'Higher frequencies travel faster, which gives lightning whistlers their falling tone.',
          'Transverse: n₁ = 0.',
        ],
      };
    case 'L':
      return {
        name: 'L wave',
        equation: String.raw`\frac{c^2k^2}{\omega^2} = 1 - \frac{\omega_{pe}^2/\omega^2}{1+\Omega_e/\omega}`,
        facts: [
          'E₁ rotates opposite to the electrons (the way ions gyrate).',
          'Transverse: n₁ = 0. Cutoff at ω_L.',
        ],
      };
    case 'alfvenR':
    case 'alfvenL':
      return {
        name: 'Shear Alfvén wave',
        equation: String.raw`\frac{\omega}{k} = \frac{v_A}{\sqrt{1 + v_A^2/c^2}}, \quad v_A = \frac{B_0}{\sqrt{\mu_0\rho}}`,
        facts: [
          'Field lines act like plucked strings: tension from B₀, mass from the ions.',
          'Electrons and ions drift together with E×B; n₁ = 0.',
          modeId === 'alfvenR'
            ? 'R and L merge as ω/Ωᵢ → 0; at higher ω the R branch becomes the whistler.'
            : 'R and L merge as ω/Ωᵢ → 0; near Ωᵢ the L branch becomes the ion cyclotron wave.',
        ],
      };
    case 'magnetosonic':
      return {
        name: 'Magnetosonic wave',
        equation: String.raw`\frac{\omega^2}{k^2} = c^2\,\frac{v_s^2 + v_A^2}{c^2 + v_A^2}`,
        facts: [
          'Compresses the plasma and the field lines together: n₁ ≠ 0 and B₁ ∥ B₀.',
          'Restoring force combines plasma pressure (v_s) and magnetic pressure (v_A).',
          'The low-frequency limit of the X mode.',
        ],
      };
    default:
      throw new Error(`no description for ${modeId}`);
  }
}

// --- resolution -------------------------------------------------------------------

function pickModeId(s) {
  const mobile = s.ions === 'mobile';
  const magnetized = s.B0 === 'on';
  const along = !magnetized || s.kDir === 'par'; // B0 off behaves like k ∥ B0 for ES waves

  if (s.character === 'es') {
    if (along) {
      if (!mobile) return 'langmuir';
      return s.electrons === 'warm' ? 'ionAcoustic' : { none: 'noIonAcoustic' };
    }
    return mobile ? 'lowerHybrid' : 'upperHybrid';
  }

  if (!magnetized) return mobile ? { none: 'noLowFreqEM' } : 'light';
  if (s.kDir === 'par') {
    if (mobile) return s.polarization === 'R' ? 'alfvenR' : 'alfvenL';
    if (s.polarization === 'L') return 'L';
    return s.branch === 'low' ? 'whistler' : 'Rhigh';
  }
  if (s.polarization === 'Epar') return mobile ? { none: 'noLowFreqO' } : 'O';
  if (mobile) return 'magnetosonic';
  return s.branch === 'low' ? 'Xlower' : 'Xupper';
}

export function resolveMode(state) {
  const s = normalizeState(state);
  const picked = pickModeId(s);
  if (typeof picked !== 'string') return { status: 'none', ...NONE[picked.none] };

  const modeId = picked;
  const spec = MODES[modeId];
  const solveOpts = {
    electrons: s.electrons,
    ionTemp: spec.ions ? s.ionTemp : 'cold',
    geometry: spec.geometry === 'either' ? (s.B0 === 'on' ? 'par' : 'none') : spec.geometry,
  };

  const inert = {};
  if (spec.kind.type === 'proj') {
    inert.electrons = TRANSVERSE_INERT;
    if (spec.ions) inert.ionTemp = TRANSVERSE_INERT;
  }

  const notes = [];
  const warnings = [];
  if (s.character === 'es' && s.B0 === 'on' && s.kDir === 'par')
    notes.push('k ∥ B₀: particles move along B₀, so B₀ has no effect. This is the same wave as with B₀ off.');
  if (modeId === 'ionAcoustic' && s.ionTemp === 'warm')
    warnings.push(
      'Here Tᵢ = 0.1 Tₑ. If Tᵢ approached Tₑ, a real plasma would Landau-damp this wave, which no fluid model can show.',
    );
  if (s.character === 'em' && s.B0 === 'on' && s.kDir === 'perp' && s.polarization === 'Eperp')
    notes.push('"Electromagnetic" here is approximate: E₁ also has a component along k.');

  return { status: 'mode', modeId, solveOpts, ...describe(modeId, s), notes, warnings, inert };
}
