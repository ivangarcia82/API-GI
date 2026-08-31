// Escapado HTML compartido por todas las plantillas de correo. Vivía duplicado
// en quotes/emailParts.js y email/templates.js; una sola copia evita que las
// plantillas se separen en lo que consideran seguro interpolar.

/**
 * @param {unknown} value
 * @returns {string} value safe to interpolate into HTML text or an attribute
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
