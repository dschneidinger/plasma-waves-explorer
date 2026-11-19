// App wiring: toggles → mode → solved eigenmode(s) → active view, plus the clock
// and the dispersion inset.

import { normalizeState, visibleToggles, resolveMode } from './physics/modes.js';
import { solveMode } from './physics/eigenmode.js';
import { buildPacket, PACKET } from './physics/packet.js';
import { MODES } from './physics/modeSpecs.js';
import { validityWarnings } from './physics/validity.js';
import { createScene, WORLD } from './render/scene.js';
import { createSurface } from './render/surface.js';
import { createParticles } from './render/particles.js';
import { createVectors } from './render/vectors.js';
import { listFields, defaultFieldId } from './render/fields.js';
import { buildDisplay } from './render/waveModel.js';
import { renderToggles } from './ui/toggles.js';
import { renderModeCard, predictPlaceholder } from './ui/modeCard.js';
import { quizFor, answerKey, randomState, hashString } from './ui/predict.js';
import { renderFieldPanel } from './ui/fieldPanel.js';
import { renderViewPanel, VIEWS } from './ui/viewPanel.js';
import { createDispersionPlot } from './ui/dispersionPlot.js';
import { richText } from './ui/text.js';
import { readoutRows, clockText, fmt } from './ui/format.js';

const SECONDS_PER_PERIOD = 2; // at 1× speed
const SPEEDS = [0.25, 0.5, 1, 2];

const $ = (id) => document.getElementById(id);
const el = {
  toggles: $('toggles'),
  stage: $('stage'),
  modeLabel: $('modeLabel'),
  noMode: $('noMode'),
  modeCard: $('modeCard'),
  viewSection: $('viewSection'),
  viewPanel: $('viewPanel'),
  fieldSection: $('fieldSection'),
  fieldPanel: $('fieldPanel'),
  readoutSection: $('readoutSection'),
  readout: $('readout'),
  play: $('play'),
  reset: $('reset'),
  speed: $('speed'),
  shape: $('shape'),
  clock: $('clock'),
  predictToggle: $('predictToggle'),
  randomize: $('randomize'),
  hvToggle: $('hvToggle'),
};

// --- predict-first lock --------------------------------------------------------------
// Predict first is always on for students. Turning it off takes the instructor code
// (only its hash is stored here); once entered, this tab stays unlocked.
// This is a speed bump for students, not security: anyone can read the JS.
const UNLOCK_HASH = 2899920850;
const UNLOCK_KEY = 'pwe-predict-unlocked';
function isUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}
function checkCode(code) {
  if (hashString(code.trim().toUpperCase()) !== UNLOCK_HASH) return false;
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1');
  } catch {}
  return true;
}

// --- URL hash: toggles + view + packet + chosen k --------------------------------

function readHash() {
  const params = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  const { view, packet, k, predict, ...rest } = params;
  const kNum = Number(k);
  return {
    state: normalizeState(rest),
    view: VIEWS.some((v) => v.value === view) ? view : 'surface',
    packet: packet === '1',
    predict: !(predict === '0' && isUnlocked()), // predict=0 only works once unlocked
    kOverride: Number.isFinite(kNum) && kNum > 0 ? kNum : null,
  };
}
function writeHash() {
  const extra = { view: app.view };
  if (app.packet) extra.packet = '1';
  if (!app.predict) extra.predict = '0';
  if (app.kOverride) extra.k = app.kOverride.toPrecision(4);
  history.replaceState(null, '', `#${new URLSearchParams({ ...app.state, ...extra })}`);
}

const app = {
  ...readHash(),
  res: null, // resolveMode result
  sol: null, // solved mode at k0 (null when there is no wave)
  comps: [], // [{k, omega, sol, weight}] — one for a plane wave, several for a packet
  wavelengths: WORLD.wavelengths,
  curveKey: null, // what the dispersion curves were computed for
  fields: [],
  fieldId: null,
  showOrbits: true,
  showVec: { E: true, B: true },
  guesses: new Map(), // predict-first: toggle-state key → the student's guess
  playing: false,
  speed: 1,
  t: 0, // physical time in 1/ωpe
};

