// Right panel: one row of chips per quantity (Density, φ, E₁ x/y/z, ...).
// Exactly-zero quantities stay clickable (a flat surface is an answer) but are
// marked, so students can see at a glance which fields this wave doesn't touch.

import { componentLabels, fieldBadge } from '../render/fields.js';

export function renderFieldPanel(container, fields, selectedId, geometry, onSelect) {
  const rows = new Map();
  for (const f of fields) {
    if (!rows.has(f.row)) rows.set(f.row, { label: f.rowLabel, fields: [] });
    rows.get(f.row).fields.push(f);
  }

  const grid = document.createElement('div');
  grid.className = 'field-grid';
  grid.setAttribute('role', 'radiogroup');
  grid.setAttribute('aria-label', 'Quantity shown as height');

  for (const { label, fields: fs } of rows.values()) {
    const name = document.createElement('span');
    name.className = 'field-row-label';
    name.textContent = label;

    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const f of fs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `chip ${f.status}`;
      b.textContent = f.short;
      b.title = f.status === 'zero' ? `${f.label} — zero for this wave` : f.label;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(f.id === selectedId));
      b.addEventListener('click', () => onSelect(f.id));
      chips.append(b);
    }
    grid.append(name, chips);
  }

  const comp = componentLabels(geometry);
  const legend = document.createElement('p');
  legend.className = 'legend';
  legend.textContent = `${comp.x} · ${comp.y} · ${comp.z}`;

  const selected = fields.find((f) => f.id === selectedId);
  const current = document.createElement('p');
  current.className = 'field-current';
  current.textContent = selected.label;

  const badge = document.createElement('p');
  badge.className = 'field-badge';
  badge.textContent = fieldBadge(selected);

  container.replaceChildren(grid, legend, current, badge);
}
