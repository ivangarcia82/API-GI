/* Generando Ideas — precio por cliente en servidor.
 *
 * Server-only: importa el cliente de Admin API. La fórmula vive en pricing.js.
 *
 * Dos lecturas con cachés distintas a propósito:
 *   - el margen depende del cliente: clave con su gid;
 *   - el costo no depende de quién mira: una entrada compartida por todos.
 * Sin margen no se pide ni un costo: el visitante anónimo y el cliente sin
 * margen no pagan nada por esta funcionalidad.
 */
import {CacheShort} from '@shopify/hydrogen';
import {getSessionUser} from './auth/session.js';
import {getCustomerMarginRaw, getVariantCosts} from './admin/operations.js';
import {parseMargin, customerPrice} from './pricing.js';

/* Memo por request, igual que en brand-colors.server.js: root y la ruta corren
   en paralelo y no deben pagar dos veces la misma lectura. */
const porRequest = new WeakMap();

function memo(context, clave, fn) {
  let cajon = porRequest.get(context);
  if (!cajon) {
    cajon = {};
    porRequest.set(context, cajon);
  }
  if (!cajon[clave]) cajon[clave] = fn();
  return cajon[clave];
}

async function leerMargen(context) {
  const usuario = getSessionUser(context.session);
  if (!usuario?.gid) return null;

  let raw;
  try {
    raw = await context.withCache.run(
      {
        // La clave lleva el gid: dos clientes con márgenes distintos nunca
        // comparten entrada.
        cacheKey: ['gi-margin', usuario.gid],
        cacheStrategy: CacheShort({maxAge: 300, staleWhileRevalidate: 300}),
        shouldCacheResult: (v) => v !== undefined,
      },
      () => getCustomerMarginRaw(context.env, usuario.gid),
    );
  } catch (error) {
    // Ninguna página se cae por el margen: sin él, precio de lista.
    console.error('[pricing] no se pudo leer custom.margen:', error);
    return null;
  }

  if (raw == null) return null;
  const margin = parseMargin(raw);
  if (margin == null) {
    console.warn(`[pricing] custom.margen inválido en ${usuario.gid}: ${raw}`);
  }
  return margin;
}

/**
 * El margen del cliente de esta request (porcentaje), o null si se le cobra el
 * precio de lista.
 * @param {any} context contexto de Hydrogen
 * @returns {Promise<number|null>}
 */
export function getCustomerMargin(context) {
  return memo(context, 'margin', () => leerMargen(context));
}

async function leerCostos(context, ids) {
  const unicos = [...new Set(ids.filter(Boolean))].sort();
  if (!unicos.length) return {};
  try {
    return await context.withCache.run(
      {
        // Sin gid en la clave: el costo es el mismo para todos los clientes.
        cacheKey: ['gi-variant-costs', ...unicos],
        cacheStrategy: CacheShort(),
        shouldCacheResult: (v) => Boolean(v) && typeof v === 'object',
      },
      () => getVariantCosts(context.env, unicos),
    );
  } catch (error) {
    console.error('[pricing] no se pudieron leer los costos:', error);
    return {};
  }
}

/**
 * Precio base de cada variante para el cliente de esta request. Es lo que la
 * cotización guarda como baseUnitPrice.
 * @param {any} context
 * @param {{variantId: string, listPrice: number}[]} entries
 * @returns {Promise<Map<string, number>>}
 */
export async function resolveBasePrices(context, entries) {
  const lista = (e) => Number(e.listPrice) || 0;
  const out = new Map(entries.map((e) => [e.variantId, lista(e)]));
  if (!entries.length) return out;
  const margin = await getCustomerMargin(context);
  if (margin == null) return out;
  const costos = await leerCostos(context, entries.map((e) => e.variantId));
  for (const e of entries) {
    out.set(e.variantId, customerPrice({cost: costos[e.variantId], margin, listPrice: lista(e)}));
  }
  return out;
}

const VARIANT_GID = 'gid://shopify/ProductVariant/';

function recorrer(nodo, visitar) {
  if (Array.isArray(nodo)) {
    for (const n of nodo) recorrer(n, visitar);
  } else if (nodo && typeof nodo === 'object') {
    visitar(nodo);
    for (const v of Object.values(nodo)) recorrer(v, visitar);
  }
}

const esVarianteConPrecio = (n) =>
  typeof n?.id === 'string' && n.id.startsWith(VARIANT_GID) && n.price?.amount != null;

/**
 * Reescribe con el precio del cliente cualquier respuesta cruda de Storefront:
 * tarjetas, ficha, recomendaciones, búsqueda predictiva. Encuentra las
 * variantes por su gid, así que no depende de la forma de cada consulta.
 *
 * Sin margen devuelve `data` intacto (misma referencia) y no hace consultas.
 * Con margen trabaja sobre una copia: la respuesta de Storefront puede venir de
 * una caché compartida y no se debe escribir encima.
 * @template T
 * @param {any} context
 * @param {T} data
 * @returns {Promise<T>}
 */
export async function applyCustomerPrices(context, data) {
  if (data == null) return data;
  const margin = await getCustomerMargin(context);
  if (margin == null) return data;

  const copia = structuredClone(data);
  const variantes = [];
  recorrer(copia, (n) => {
    if (esVarianteConPrecio(n)) variantes.push(n);
  });
  if (!variantes.length) return copia;

  const costos = await leerCostos(context, variantes.map((v) => v.id));
  for (const v of variantes) {
    const precio = customerPrice({
      cost: costos[v.id],
      margin,
      listPrice: Number(v.price.amount),
    });
    v.price = {...v.price, amount: String(precio)};
    // Tachar el precio de lista junto al del cliente no tiene sentido.
    if ('compareAtPrice' in v) v.compareAtPrice = null;
  }

  /* La tarjeta pinta priceRange.minVariantPrice (normalizeProduct). Se alinea
     con la variante que se acaba de preciar para que precio y costo hablen de
     la misma variante. */
  recorrer(copia, (n) => {
    const primera = n.variants?.nodes?.[0];
    if (n.priceRange?.minVariantPrice && esVarianteConPrecio(primera)) {
      n.priceRange = {
        ...n.priceRange,
        minVariantPrice: {...n.priceRange.minVariantPrice, amount: primera.price.amount},
      };
    }
  });
  return copia;
}
