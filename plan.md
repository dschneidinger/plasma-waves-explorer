# Plasma Waves Explorer — Plan

An interactive web module for PHYS 122 that lets students isolate each of the
classic linear plasma waves (Chen ch. 4 table) with a few discrete toggles,
then watch the wave as a 3D "ocean surface" of a chosen quantity.

---

## 1. Design decisions (from the workshop)

| Original idea | Decision | Why |
|---|---|---|
| Discrete toggles | **Keep.** Toggles are the physical axes of Chen's summary table, not frequency sliders. | Each toggle maps to one approximation, so every mode has a short "recipe". |
| "ω ~ ωpe / ω ≪ ωpe" toggle | **Make it a branch selector.** Show it only when a geometry has more than one branch (X: upper/lower, R: high/whistler). | ω is set by k through the dispersion relation, so it can't be an independent input. Picking a frequency range really means picking a branch. |
| "Stationary ions" toggle | **Keep it as "Ions: frozen / mobile."** It sets electron versus ion timescale, so a separate ω toggle isn't needed. | Having both an ion toggle and a frequency toggle lets students build contradictions such as frozen ions with ω ≪ Ωi. |
| "Hot ions" | **Replace with "Electrons: cold / warm" plus "Ions: cold / warm (Ti < Te)".** Warn when Ti ≳ Te. | Ion acoustic waves need hot *electrons*. Hot ions Landau-damp the wave, and a fluid model cannot show that, so it would show a wave that doesn't really exist. |
| "Run a 2-fluid simulation" | **Evaluate the linearized 2-fluid + Maxwell eigenmode exactly** instead of time-stepping. | Every target mode is a linear eigenmode. Exact evaluation has no numerical dispersion and no CFL problems at real mass ratio, runs at 60 fps, and keeps all fields mutually consistent. It is still "the 2-fluid model". |
| Height map of one field | **Keep it for scalars.** Add a **fluid-element (particle) view** and a **vector/arrow view**. | A height map makes every wave look transverse (the worst trap for Langmuir and ion acoustic). A scalar component also can't tell R from L. |
| Temperature as a field | **Drop it, or show pressure p₁ instead.** | With an adiabatic closure, T₁/T₀ = (γ−1)n₁/n₀, so it just repeats the density plot. |

---

## 2. Toggles → mode map

Toggles (top bar). A toggle is shown only when it matters for the current settings:

1. **B₀**: off / on
2. **k relative to B₀** (if B₀ on): k ∥ B₀ / k ⊥ B₀
3. **Character**: electrostatic (E₁ ∥ k) / electromagnetic (E₁ ⊥ k)
4. **Polarization** (EM with B₀ on): for k ⊥ B₀, E₁ ∥ B₀ / E₁ ⊥ B₀; for k ∥ B₀, right-hand / left-hand
5. **Ions**: frozen / mobile
6. **Electrons**: cold / warm
7. **Ions temperature** (if ions mobile): cold / warm (Ti < Te)
8. **Branch** (only where several exist): e.g. X upper / lower, R high / whistler

