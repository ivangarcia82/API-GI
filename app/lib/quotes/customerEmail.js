// Pure helper: build the buyer's quote confirmation email (no I/O).
// Deliberately omits the Shopify invoice URL — the buyer gets the account copy,
// not a payable invoice, until an advisor has reviewed the quote.
import {escapeHtml, itemsTableHtml} from './emailParts.js';

/**
 * @param {{
 *   quote: {id: string, notes?: string|null, deadline?: string|null},
 *   user: {email: string, firstName?: string, lastName?: string, company?: string},
 *   items: Array<{title: string, qty: number, technique?: string, size?: string, effectiveUnitPrice: number}>,
 *   quoteUrl: string,
 * }} args
 * @returns {{to: string, subject: string, html: string}}
 */
export function buildCustomerEmail({quote, user, items, quoteUrl}) {
  const greeting = String(user.firstName ?? '').trim() || user.email;
  const url = escapeHtml(quoteUrl);

  const deadlineBlock = quote.deadline
    ? `<p><strong>Fecha objetivo:</strong> ${escapeHtml(quote.deadline)}</p>`
    : '';

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.5">
  <h1 style="font-size:20px">Recibimos tu cotización</h1>
  <p>Hola ${escapeHtml(greeting)},</p>
  <p>Recibimos tu solicitud. Un asesor la revisará y te contactará con la propuesta formal.</p>
  <p><strong>Folio:</strong> ${escapeHtml(quote.folio || quote.id)}</p>
  ${deadlineBlock}
  ${itemsTableHtml(items, {totalLabel: 'Total estimado'})}
  <p style="margin:24px 0">
    <a href="${url}" style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Ver mi cotización</a>
  </p>
  <p style="font-size:12px;color:#666">Si el botón no funciona, copia y pega este enlace:<br>${url}</p>
  <p style="font-size:12px;color:#666">Los precios mostrados son estimados y están sujetos a confirmación de tu asesor.</p>
  <p style="font-size:12px;color:#666">Generando Ideas</p>
  </body></html>`;

  return {
    to: user.email,
    subject: `Recibimos tu cotización ${quote.folio || quote.id} — Generando Ideas`,
    html,
  };
}
