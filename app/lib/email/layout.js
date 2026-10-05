// Server-only. Diseño común de todos los correos de la plataforma (verificar
// correo, restablecer contraseña, confirmación de cotización, aviso al
// asesor): logo, franja naranja, botón de la marca y el mismo pie que el PDF.
//
// Hecho con tablas y estilos en línea a propósito: es lo único que respetan
// Gmail y Outlook. Nada de <style>, flex ni SVG.
import {escapeHtml} from './escape.js';
import {BRAND} from '../site-content.js';

/** Logo en PNG: Gmail y Outlook no pintan SVG. Vive en /public. */
export const LOGO_PATH = '/brand/gi-logo-horizontal-email.png';

// Cuando el correo no trae un enlace del que sacar el dominio.
const ORIGEN_PRODUCCION = 'https://generandoideas.com';
const NARANJA = '#ff8300';
const TINTA = '#2e3033';
const GRIS = '#636569';

/* El logo se pide al mismo dominio que el enlace del botón: en desarrollo o
   en una vista previa apunta a ese entorno y no a producción. */
function origenDe(url) {
  try {
    return new URL(url).origin;
  } catch {
    return ORIGEN_PRODUCCION;
  }
}

/**
 * @param {{
 *   heading: string,
 *   bodyHtml: string,
 *   cta?: {url: string, label: string}|null,
 *   footnote?: string,
 *   preheader?: string,
 * }} args `bodyHtml` y `footnote` ya vienen escapados por quien los arma.
 * @returns {string}
 */
export function brandedEmail({heading, bodyHtml, cta = null, footnote = '', preheader = ''}) {
  const origen = cta?.url ? origenDe(cta.url) : ORIGEN_PRODUCCION;
  const url = cta ? escapeHtml(cta.url) : '';

  const boton = cta
    ? `
          <tr><td style="padding:8px 40px 4px">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="border-radius:999px;background-color:${NARANJA}">
                <a href="${url}" style="display:inline-block;padding:14px 28px;border-radius:999px;background-color:${NARANJA};color:#ffffff;font-weight:bold;font-size:15px;text-decoration:none">${escapeHtml(cta.label)}</a>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:16px 40px 0;font-size:12px;line-height:1.5;color:${GRIS}">
            Si el botón no funciona, copia y pega este enlace:<br>
            <a href="${url}" style="color:${GRIS};word-break:break-all">${url}</a>
          </td></tr>`
    : '';

  const nota = footnote
    ? `<tr><td style="padding:16px 40px 0;font-size:12px;line-height:1.5;color:${GRIS}">${footnote}</td></tr>`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:${TINTA}">
        <tr><td style="height:6px;background-color:${NARANJA};line-height:6px;font-size:0">&nbsp;</td></tr>
        <tr><td style="padding:28px 40px 8px">
          <img src="${origen}${LOGO_PATH}" width="200" height="48" alt="Generando Ideas" style="display:block;border:0;width:200px;height:auto">
        </td></tr>
        <tr><td style="padding:16px 40px 0">
          <h1 style="margin:0;font-size:24px;line-height:1.25;color:${TINTA}">${escapeHtml(heading)}</h1>
        </td></tr>
        <tr><td style="padding:12px 40px 16px;font-size:15px;line-height:1.6;color:${TINTA}">
          ${bodyHtml}
        </td></tr>
        ${boton}
        ${nota}
        <tr><td style="padding:32px 40px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e9eaeb">
            <tr><td align="center" style="padding-top:20px">
              <div style="font-size:18px;font-weight:bold;letter-spacing:2px;color:#c9cacd">YOUR ONE STOP SOLUTION.</div>
              <div style="margin-top:8px;font-size:11px;line-height:1.5;color:${GRIS}">${escapeHtml(BRAND.legalName)}<br>${escapeHtml(BRAND.address)}</div>
              <div style="margin-top:6px;font-size:11px"><a href="${ORIGEN_PRODUCCION}" style="color:${NARANJA};text-decoration:none">generandoideas.com</a></div>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
