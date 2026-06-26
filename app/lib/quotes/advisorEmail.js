// Pure helper: build the advisor notification email payload (no I/O).
// Returns {to, subject, html} ready for Phase 8 sendEmail.

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(amount) {
  return Number(amount || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function decorationLabel(item) {
  if (item.technique && item.technique !== 'Sin decorado') {
    return [item.technique, item.size].filter(Boolean).join(' ');
  }
  return 'Sin decorado';
}

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
  const total = items.reduce((s, i) => s + Number(i.effectiveUnitPrice) * i.qty, 0);

  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(i.title)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(decorationLabel(i))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${i.qty}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">$${money(i.effectiveUnitPrice)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">$${money(Number(i.effectiveUnitPrice) * i.qty)}</td>
      </tr>`,
    )
    .join('');

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
      <table style="border-collapse:collapse;width:100%;margin-top:12px">
        <thead>
          <tr style="text-align:left">
            <th style="padding:6px 10px;border-bottom:2px solid #ddd">Producto</th>
            <th style="padding:6px 10px;border-bottom:2px solid #ddd">Decorado</th>
            <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:right">Cant.</th>
            <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:right">Unitario</th>
            <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:right">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="padding:10px;text-align:right;font-weight:bold">Total</td>
            <td style="padding:10px;text-align:right;font-weight:bold">$${money(total)}</td>
          </tr>
        </tfoot>
      </table>
      ${invoiceBlock}
    </div>`;

  return {
    to: advisorEmail,
    subject: `Nueva cotización ${quote.id} — ${fullName || user.email}`,
    html,
  };
}
