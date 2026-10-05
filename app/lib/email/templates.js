// Server-only. HTML email bodies for verify + reset flows, con el diseño de
// la marca (layout.js). El enlace se escapa dentro de brandedEmail para que un
// enlace manipulado no rompa el atributo href.
import {brandedEmail} from './layout.js';

/**
 * @param {string} verifyUrl
 * @returns {{subject: string, html: string}}
 */
export function verifyEmailTemplate(verifyUrl) {
  return {
    subject: 'Verifica tu correo — Generando Ideas',
    html: brandedEmail({
      preheader: 'Confirma tu correo para activar tu cuenta.',
      heading: 'Verifica tu correo',
      bodyHtml: '<p style="margin:0">Gracias por registrarte. Confirma tu correo para activar tu cuenta.</p>',
      cta: {url: verifyUrl, label: 'Verificar correo'},
    }),
  };
}

/**
 * @param {string} resetUrl
 * @returns {{subject: string, html: string}}
 */
export function resetPasswordTemplate(resetUrl) {
  return {
    subject: 'Restablece tu contraseña — Generando Ideas',
    html: brandedEmail({
      preheader: 'El enlace para restablecer tu contraseña expira en 1 hora.',
      heading: 'Restablece tu contraseña',
      bodyHtml:
        '<p style="margin:0">Recibimos una solicitud para restablecer tu contraseña. El enlace expira en 1 hora. Si no fuiste tú, ignora este correo.</p>',
      cta: {url: resetUrl, label: 'Restablecer contraseña'},
    }),
  };
}