const scene3d = createScene(el.stage);
const surface = createSurface();
const particles = createParticles();
const vectors = createVectors();
scene3d.scene.add(surface.mesh, particles.group, vectors.group);

const plot = createDispersionPlot(el.stage, {
  onPickK: (k) => {
    app.kOverride = k;
    update();
  },
  onResetK: () => {
    app.kOverride = null;
    update();
  },
});

// --- theme -------------------------------------------------------------------

function applyTheme() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const scale = Number(v('--hv-scale')) || 1;
  scene3d.setTheme({ bg: v('--scene-bg'), floor: v('--scene-floor'), k: v('--arrow-k'), b0: v('--arrow-b0') });
  surface.setTheme({ neg: v('--wave-neg'), mid: v('--wave-mid'), pos: v('--wave-pos'), grid: v('--wave-grid'), scale });
  particles.setTheme({ electron: v('--electron'), ion: v('--ion'), scale });
  vectors.setTheme({ vecE: v('--vec-e'), vecB: v('--vec-b'), axis: v('--scene-floor'), scale });
  plot.redraw();
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// High visibility: a per-viewer preference kept in localStorage (index.html applies
// it before first paint); defaults to the OS "increase contrast" setting.
const HV_KEY = 'pwe-high-visibility';
el.hvToggle.checked = document.documentElement.dataset.contrast === 'high';
el.hvToggle.addEventListener('change', () => {
  const on = el.hvToggle.checked;
  if (on) document.documentElement.dataset.contrast = 'high';
  else delete document.documentElement.dataset.contrast;
  try {
    localStorage.setItem(HV_KEY, on ? '1' : '0');
  } catch {}
  applyTheme();
});

// --- state updates -------------------------------------------------------------

function setToggle(id, value) {
  app.state = normalizeState({ ...app.state, [id]: value });
  app.kOverride = null; // a different wave gets its own default k
  update();
}

window.addEventListener('hashchange', () => {
  Object.assign(app, readHash());
  update();
});

function solveCurrent() {
  const opts = app.res.solveOpts;
  let sol = solveMode(app.res.modeId, { ...opts, k: app.kOverride ?? undefined });
  if (!sol && app.kOverride) {
    // the branch doesn't exist at the chosen k (e.g. beyond a resonance): fall back
    app.kOverride = null;
    sol = solveMode(app.res.modeId, opts);
  }
  return sol;
}

function update() {
  app.res = resolveMode(app.state);
  app.sol = app.res.status === 'mode' ? solveCurrent() : null;
  if (app.sol) app.res = { ...app.res, warnings: [...app.res.warnings, ...validityWarnings(app.sol)] };
  writeHash();
  app.t = 0;
  renderToggles(el.toggles, visibleToggles(app.state), setToggle);
  renderCard();

  const hasWave = Boolean(app.sol);
  el.viewSection.hidden = !hasWave;
  el.readoutSection.hidden = !hasWave;
  plot.setVisible(hasWave);
  if (!hasWave) {
    el.fieldSection.hidden = true;
    showNoMode(app.res);
    return;
  }
  el.noMode.hidden = true;
  scene3d.setArrowsVisible(true);
  scene3d.setArrows(app.sol.plasma.geometry);

  app.fields = listFields(app.sol);
  if (!app.fields.some((f) => f.id === app.fieldId))
    app.fieldId = defaultFieldId(app.fields, MODES[app.sol.modeId].kind.type === 'es');

  app.comps = app.packet
    ? buildPacket(app.res.modeId, app.res.solveOpts, app.sol.k).components
    : [{ k: app.sol.k, omega: app.sol.omega, sol: app.sol, weight: 1 }];
  app.wavelengths = app.packet ? PACKET.wavelengths : WORLD.wavelengths;
  scene3d.setWavelengths(app.wavelengths);
  refreshDisplay();

  const key = `${app.res.modeId}|${JSON.stringify(app.res.solveOpts)}`;
  plot.setMode(app.sol, app.res.solveOpts, key !== app.curveKey);
  app.curveKey = key;
  plot.setPacketKs(app.packet ? app.comps.map((c) => c.k) : []);

  renderReadout();
  applyView();
}

// --- mode card, with the optional predict-first quiz ------------------------------

const stateKey = () => new URLSearchParams(app.state).toString();

