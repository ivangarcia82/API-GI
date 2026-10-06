// Server-only. Vuelve a preciar líneas ya guardadas con el precio de lista
// ACTUAL y el margen ACTUAL del cliente. Lo usan "volver a cotizar" (la
// cotización vieja puede tener meses) y el envío (el borrador puede tener días
// y el margen o el costo pudieron cambiar entretanto).
import {recomputeItemPricing} from './recompute.js';
import {resolveBasePrices} from '../pricing.server.js';
import {opcionesDeVariante} from './variantOptions.js';

const LIST_PRICES_QUERY = `#graphql
  query QuoteListPrices($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        price { amount }
        selectedOptions { name value }
      }
    }
  }
`;

/**
 * @param {any} context contexto de Hydrogen (storefront, env, session, withCache)
 * @param {Array<Record<string, any>>} items líneas con la forma de repo.js
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function repriceItems(context, items) {
  if (!items.length) return items;

  const ids = [...new Set(items.map((i) => i.variantId).filter(Boolean))];
  let nodes;
  try {
    ({nodes} = await context.storefront.query(LIST_PRICES_QUERY, {variables: {ids}}));
  } catch (error) {
    // Sin precio de lista actual no se reprecia: se sigue con lo guardado.
    console.error('[quote.reprice] no se pudo leer el precio de lista:', error);
    return items;
  }

  const vivas = (nodes || []).filter((n) => n?.id && n.price?.amount != null);
  /* Las líneas guardadas antes de que existiera variant_options llegan sin
     color ni talla: se completan aquí, que es justo antes de emitir el PDF y
     los correos. */
  const opcionesPorId = new Map(vivas.map((n) => [n.id, opcionesDeVariante(n.selectedOptions)]));
  const conOpciones = (item) =>
    item.options?.length || !opcionesPorId.get(item.variantId)?.length
      ? item
      : {...item, options: opcionesPorId.get(item.variantId)};
  let bases;
  try {
    // Estricto: si el margen o los costos no se pudieron leer, un cliente con
    // margen no puede acabar cotizado a precio de lista por un hipo del Admin API.
    bases = await resolveBasePrices(
      context,
      vivas.map((n) => ({variantId: n.id, listPrice: Number(n.price.amount)})),
      {strict: true},
    );
  } catch (error) {
    console.error('[quote.reprice] no se pudo resolver el precio del cliente:', error);
    return items.map(conOpciones);
  }

  return items.map((item) => {
    // La variante se retiró de la tienda: se queda con el precio con que se cotizó.
    if (!bases.has(item.variantId)) return conOpciones(item);
    const priced = recomputeItemPricing({
      baseUnitPrice: bases.get(item.variantId),
      technique: item.technique,
      surface: item.surface,
      size: item.size,
      qty: item.qty,
    });
    if (priced.error) return conOpciones(item);
    return {
      ...conOpciones(item),
      baseUnitPrice: priced.baseUnitPrice,
      decorationTotal: priced.decorationTotal,
      effectiveUnitPrice: priced.effectiveUnitPrice,
    };
  });
}
