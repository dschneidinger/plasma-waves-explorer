// "View" section of the right panel: Surface / Fluid elements / Vectors, plus the
// options and legend for the active view.

export const VIEWS = [
  { value: 'surface', label: 'Surface' },
  { value: 'particles', label: 'Fluid elements' },
  { value: 'vectors', label: 'Vectors' },
];

function segmented(label, options, value, onPick) {
  const seg = document.createElement('div');
  seg.className = 'segmented';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', label);
  for (const o of options) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = o.label;
    b.setAttribute('aria-pressed', String(o.value === value));
    b.addEventListener('click', () => onPick(o.value));
    seg.append(b);
  }
  return seg;
}

function checkbox(text, checked, onChange, disabled = false) {
  const lab = document.createElement('label');
  lab.className = 'check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked && !disabled;
  input.disabled = disabled;
  input.addEventListener('change', () => onChange(input.checked));
  lab.append(input, ` ${text}`);
  return lab;
}

function swatch(cls, text) {
  const s = document.createElement('span');
  s.className = `swatch ${cls}`;
  const wrap = document.createElement('span');
  wrap.className = 'legend-item';
  wrap.append(s, text);
  return wrap;
}

function para(text, cls = 'legend') {
  const p = document.createElement('p');
  p.className = cls;
  p.textContent = text;
  return p;
}

/**
 * opts: { view, onView, ionsMobile, showOrbits, onOrbits, show: {E, B}, onShow, hasB }
 */
export function renderViewPanel(container, opts) {
  const parts = [segmented('View', VIEWS, opts.view, opts.onView)];

  if (opts.view === 'particles') {
    const key = document.createElement('p');
    key.className = 'legend keys';
    key.append(swatch('electron', 'electrons'), swatch('ion', opts.ionsMobile ? 'ions' : 'ions (frozen)'));
    parts.push(
      key,
      checkbox(
        opts.packet ? 'Show orbits (plane wave only)' : 'Show each element’s orbit',
        opts.showOrbits,
        opts.onOrbits,
        opts.packet,
      ),
      para('Electrons in the front half, ions in the back half. Displacements are exaggerated (largest = λ/10) but both species share one scale.'),
    );
  } else if (opts.view === 'vectors') {
    const row = document.createElement('div');
    row.className = 'checks';
    row.append(
      checkbox('E₁', opts.show.E, (on) => opts.onShow('E', on)),
      checkbox(opts.hasB ? 'B₁' : 'B₁ (≡ 0 here)', opts.show.B, (on) => opts.onShow('B', on), !opts.hasB),
    );
    const key = document.createElement('p');
    key.className = 'legend keys';
    key.append(swatch('vec-e', 'E₁'), swatch('vec-b', 'B₁'));
    parts.push(
      row,
      key,
      para('Arrows sampled along the k axis; the thin curve joins their tips. E₁ and B₁ have different units, so each is scaled to fit.'),
    );
  }

  container.replaceChildren(...parts);
}
