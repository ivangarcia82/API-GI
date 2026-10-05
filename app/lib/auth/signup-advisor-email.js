// Pure helper: build the "hay un registro nuevo" email para marketing (no I/O).
// Returns {to, subject, html} ready for sendEmail.
//
// Sin botón: ningún correo manda a Shopify, y la plataforma todavía no tiene
// una pantalla de lead que enseñar. Los datos para decidir la asignación van en
// el cuerpo.
import {escapeHtml} from '../email/escape.js';
import {brandedEmail} from '../email/layout.js';

const DASH = '—';


function row(label, value) {
  return `
      <tr>
        <td style="padding:6px 16px 6px 0;color:#666;white-space:nowrap">${escapeHtml(label)}</td>
        <td style="padding:6px 0"><strong>${escapeHtml(value || DASH)}</strong></td>
      </tr>`;
}

/**
 * @param {{
 *   advisorTo: string,
 *   advisorName?: string,
 *   user: {email: string, firstName?: string|null, lastName?: string|null, company?: string|null, phone?: string|null},
 *   claimedAdvisor?: string|null,
 *   cc?: string|string[]|null,
 *   esCliente?: string|null,
 * }} args
 * @returns {{to: string, subject: string, html: string}}
 */
export function buildSignupAdvisorEmail({
  advisorTo,
  advisorName,
  user,
  claimedAdvisor,
  esCliente,
  cc,
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const quien = fullName || user.email;
  const yaCliente = esCliente === 'si' ? 'Sí' : esCliente === 'no' ? 'No' : DASH;

  const saludo = advisorName
    ? `<p>Hola ${escapeHtml(advisorName)},</p>`
    : '';

  const html = brandedEmail({
    preheader: `${quien} creó una cuenta y espera ejecutivo de venta.`,
    heading: 'Nuevo registro',
    bodyHtml: `
      ${saludo}
      <p><strong>${escapeHtml(quien)}</strong> creó una cuenta y está pendiente de que le asignen ejecutivo de venta.</p>
      <table role="presentation" style="border-collapse:collapse;margin-top:12px">
        <tbody>${row('Correo', user.email)}${row('Teléfono', user.phone)}${row('Empresa', user.company)}${row('Ya es cliente', yaCliente)}${row('Asesor que indicó', claimedAdvisor)}</tbody>
      </table>`,
  });

  return {
    to: advisorTo,
    // Sólo cuando lo hay: Resend rechaza cc: undefined.
    ...(cc ? {cc} : {}),
    subject: `Nuevo registro ${DASH} ${quien}`,
    html,
  };
}