function predictOpts() {
  if (!app.predict) return null;
  const key = stateKey();
  return {
    quiz: quizFor(app.res, key),
    guess: app.guesses.get(key) ?? null,
    onGuess: (g) => {
      app.guesses.set(key, g);
      renderCard();
      if (!app.sol) showNoMode(app.res);
    },
  };
}

function renderCard() {
  renderModeCard(el.modeCard, app.res, predictOpts());
}

el.predictToggle.checked = app.predict;
// "Random wave": a new setup (never the same wave twice in a row) with its name
// hidden, so the student reads the toggles and the motion and then guesses.
el.randomize.addEventListener('click', () => {
  app.state = randomState(Math.random, answerKey(app.res));
  app.kOverride = null;
  app.predict = true;
  el.predictToggle.checked = true;
  app.guesses.delete(stateKey());
  update();
});

const lockDialog = $('unlockDialog');
const lockInput = $('unlockCode');
const lockError = $('unlockError');
lockDialog.addEventListener('close', () => {
  if (lockDialog.returnValue === 'ok' && checkCode(lockInput.value)) setPredict(false);
  else el.predictToggle.checked = app.predict;
});
$('unlockForm').addEventListener('submit', (ev) => {
  // keep the dialog open on a wrong code
  if (ev.submitter?.value === 'ok' && hashString(lockInput.value.trim().toUpperCase()) !== UNLOCK_HASH) {
    ev.preventDefault();
    lockError.hidden = false;
    lockInput.select();
  }
});

function setPredict(on) {
  app.predict = on;
  el.predictToggle.checked = on;
  writeHash();
  renderCard();
  if (!app.sol) showNoMode(app.res);
}

el.predictToggle.addEventListener('change', () => {
  if (!el.predictToggle.checked && !isUnlocked()) {
    el.predictToggle.checked = true;
    lockInput.value = '';
    lockError.hidden = true;
    lockDialog.returnValue = '';
    lockDialog.showModal();
    return;
  }
  app.predict = el.predictToggle.checked;
  writeHash();
  renderCard();
  if (!app.sol) showNoMode(app.res);
});

/** Push scaled component data to every renderer (cheap; also used on field change). */
function refreshDisplay() {
  const d = buildDisplay(app.comps, app.sol.k, app.wavelengths, app.fieldId, vectors.spacingFor(app.wavelengths));
  surface.setComponents(d.surface, d.lambdaW);
  particles.setComponents(d.particles, app.wavelengths);
  vectors.setComponents(d.vectors, app.wavelengths);
}

function setView(view) {
  app.view = view;
  writeHash();
  applyView();
}

function applyView() {
  surface.mesh.visible = app.view === 'surface';
  particles.group.visible = app.view === 'particles';
  vectors.group.visible = app.view === 'vectors';
  el.fieldSection.hidden = app.view !== 'surface';

  renderViewPanel(el.viewPanel, {
    view: app.view,
    onView: setView,
    ionsMobile: Boolean(app.sol.species.i),
    packet: app.packet,
    showOrbits: app.showOrbits,
    onOrbits: (on) => {
      app.showOrbits = on;
      particles.setShowOrbits(on);
    },
    show: app.showVec,
    onShow: (name, on) => {
      app.showVec[name] = on;
      vectors.setShown(name, on);
    },
    hasB: vectors.hasField('B'),
  });
  for (const name of ['E', 'B']) vectors.setShown(name, app.showVec[name]);
  particles.setShowOrbits(app.showOrbits);

  if (app.view === 'surface') applyField();
  else renderModeLabel();
}

function showNoMode(res) {
  surface.mesh.visible = false;
  particles.group.visible = false;
  vectors.group.visible = false;
  scene3d.setArrowsVisible(false);
  el.modeLabel.replaceChildren();
  el.clock.textContent = '';

  const predict = predictOpts();
  if (predict && !predict.guess) {
    el.noMode.replaceChildren(predictPlaceholder());
    el.noMode.hidden = false;
    return;
  }

  const card = document.createElement('div');
  card.className = 'card';
  const h = document.createElement('h2');
  h.textContent = res.title;
  const p = document.createElement('p');
  p.textContent = res.explanation;
  const actions = document.createElement('div');
  actions.className = 'actions';
  for (const s of res.suggestions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s.label;
    b.addEventListener('click', () => {
      app.state = normalizeState({ ...app.state, ...s.patch });
      app.kOverride = null;
      update();
    });
    actions.append(b);
  }
  card.append(h, p, actions);
  el.noMode.replaceChildren(card);
  el.noMode.hidden = false;
}

