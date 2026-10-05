// Pure helper: build the buyer's quote confirmation email (no I/O).
// Deliberately omits the Shopify invoice URL — the buyer gets the account copy,
// not a payable invoice, until an advisor has reviewed the quote.
import {escapeHtml, itemsTableHtml} from './emailParts.js';
import {folioVisible} from './folio.js';
import {brandedEmail} from '../email/layout.js';

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
  const folio = folioVisible(quote);

  const deadlineBlock = quote.deadline
    ? `<p><strong>Fecha objetivo:</strong> ${escapeHtml(quote.deadline)}</p>`
    : '';

  const html = brandedEmail({
    preheader: `Folio ${folio}: un asesor revisará tu solicitud.`,
    heading: 'Recibimos tu cotización',
    bodyHtml: `
  <p>Hola ${escapeHtml(greeting)},</p>
  <p>Recibimos tu solicitud. Un asesor la revisará y te contactará con la propuesta formal.</p>
  <p><strong>Folio:</strong> ${escapeHtml(folio)}</p>
  ${deadlineBlock}
  ${itemsTableHtml(items, {
    totalLabel: 'Total estimado',
    discount: {code: quote.discountCode, percentage: quote.discountPercentage},
  })}`,
    cta: {url: quoteUrl, label: 'Ver mi cotización'},
    footnote: 'Los precios mostrados son estimados y están sujetos a confirmación de tu asesor.',
  });

  return {
    to: user.email,
    subject: `Recibimos tu cotización ${folio} — Generando Ideas`,
    html,
  };
}
