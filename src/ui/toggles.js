// Top bar: one segmented control per visible toggle (from modes.visibleToggles).
// Help text is a hover tooltip and also an ⓘ button, since phones have no hover.

import { richText } from './text.js';

let openHelp = null; // id of the toggle whose help is expanded (survives re-render)

export function renderToggles(container, toggles, onChange) {
  container.replaceChildren(
    ...toggles.map((t) => {
      const group = document.createElement('div');
      group.className = `toggle${t.inertReason ? ' inert' : ''}`;
      const helpText = t.inertReason ?? t.help;
      if (helpText) group.title = helpText;

      const labelRow = document.createElement('span');
      labelRow.className = 'toggle-label';
      labelRow.textContent = t.label;
      if (helpText) {
        const info = document.createElement('button');
        info.type = 'button';
        info.className = 'info';
        info.textContent = 'ⓘ';
        info.setAttribute('aria-label', `About ${t.label}`);
        info.setAttribute('aria-expanded', String(openHelp === t.id));
        info.addEventListener('click', () => {
          openHelp = openHelp === t.id ? null : t.id;
          renderToggles(container, toggles, onChange);
        });
        labelRow.append(info);
      }

      const seg = document.createElement('div');
      seg.className = 'segmented';
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-label', t.label);
      for (const o of t.options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = richText(o.label);
        b.setAttribute('aria-pressed', String(o.value === t.value));
        b.addEventListener('click', () => onChange(t.id, o.value));
        seg.append(b);
      }

      group.append(labelRow, seg);
      if (t.inertReason) {
        const note = document.createElement('span');
        note.className = 'inert-note';
        note.textContent = 'no effect on this wave';
        group.append(note);
      }
      if (helpText && openHelp === t.id) {
        const help = document.createElement('p');
        help.className = 'toggle-help';
        help.innerHTML = richText(helpText);
        group.append(help);
      }
      return group;
    }),
  );
}
