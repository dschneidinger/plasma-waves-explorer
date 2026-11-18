// Turn the plain-text strings from modes.js into safe HTML with subscripts.
// "v_φ" → v<sub>φ</sub>, "ω_UH" → ω<sub>UH</sub>, "kλ_D" → kλ<sub>D</sub>.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ESC[c]);

export function richText(s) {
  return escapeHtml(s).replace(
    /([\p{L}])_([\p{L}\p{N}]{1,3})(?![\p{L}\p{N}])/gu,
    (_, base, sub) => `${base}<sub>${sub}</sub>`,
  );
}
