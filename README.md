# Plasma Waves Explorer

**Live:** <https://dschneidinger.github.io/plasma-waves-explorer/>

An interactive 3D module for an introductory plasma course (Chen, ch. 4). Students pick a
few discrete settings (B₀ on/off, k ∥ or ⊥ B₀, electrostatic or electromagnetic,
polarization, frozen or mobile ions, cold or warm species) and watch the wave that results:

- **Surface**: any perturbed quantity (n₁, ρ₁, φ₁, p₁, E₁, B₁, v) as the height of a moving surface.
- **Fluid elements**: electron and ion blobs moving with the fluid, plus their orbits. This shows
  longitudinal vs transverse motion and linear, circular and elliptical polarization.
- **Vectors**: E₁ and B₁ arrows along k (the helix for R/L waves).
- **Dispersion inset**: ω(k) with cutoffs and resonances. Click it to choose k.
- **Wave packet**: the envelope travels at v_g while the crests travel at v_φ.
- **Predict first**: hides the wave's name until the student guesses it.
- **🎲 Random wave**: picks a random setup (each of the 13 waves and "no wave here" equally
  likely, never the same twice in a row) and hides the name. Students read the toggles and
  the motion, then guess.
- **High visibility**: larger text, black/white contrast, colour-blind-safe (Okabe–Ito)
  colours, thicker arrows, lines and blobs. Each browser remembers the choice, and it
  turns on by itself when the OS "increase contrast" setting is on.

## Running it

It is a static site with no build step. ES modules need an HTTP server, so opening `index.html`
directly from disk won't work:

```bash
python3 scripts/serve.py
```

then open <http://127.0.0.1:8123>. Any static host works too; the live copy above is GitHub Pages (serving the
repository root). three.js and KaTeX load from public CDNs, so the page needs internet access.

## Linking to a specific wave

Everything is in the URL hash, so you can put links in problem sets or slides:

| Parameter | Values |
|---|---|
| `B0` | `off`, `on` |
| `kDir` | `par`, `perp` |
| `character` | `es`, `em` |
| `polarization` | `Epar`, `Eperp` (k ⊥ B₀) · `R`, `L` (k ∥ B₀) |
| `ions` | `frozen`, `mobile` |
| `electrons`, `ionTemp` | `cold`, `warm` |
| `branch` | `high`, `low` (X mode, R wave) |
| `view` | `surface`, `particles`, `vectors` |
| `packet` | `1` for a wave packet |
| `k` | wavenumber in ωₚₑ/c (omit for the default) |
| `predict` | `1` to start in predict-first mode |

Examples:

- Cold plasma oscillation as a packet (it doesn't move): `#character=es&electrons=cold&packet=1`
- Whistler, fluid elements: `#B0=on&kDir=par&character=em&polarization=R&branch=low&view=particles`
- Shear Alfvén, predict first: `#B0=on&kDir=par&character=em&polarization=L&ions=mobile&predict=1`

Missing parameters take sensible defaults, and invalid combinations are corrected.

Keyboard: **Space** plays/pauses, **R** resets the clock.

## What the model is (and isn't)

- **Linear, two-fluid + Maxwell.** For each k the code solves the full dispersion relation
  D(ω, k)·E = 0 numerically and reconstructs every field from the eigenvector, so all
  quantities are mutually consistent. Nothing is time-stepped, so there is no numerical
  dispersion. Electrostatic modes use the electrostatic approximation (B₁ = 0), as in Chen.
- **Units:** ωₚₑ = c = e = mₑ = n₀ = ε₀ = 1. Defaults: Ωₑ/ωₚₑ = 0.5, v_te = 0.05c,
  M/m = 1836, warm ions Tᵢ = 0.1Tₑ (all in `src/physics/params.js`).
- **Closure:** adiabatic pressure along k, with γₑ = 3 on electron timescales and γₑ = 1
  (isothermal) on ion timescales, and γᵢ = 3. The right choice is really a kinetic question,
  and the app says so.
- **Not included (kinetic physics):** Landau damping, Bernstein waves, electrostatic ion
  cyclotron waves (these need oblique k). Where students can wander into regimes where this
  matters (kλ_D ≳ 0.5, Tᵢ ≈ Tₑ, ω not ≪ Ωᵢ for Alfvén), the mode card shows a warning.
- **Display scaling:** heights are comparable only within a group of like quantities
  (densities, E components, ...). Exactly-zero quantities are flat and marked "≡ 0". Fluid
  displacements are exaggerated (largest = λ/10) but share one scale across species.

## The 14 branches

Plasma oscillation · Langmuir (Bohm–Gross) · ion acoustic · upper hybrid · lower hybrid ·
light wave · O mode · X mode (upper/lower) · R wave (high branch / whistler) · L wave ·
shear Alfvén (R/L) · magnetosonic. Three settings have no propagating wave and show an
explanation instead (e.g. mobile ions with cold electrons: no ion acoustic wave).

## Development

```bash
npm test        # Node ≥ 18; no dependencies to install
```

The tests check the solver against Chen's formulas in every limit, check polarization and
zero/nonzero structure, cover all 512 raw toggle combinations, and check that packets move
at v_g. `plan.md` records the design decisions.

| Path | What |
|---|---|
| `src/physics/` | solver (species response, dispersion tensor, root finding), branch specs, toggle → mode logic, packets, validity warnings |
| `src/render/` | three.js scene, surface shader, fluid elements, vectors; pure scaling helpers |
| `src/ui/` | toggles, mode card, panels, dispersion inset, predict-first quiz |
| `test/` | `node:test` suites |
