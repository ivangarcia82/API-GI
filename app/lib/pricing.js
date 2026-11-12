/* Generando Ideas — precio por cliente sobre costo.
 *
 * Puro: sin red ni sesión, lo usan servidor y pruebas. La lectura del margen y
 * de los costos vive en pricing.server.js.
 *
 * El margen es bruto, como el /0.67 de la decoración: con margen 30 el costo es
 * el 70 % del precio, así que precio = costo / 0.70.
 */
import {round2} from './decoration/engine.js';

/* El precio de lista de la tienda es costo / 0.30 en el 99,7 % del catálogo
   (verificado el 2026-10-05). Es lo que deja traducir un rango de precio del
   cliente a uno de lista y que Shopify filtre y ordene por nosotros. */
export const LIST_MARGIN = 70;

/**
 * El margen del metafield `custom.margen` (porcentaje: 30 = 30 %), o null si no
 * es usable. El metafield no tiene validaciones en Shopify: 0, 100, negativos
 * o texto acaban aquí y significan "precio de lista".
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parseMargin(raw) {
  if (raw == null || raw === '') return null;
  const m = typeof raw === 'number' ? raw : Number(String(raw).trim());
  return Number.isFinite(m) && m > 0 && m < 100 ? m : null;
}

/**
 * Precio de una variante para un cliente. Sin margen o sin costo, el de lista.
 * @param {{cost: number|null|undefined, margin: number|null, listPrice: number}} args
 * @returns {number}
 */
export function customerPrice({cost, margin, listPrice}) {
  const c = Number(cost);
  if (margin == null || cost == null || !Number.isFinite(c) || c <= 0) return listPrice;
  return round2(c / (1 - margin / 100));
}

/**
 * Cuánto vale en precio de lista un peso de precio del cliente.
 * @param {number|null} margin
 * @returns {number}
 */
export function listFactor(margin) {
  if (margin == null) return 1;
  return (1 - margin / 100) / (1 - LIST_MARGIN / 100);
}

/* Primero se quita el ruido de punto flotante (a 4 decimales de centavo) y
   luego se redondea hacia afuera: el mínimo baja y el máximo sube, para que el
   redondeo nunca deje fuera un artículo que está justo en el borde. */
const aCentavos = (valor, redondeo) => redondeo(Math.round(valor * 1e6) / 1e4) / 100;

/**
 * El rango de precio que escribió el cliente, expresado en precio de lista.
 * @param {{min: number|null, max: number|null}} rango
 * @param {number|null} margin
 * @returns {{min: number|null, max: number|null}}
 */
export function toListRange({min = null, max = null}, margin) {
  const f = listFactor(margin);
  if (f === 1) return {min, max};
  return {
    min: min == null ? null : aCentavos(min * f, Math.floor),
    max: max == null ? null : aCentavos(max * f, Math.ceil),
  };
}

/* Un importe de Storefront (MoneyV2): un objeto con `amount`. */
const esImporte = (v) =>
  v != null && typeof v === 'object' && !Array.isArray(v) && 'amount' in v;

/**
 * Copia de una respuesta de Storefront sin un solo importe: cada precio queda
 * en null, esté donde esté (variante, priceRange, compareAtPrice…). Es lo que
 * recibe quien no ha iniciado sesión.
 *
 * Devuelve una copia: la respuesta puede venir de una caché compartida con las
 * peticiones de clientes con sesión y no se debe escribir encima.
 * @template T
 * @param {T} data
 * @returns {T}
 */
export function sinImportes(data) {
  if (Array.isArray(data)) return data.map(sinImportes);
  if (data == null || typeof data !== 'object') return data;
  const copia = {};
  for (const [clave, valor] of Object.entries(data)) {
    copia[clave] = esImporte(valor) ? null : sinImportes(valor);
  }
  return copia;
}
