// Server-only. HTML email bodies for verify + reset flows. URLs are escaped
// before interpolation so a crafted link cannot break the href attribute.
import {escapeHtml} from './escape.js';

function layout(heading, bodyHtml, ctaUrl, ctaLabel) {
  const url = escapeHtml(ctaUrl);
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.5">
  <h1 style="font-size:20px">${escapeHtml(heading)}</h1>
  ${bodyHtml}
  <p style="margin:24px 0">
    <a href="${url}" style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">${escapeHtml(ctaLabel)}</a>
  </p>
  <p style="font-size:12px;color:#666">Si el botón no funciona, copia y pega este enlace:<br>${url}</p>
  <p style="font-size:12px;color:#666">Generando Ideas</p>
  </body></html>`;
}

/**
 * @param {string} verifyUrl
 * @returns {{subject: string, html: string}}
 */
export function verifyEmailTemplate(verifyUrl) {
  return {
    subject: 'Verifica tu correo — Generando Ideas',
    html: layout(
      'Verifica tu correo',
      '<p>Gracias por registrarte. Confirma tu correo para activar tu cuenta.</p>',
      verifyUrl,
      'Verificar correo',
    ),
  };
}

/**
 * @param {string} resetUrl
 * @returns {{subject: string, html: string}}
 */
export function resetPasswordTemplate(resetUrl) {
  return {
    subject: 'Restablece tu contraseña — Generando Ideas',
    html: layout(
      'Restablece tu contraseña',
      '<p>Recibimos una solicitud para restablecer tu contraseña. El enlace expira en 1 hora. Si no fuiste tú, ignora este correo.</p>',
      resetUrl,
      'Restablecer contraseña',
    ),
  };
}
