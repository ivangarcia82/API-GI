// Shared, pure building blocks for the quote emails (advisor + customer).
// Kept in one place so both templates render an identical items table.
import {escapeHtml} from '../email/escape.js';
import {quoteTotals} from './discount.js';

// Re-exportado para no romper a quien ya lo importa desde aquí.
export {escapeHtml};

export function money(amount) {
  return Number(amount || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function decorationLabel(item) {
  if (item.technique && item.technique !== 'Sin decorado') {
    return [item.technique, item.size].filter(Boolean).join(' ');
  }
  return 'Sin decorado';
}

export function quoteTotal(items) {
  return items.reduce((s, i) => s + Number(i.effectiveUnitPrice) * i.qty, 0);
}

/** Una fila del pie de la tabla. */
function filaPie(etiqueta, importe) {
  return `
          <tr>
            <td colspan="4" style="padding:10px;text-align:right;font-weight:bold">${escapeHtml(etiqueta)}</td>
            <td style="padding:10px;text-align:right;font-weight:bold">${importe}</td>
          </tr>`;
}

/**
 * @param {Array<{title: string, qty: number, technique?: string, size?: string, effectiveUnitPrice: number}>} items
 * @param {{totalLabel?: string, discount?: {code?: string, percentage?: number}|null}} [opts]
 * @returns {string}
 */
export function itemsTableHtml(items, {totalLabel = 'Total', discount = null} = {}) {
  const totales = quoteTotals(items, discount);
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

  return `
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
        <tfoot>${
          // Con cupón el pie se desglosa; sin él se queda en una sola línea,
          // que es como han salido todos los correos hasta hoy.
          totales.descuento > 0
            ? filaPie('Subtotal', `$${money(totales.subtotal)}`) +
              filaPie(
                `Descuento (${discount.code})`,
                `-$${money(totales.descuento)}`,
              ) +
              filaPie(totalLabel, `$${money(totales.subtotalNeto)}`)
            : filaPie(totalLabel, `$${money(totales.subtotal)}`)
        }
        </tfoot>
      </table>`;
}
