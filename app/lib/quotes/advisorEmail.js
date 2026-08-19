// Pure helper: build the advisor notification email payload (no I/O).
// Returns {to, subject, html} ready for sendEmail.
import {escapeHtml, itemsTableHtml} from './emailParts.js';

/**
 * @param {{
 *   advisorEmail: string,
 *   quote: {id: string, notes?: string|null, deadline?: string|null},
 *   user: {email: string, firstName?: string, lastName?: string, company?: string},
 *   items: Array<{title: string, qty: number, technique?: string, size?: string, effectiveUnitPrice: number}>,
 *   invoiceUrl: string|null,
 * }} args
 * @returns {{to: string, subject: string, html: string}}
 */
export function buildAdvisorEmail({advisorEmail, quote, user, items, invoiceUrl}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

  const invoiceBlock = invoiceUrl
    ? `<p><a href="${escapeHtml(invoiceUrl)}">Ver cotización en Shopify</a></p>`
    : '';

  const deadlineBlock = quote.deadline
    ? `<p><strong>Fecha objetivo:</strong> ${escapeHtml(quote.deadline)}</p>`
    : '';

  const notesBlock = quote.notes
    ? `<p><strong>Notas del cliente:</strong> ${escapeHtml(quote.notes)}</p>`
    : '';

  const html = `
    <div style="font-family:Arial,sans-serif;color:#1a1a1a">
      <h2>Nueva cotización ${escapeHtml(quote.id)}</h2>
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
    subject: `Nueva cotización ${quote.id} — ${fullName || user.email}`,
    html,
  };
}
