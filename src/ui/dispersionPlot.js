// Dispersion inset: ω(k) on log–log axes for the current branch (bold) and its
// sibling branches in the same model (faint), with cutoff/resonance lines, the
// light/Alfvén/sound line, a marker at k0 with its group-velocity tangent, and the
// packet's k components. Clicking the plot picks a new k.

import { dispersionCurve } from '../physics/eigenmode.js';
import { MODES } from '../physics/modeSpecs.js';
import { fmt } from './format.js';
import { superscript } from '../render/fields.js';

// Branches drawn together: same species model (frozen vs mobile ions) and geometry.
const SIBLINGS = {
  Xupper: ['Xlower'],
  Xlower: ['Xupper'],
  Rhigh: ['whistler'],
  whistler: ['Rhigh'],
  alfvenR: ['alfvenL'],
  alfvenL: ['alfvenR'],
};

const N_POINTS = 120;
const K_SPAN = 20; // plot k0/K_SPAN … k0·K_SPAN

function referenceLines(sol) {
  const p = sol.params;
  const g = sol.plasma.geometry;
  const ions = Boolean(sol.species.i);
  const lines = [['ωₚₑ', p.wpe]];
  if (g !== 'none') lines.push(['Ωₑ', p.wce], ['ω_R', p.wR], ['ω_L', p.wL]);
  if (g === 'perp') lines.push(['ω_UH', p.wuh]);
  if (ions) {
    lines.push(['ωₚᵢ', p.wpi]);
    if (g !== 'none') lines.push(['Ωᵢ', p.wci]);
    if (g === 'perp') lines.push(['ω_LH', p.wlh]);
  }
  return lines;
}

/** Speed of the straight "reference" line ω = v k, if one helps. */
function speedLine(sol) {
  const spec = MODES[sol.modeId];
  if (spec.kind.type !== 'es' && spec.timescale === 'electron') return ['ω = ck', 1];
  if (sol.modeId.startsWith('alfven') || sol.modeId === 'magnetosonic') return ['ω = kv_A', sol.params.vA];
  if (sol.modeId === 'ionAcoustic') return ['ω = kc_s', Math.sqrt(sol.plasma.Te / sol.params.M)];
  return null;
}