// The scene overlay says what is drawn; the mode card names the wave.
function renderModeLabel(f) {
  const shape = app.packet ? `wave packet, ${app.wavelengths} λ box` : `${app.wavelengths} wavelengths shown`;
  let title;
  let subtitle;
  if (app.view === 'surface') {
    title = `${f.label}${f.status === 'zero' ? '  (≡ 0)' : ''}`;
    subtitle = `height = field value · ${shape}`;
  } else if (app.view === 'particles') {
    title = 'Fluid elements';
    subtitle = `each blob follows the local fluid displacement ξ (exaggerated) · ${shape}`;
  } else {
    title = 'E₁ and B₁ along the k axis';
    subtitle = shape;
  }
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = title;
  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = subtitle;
  el.modeLabel.replaceChildren(name, sub);
}

function renderReadout() {
  el.readout.replaceChildren(
    ...readoutRows(app.sol).flatMap(([term, value]) => {
      const dt = document.createElement('dt');
      dt.innerHTML = richText(term);
      const dd = document.createElement('dd');
      dd.innerHTML = richText(value);
      return [dt, dd];
    }),
  );
}

function applyField() {
  const f = app.fields.find((x) => x.id === app.fieldId);
  renderModeLabel(f);
  renderFieldPanel(el.fieldPanel, app.fields, app.fieldId, app.sol.plasma.geometry, (id) => {
    app.fieldId = id;
    refreshDisplay();
    applyField();
  });
}

// --- transport -----------------------------------------------------------------

function setPlaying(on) {
  app.playing = on;
  el.play.textContent = on ? '❚❚ Pause' : '▶ Play';
}
el.play.addEventListener('click', () => setPlaying(!app.playing));

// Space = play/pause, R = reset (unless typing or a button has focus, which handles Space itself)
window.addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (ev.code === 'Space') {
    ev.preventDefault();
    setPlaying(!app.playing);
  } else if (ev.key === 'r' || ev.key === 'R') {
    app.t = 0;
  }
});
el.reset.addEventListener('click', () => {
  app.t = 0;
});

function segmentedButtons(container, items, isActive, onPick) {
  container.classList.add('segmented');
  container.replaceChildren(
    ...items.map((it) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.label;
      b.setAttribute('aria-pressed', String(isActive(it.value)));
      b.addEventListener('click', () => onPick(it.value));
      return b;
    }),
  );
}

function renderSpeed() {
  segmentedButtons(
    el.speed,
    SPEEDS.map((s) => ({ value: s, label: `${s}×` })),
    (s) => s === app.speed,
    (s) => {
      app.speed = s;
      renderSpeed();
    },
  );
}

function renderShape() {
  segmentedButtons(
    el.shape,
    [
      { value: false, label: 'Plane wave' },
      { value: true, label: 'Wave packet' },
    ],
    (v) => v === app.packet,
    (v) => {
      app.packet = v;
      renderShape();
      update();
    },
  );
}

// --- animation loop ----------------------------------------------------------------

let last = performance.now();
const thetas = [];
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (app.sol) {
    const period = (2 * Math.PI) / app.sol.omega;
    if (app.playing) app.t += (dt * app.speed * period) / SECONDS_PER_PERIOD;
    thetas.length = app.comps.length;
    for (let j = 0; j < app.comps.length; j++) thetas[j] = (app.comps[j].omega * app.t) % (2 * Math.PI);
    if (app.view === 'surface') surface.setPhases(thetas);
    else if (app.view === 'particles') particles.update(thetas);
    else vectors.update(thetas);
    el.clock.textContent = clockText(app.sol, app.t);
  }
  scene3d.render();
  requestAnimationFrame(frame);
}

applyTheme();
renderSpeed();
renderShape();
update();
requestAnimationFrame(frame);

// handy for debugging from the console
window.__app = { app, fmt };
