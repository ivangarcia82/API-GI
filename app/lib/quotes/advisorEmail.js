// Pure helper: build the advisor notification email payload (no I/O).
// Returns {to, subject, html} ready for sendEmail.
import {escapeHtml, itemsTableHtml} from './emailParts.js';
import {folioVisible} from './folio.js';

/**
 * @param {{
 *   advisorEmail: string,
 *   managerEmail?: string|null,
 *   quote: {id: string, notes?: string|null, deadline?: string|null},
 *   user: {email: string, firstName?: string, lastName?: string, company?: string},
 *   items: Array<{title: string, qty: number, technique?: string, size?: string, effectiveUnitPrice: number}>,
 *   portalUrl?: string|null,
 * }} args
 * @returns {{to: string, cc?: string, subject: string, html: string}}
 */
export function buildAdvisorEmail({
  advisorEmail,
  managerEmail,
  quote,
  user,
  items,
  portalUrl,
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const folio = folioVisible(quote);

  // Siempre al portal. Ningún correo manda a Shopify: la cotización se lee en
  // la plataforma, con su formato y su detalle de decorado.
  const invoiceBlock = portalUrl
    ? `<p><a href="${escapeHtml(portalUrl)}">Ver cotización en el portal</a></p>`
    : '';

  const deadlineBlock = quote.deadline
    ? `<p><strong>Fecha objetivo:</strong> ${escapeHtml(quote.deadline)}</p>`
    : '';

  const notesBlock = quote.notes
    ? `<p><strong>Notas del cliente:</strong> ${escapeHtml(quote.notes)}</p>`
    : '';

  const html = `
    <div style="font-family:Arial,sans-serif;color:#1a1a1a">
      <h2>Nueva cotización ${escapeHtml(folio)}</h2>
      <p>
        <strong>Cliente:</strong> ${escapeHtml(fullName || user.email)}<br/>
        <strong>Empresa:</strong> ${escapeHtml(user.company || '—')}<br/>
        <strong>Correo:</strong> ${escapeHtml(user.email)}
      </p>
      ${deadlineBlock}
      ${notesBlock}
      ${itemsTableHtml(items)}
      ${invoiceBlock}
    </div>`;

  return {
    to: advisorEmail,
    // Sólo se copia al manager cuando lo hay: Resend rechaza cc: undefined.
    ...(managerEmail ? {cc: managerEmail} : {}),
    subject: `Nueva cotización ${folio} — ${fullName || user.email}`,
    html,
  };
}