export function createDispersionPlot(container, { onPickK, onResetK }) {
  const wrap = document.createElement('div');
  wrap.className = 'dispersion';
  const head = document.createElement('div');
  head.className = 'dispersion-head';
  const title = document.createElement('span');
  title.textContent = 'Dispersion ω(k)';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'default k';
  reset.addEventListener('click', onResetK);
  const hide = document.createElement('button');
  hide.type = 'button';
  hide.setAttribute('aria-expanded', 'true');
  hide.textContent = '–';
  hide.title = 'Hide the plot';
  head.append(title, reset, hide);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  const hint = document.createElement('div');
  hint.className = 'dispersion-hint';
  hint.textContent = 'click to choose k';
  wrap.append(head, canvas, hint);
  container.append(wrap);

  function setCollapsed(collapsed) {
    wrap.classList.toggle('collapsed', collapsed);
    hide.textContent = collapsed ? '+' : '–';
    hide.setAttribute('aria-expanded', String(!collapsed));
    hide.title = collapsed ? 'Show the plot' : 'Hide the plot';
    if (!collapsed) draw();
  }
  hide.addEventListener('click', () => setCollapsed(!wrap.classList.contains('collapsed')));

  let data = null; // computed curves for the current mode
  let packetKs = [];
  let W = 300;
  const H = 190;

  // on a phone the plot would cover the wave, so start collapsed
  setCollapsed(container.clientWidth < 600);
  const M = { l: 42, r: 40, t: 8, b: 26 };

  function compute(sol, opts) {
    const k0 = sol.k;
    const ks = Array.from({ length: N_POINTS }, (_, n) => k0 * K_SPAN ** ((2 * n) / (N_POINTS - 1) - 1));
    const ids = [sol.modeId, ...(SIBLINGS[sol.modeId] ?? [])];
    const curves = ids.map((id) => ({ id, main: id === sol.modeId, ws: dispersionCurve(id, ks, opts) }));
    const finite = curves.flatMap((c) => c.ws.filter((w) => Number.isFinite(w) && w > 0));
    let lo = Math.min(...finite);
    let hi = Math.max(...finite);
    lo /= 2;
    hi *= 2;
    data = { sol, ks, curves, lo, hi, refs: referenceLines(sol), line: speedLine(sol) };
    canvas.setAttribute('aria-label', `Dispersion plot for ${sol.name ?? sol.modeId}`);
  }

  const X = (k) => M.l + ((Math.log(k / data.ks[0]) / Math.log(data.ks.at(-1) / data.ks[0])) * (W - M.l - M.r));
  const Y = (w) => H - M.b - ((Math.log(w / data.lo) / Math.log(data.hi / data.lo)) * (H - M.t - M.b));
  const kAt = (px) => data.ks[0] * (data.ks.at(-1) / data.ks[0]) ** ((px - M.l) / (W - M.l - M.r));

  function draw() {
    if (!data || wrap.classList.contains('collapsed')) return;
    W = Math.max(200, Math.min(300, container.clientWidth - 44));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const c = (n) => css.getPropertyValue(n).trim();
    ctx.clearRect(0, 0, W, H);
    ctx.font = '10px system-ui, sans-serif';

    // decade grid + tick labels
    ctx.strokeStyle = c('--border');
    ctx.fillStyle = c('--muted');
    ctx.lineWidth = 1;
    for (let e = Math.ceil(Math.log10(data.lo)); e <= Math.floor(Math.log10(data.hi)); e++) {
      const y = Y(10 ** e);
      ctx.beginPath();
      ctx.moveTo(M.l, y);
      ctx.lineTo(W - M.r, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`10${superscript(e)}`, M.l - 4, y);
    }
    for (let e = Math.ceil(Math.log10(data.ks[0])); e <= Math.floor(Math.log10(data.ks.at(-1))); e++) {
      const x = X(10 ** e);
      ctx.beginPath();
      ctx.moveTo(x, M.t);
      ctx.lineTo(x, H - M.b);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`10${superscript(e)}`, x, H - M.b + 3);
    }
    ctx.textAlign = 'left';
    ctx.fillText('k (ωₚₑ/c)', W - M.r - 44, H - 11);
    ctx.save();
    ctx.translate(9, M.t + 50);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('ω (ωₚₑ)', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(M.l, M.t, W - M.l - M.r, H - M.t - M.b);
    ctx.clip();

    // characteristic frequencies
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = c('--muted');
    const labels = [];
    for (const [name, w] of data.refs) {
      if (w <= data.lo || w >= data.hi) continue;
      const y = Y(w);
      ctx.beginPath();
      ctx.moveTo(M.l, y);
      ctx.lineTo(W - M.r, y);
      ctx.stroke();
      labels.push([name, y]);
    }
    // speed line ω = v k
    if (data.line) {
      const v = data.line[1];
      ctx.strokeStyle = c('--arrow-k');
      ctx.beginPath();
      ctx.moveTo(X(data.ks[0]), Y(v * data.ks[0]));
      ctx.lineTo(X(data.ks.at(-1)), Y(v * data.ks.at(-1)));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // branches
    for (const curve of data.curves.slice().sort((a, b) => a.main - b.main)) {
      ctx.strokeStyle = curve.main ? c('--accent') : c('--muted');
      ctx.lineWidth = curve.main ? 2.2 : 1.2;
      ctx.beginPath();
      let pen = false;
      curve.ws.forEach((w, n) => {
        if (!(w > 0)) {
          pen = false;
          return;
        }
        const x = X(data.ks[n]);
        const y = Y(w);
        if (pen) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        pen = true;
      });
      ctx.stroke();
    }

    // group-velocity tangent and marker at k0
    const { k, omega, vgroup } = data.sol;
    if (Number.isFinite(vgroup)) {
      ctx.strokeStyle = c('--text');
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const f of [0.6, 1.6]) {
        const kk = k * f;
        const ww = omega + vgroup * (kk - k);
        if (ww > 0) ctx.lineTo(X(kk), Y(ww));
      }
      ctx.stroke();
    }
    ctx.fillStyle = c('--accent');
    for (const pk of packetKs) {
      const idx = data.ks.findIndex((x) => x >= pk);
      const w = data.curves[0].ws[Math.max(idx, 0)];
      if (w > 0) {
        ctx.beginPath();
        ctx.arc(X(pk), Y(w), 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
    ctx.beginPath();
    ctx.arc(X(k), Y(omega), 4.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = c('--surface');
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // labels for reference lines, right margin
    ctx.fillStyle = c('--muted');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let lastY = -100;
    for (const [name, y] of labels.sort((a, b) => a[1] - b[1])) {
      const yy = Math.max(y, lastY + 10);
      ctx.fillText(name.replace(/_(\w+)/, (_, s) => s), W - M.r + 3, yy);
      lastY = yy;
    }
    hint.textContent = `click to choose k · now k = ${fmt(k)} ωₚₑ/c, ω = ${fmt(omega)} ωₚₑ`;
  }

  canvas.addEventListener('click', (ev) => {
    if (!data) return;
    const r = canvas.getBoundingClientRect();
    const px = ev.clientX - r.left;
    if (px < M.l || px > W - M.r) return;
    onPickK(kAt(px));
  });

  return {
    /** sol: solved mode at k0; opts: solve options (electrons, ionTemp, geometry). */
    setMode(sol, opts, recompute) {
      const outside = data && (sol.k < data.ks[0] || sol.k > data.ks.at(-1));
      if (recompute || !data || outside) compute(sol, opts);
      else data.sol = sol;
      draw();
    },
    setPacketKs(ks) {
      packetKs = ks;
      draw();
    },
    setVisible(on) {
      wrap.hidden = !on;
    },
    redraw: draw,
  };
}