| Mode | B₀ | k vs B₀ | Char. | Pol. | Ions | Te | Dispersion (Chen) |
|---|---|---|---|---|---|---|---|
| Plasma oscillation | off or on | ∥ | ES | – | frozen | cold | ω = ωpe (v_g = 0: it doesn't propagate) |
| Langmuir (Bohm–Gross) | off or on | ∥ | ES | – | frozen | warm | ω² = ωpe² + 3k²Te/m |
| Ion acoustic | off or on | ∥ | ES | – | mobile | warm | ω = k c_s / √(1+k²λD²), c_s² = (Te+3Ti)/M |
| Upper hybrid | on | ⊥ | ES | – | frozen | either | ω² = ωpe² + Ωe² (+3k²Te/m) |
| Lower hybrid | on | ⊥ | ES | – | mobile | either | 1/ωLH² ≈ 1/(ΩeΩi) + 1/ωpi² |
| Light wave | off | – | EM | – | either | either | ω² = ωpe² + c²k² |
| O mode | on | ⊥ | EM | E₁ ∥ B₀ | frozen | either | same as light wave |
| X mode (upper / lower) | on | ⊥ | EM | E₁ ⊥ B₀ | frozen | either | n² = 1 − (ωpe²/ω²)(ω²−ωpe²)/(ω²−ωUH²) |
| R wave (high / whistler) | on | ∥ | EM | RH | frozen | either | n² = 1 − (ωpe²/ω)/(ω−Ωe) |
| L wave | on | ∥ | EM | LH | frozen | either | n² = 1 − (ωpe²/ω)/(ω+Ωe) |
| Shear Alfvén | on | ∥ | EM | RH or LH | mobile | either | ω = k v_A (R and L merge) |
| Magnetosonic | on | ⊥ | EM | E₁ ⊥ B₀ | mobile | either | ω²/k² = c²(c_s²+v_A²)/(c²+v_A²) |

**"No propagating mode" states.** These are teaching moments, not errors. Each gets a short explanation card:
- ES, mobile ions, cold electrons: no ion acoustic wave without electron pressure.
- EM, k ⊥ B₀, E₁ ∥ B₀, mobile ions: the O mode is cut off below ωpe and ions add no low-frequency branch.
- Warm ions with Ti ≳ Te: a warning banner says a real plasma Landau-damps this wave and the fluid model can't show it.
- Changing temperature on EM modes visibly does nothing. A tooltip explains why.

**Teaching notes shown on the mode card:**
- Upper hybrid is the electrostatic resonance of the X mode, and lower hybrid is the resonance of the X/magnetosonic branch. The dispersion inset shows both asymptotes.
- B₀ has no effect on Langmuir or ion acoustic waves when k ∥ B₀.
- X mode and magnetosonic are *not* purely transverse: they have E₁ ∥ k and n₁ ≠ 0.

**Out of scope for v1:** electrostatic ion cyclotron (needs oblique k), Bernstein waves (kinetic), and Landau damping (kinetic). Each gets a one-line mention.

---

## 3. Physics engine

Units: ωpe = 1, c = 1, e = m_e = 1. Defaults: Ωe/ωpe = 0.5, v_te/c = 0.05,
M/m = 1836 (switchable to 100), Ti/Te ∈ {0, 0.1}.

Geometry: k = k x̂. B₀ = B₀ x̂ for k ∥ B₀ and B₀ = B₀ ŷ for k ⊥ B₀, so B₀ always
lies in the rendered x–y plane.

**Per species s** (warm fluid, closure γ_s):

    (−iω m_s I − q_s [·×B₀] + i γ_s T_s k kᵀ / ω) v_s = q_s E   ⇒   v_s = R_s(ω,k) E

The 3×3 complex matrix R_s is inverted numerically, with no hand-derived closed forms.
Frozen ions simply leave the ion species out.

**EM dispersion:** D(ω,k) = (c²/ω²)(k k ᵀ − k² I) + ε(ω,k), with ε = I + (i/ω) Σ q_s n_s R_s.
D is Hermitian for real ω, so det D is real. Roots are found by **bracketing + Brent on real ω**,
seeded and bracketed by the Chen formula for the chosen mode, which also selects the branch.

**ES dispersion:** k·ε·k = 0. B₁ ≡ 0 by construction, to match Chen and the toggle's meaning.

**Closure caveat:** γe = 3 on electron timescales and γe = 1 (isothermal) on ion timescales,
chosen per mode. A "?" tooltip explains that the right closure is really a kinetic question.

**Eigenvector reconstruction** (all complex amplitudes per unit E₁):
E₁ = null vector of D, B₁ = k×E₁/ω, v_s = R_s E₁, n_s1 = n₀ k·v_s/ω,
φ = iE₁·k/k² (ES), p_s1 = γ_s T_s n_s1, displacement ξ_s = i v_s/ω.

**Rendering a quantity:** f(x,y,t) = Re[ f̂ e^{i(kx−ωt)} ]. In wave-packet mode it is a sum of
~32 k-components around k₀ under a Gaussian envelope, each with its own ω(k). This shows
v_g ≠ v_φ, and v_g = 0 for the cold plasma oscillation.

**Default k per mode:** kλD ≈ 0.3 for Langmuir and ion acoustic, kc/ωpe ≈ 1–2 for EM,
ω ≈ 0.1 Ωi for Alfvén and magnetosonic. The domain is ~4 wavelengths.

**Playback:** time is rescaled so one wave period ≈ 2 s. A clock shows t in physical units
(1/ωpe or 1/Ωi).

---

## 4. Views (right panel)

- **Surface (scalar)**: n_e1, n_i1, ρ₁ (charge), φ (ES only), p₁, or any single component
  of E₁, B₁, v_e, v_i. All fields share one amplitude normalization, so a flat surface
  means the quantity is zero for this mode. A "≡ 0 for this mode" badge links to why.
- **Fluid elements**: a 3D lattice of electron (blue) and ion (red) elements displaced
  by exaggerated ξ_s. Shows longitudinal vs transverse motion, circular polarization,
  and electrons and ions moving together (Alfvén) or apart (Langmuir).
- **Vectors**: E₁ / B₁ arrows along the k axis, giving the classic helix for R/L waves.
- B₀ and k arrows are always drawn in the scene.
- Optional split screen with two quantities side by side, to compare phase (e.g. n₁ vs φ).

**Inset (bottom left): dispersion diagram** ω(k) on log axes for the active toggles, with
the chosen branch highlighted, a marker at k₀, the cutoff/resonance lines (ωpe, ωUH, ωLH,
Ωe, Ωi, ωR, ωL), and the v_φ and v_g values.

**Mode card:** name, dispersion relation (KaTeX), and 2–3 key facts. A "predict first"
switch hides the name until the student commits to a guess.

---

## 5. Tech stack and layout

Static site, no build step, hostable on the course site or GitHub Pages.

- Three.js (pinned version, ES module from CDN). The surface is a PlaneGeometry whose height
  is computed in the vertex shader from uniforms. Particles use an InstancedMesh.
- KaTeX for equations. Plain canvas 2D for the dispersion inset.
- Plain ES modules, no framework.

```
index.html
styles.css
src/
  physics/complex.js     complex numbers + 3x3 linear algebra
  physics/params.js      normalized parameters, derived frequencies
  physics/species.js     R_s response matrix
  physics/dispersion.js  ε, D(ω,k), scalar dispersion function per mode kind
  physics/rootfind.js    log-grid scan + Brent, rejects poles
  physics/modeSpecs.js   per-branch geometry, polarization, interval, Chen seed, default k
  physics/eigenmode.js   solveMode / dispersionCurve: ω, v_g, all field amplitudes
  physics/modes.js       toggle state → mode spec / "no mode" explanation
  render/scene.js        three.js setup, camera, B0/k arrows
  render/surface.js      height-map shader
  render/particles.js    fluid-element view
  render/vectors.js      arrow/helix view
  ui/toggles.js  ui/fieldPanel.js  ui/modeCard.js  ui/dispersionPlot.js
  main.js
test/
  physics.test.js        node:test — compare roots to Chen limits, check n₁≡0 / B₁≡0 cases
```

---

## 6. Build phases

1. ✅ **Physics core + tests** (done: 20 tests, `npm test`). species/dispersion/eigenmode. All 12 modes reproduce Chen's
   formulas in their limits (within a few %). Transverse modes have n₁ = 0, ES modes have
   B₁ = 0, and R/L have the right rotation sense.
2. ✅ **Mode logic** (done: `src/physics/modes.js`, 8 tests over all 512 raw toggle states). Toggle state → mode spec, visible toggles, and "no mode" cards, plus a
   unit test over every toggle combination.
3. ✅ **Surface renderer** (done) for a plane wave, with play/pause, speed, the clock, a basic
   toggle bar, field selector + readout, "no wave" cards, and URL-hash links to any wave.
   Run locally: `python3 scripts/serve.py` → http://127.0.0.1:8123
4. ✅ **UI** (done): top toggles, right panel with mode card (KaTeX equation, facts, notes,
   warnings), quantity chips per row (zero quantities dashed), readout.
5. ✅ **Fluid-element and vector views** (done). Electrons front half / ions back half,
   shared displacement scale (largest = λ/10), faint orbit loops; E₁/B₁ arrows along the
   k axis with tip curves, along-k length capped near the arrow spacing. View is in the URL
   (`view=surface|particles|vectors`).
6. ✅ **Dispersion inset and wave-packet mode** (done). Log–log ω(k) with sibling branches,
   reference frequencies, light/v_A/c_s line, v_g tangent; click to choose k (saved as `k=`
   in the URL), with k-dependent validity warnings (Landau damping, ω not ≪ Ωᵢ). Packet =
   9 eigenmodes periodic in a 10λ box (`packet=1`), so the envelope moves at v_g.
7. ✅ **Polish** (done): predict-first quiz (`predict=1`, includes "no wave exists"),
   ⓘ help on every toggle (tap on phones), Space/R shortcuts, phone layout (compact
   toggles, dispersion inset collapsed), instructor README with linkable URL parameters.

---

## 7. Open questions

Decided by default while building (revisit if you disagree):

- Audience: Chen-level undergrads (PHYS 122).
- Temperature view: pressure p₁ is shown instead of T₁.
- Mass ratio: real 1836 (no reduced option in the UI; `params.js` can change it).
- Predict-first: included, off by default.

Still open:

1. Electrostatic ion cyclotron (needs a "k nearly ⊥ B₀" option): not in v1.
2. Deployment: course website / GitHub Pages, or a shareable claude.ai artifact?
3. Lower X-mode default k: at k = 1.5 c/ωₚₑ it is ~4:1 longitudinal (near ω_UH). A smaller
   k (e.g. 0.5) would show a more visibly elliptical, electromagnetic X mode.
4. Alfvén default ω = 0.1 Ωᵢ shows a ~10% R/L split; 0.02 Ωᵢ would make them look identical.
