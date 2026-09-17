/* ============================================================
   Totales de una cotización — función pura, sin I/O ni React.

   Vive aquí y no repartido por las pantallas porque hoy hay CINCO sitios que
   calculan el mismo total (el cajón, el PDF, el portal del ejecutivo, el
   detalle del cliente y los correos). Con un descuento de por medio, cinco
   copias de la aritmética son cinco oportunidades de contradecir al documento
   que Shopify acabó emitiendo.

   El porcentaje NUNCA se escribe aquí: llega desde Shopify (ver
   getDiscountByCode en ~/lib/admin/operations) y este módulo sólo lo aplica.
   ============================================================ */
import {round2} from '~/lib/decoration/engine';

/** IVA mexicano. Estimado, igual que el resto de la cotización. */
export const IVA_RATE = 0.16;

/**
 * Un porcentaje sólo cuenta si Shopify mandó un número usable. Un 150% o un
 * -5% no se corrigen a 100/0: se ignoran, porque un total inventado es peor
 * que un total sin descuento.
 * @param {{percentage?: unknown}|null|undefined} discount
 * @returns {number} el porcentaje aplicable, o 0
 */
function usablePercentage(discount) {
  const p = Number(discount?.percentage);
  if (!Number.isFinite(p) || p <= 0 || p > 100) return 0;
  return p;
}

/**
 * Subtotal, descuento, IVA y total de una cotización.
 *
 * El orden importa: el descuento baja el subtotal y el IVA se calcula sobre el
 * subtotal YA descontado. Así lo calcula Shopify en la draft order y así se
 * factura en México.
 *
 * @param {Array<{effectiveUnitPrice?: number, qty?: number}>|null|undefined} items
 * @param {{code?: string, percentage?: number}|null|undefined} discount
 * @returns {{subtotal:number, descuento:number, subtotalNeto:number, iva:number, total:number}}
 */
export function quoteTotals(items, discount) {
  const subtotal = round2(
    (Array.isArray(items) ? items : []).reduce((s, i) => {
      const precio = Number(i?.effectiveUnitPrice);
      const qty = Number(i?.qty);
      if (!Number.isFinite(precio) || !Number.isFinite(qty)) return s;
      return s + precio * qty;
    }, 0),
  );
  const pct = usablePercentage(discount);
  const descuento = round2((subtotal * pct) / 100);
  const subtotalNeto = round2(subtotal - descuento);
  const iva = round2(subtotalNeto * IVA_RATE);
  const total = round2(subtotalNeto + iva);
  return {subtotal, descuento, subtotalNeto, iva, total};
}
