/* ============================================================
   Carrito de invitado (sin sesión) — funciones puras.

   Vive en localStorage y sólo carga INTENCIÓN: variante, técnica, sustrato,
   talla y cantidad. Los precios que guarda son de display; el servidor los
   vuelve a pedir a Shopify al migrar (ver /api/quote/merge), así que un
   localStorage manipulado no puede abaratar nada.
   ============================================================ */
import {recomputeItemPricing} from '~/lib/quotes/recompute';
import {opcionesDeVariante} from '~/lib/quotes/variantOptions';

/** Técnica por defecto cuando el botón no pasó por el selector de decorado. */
const SIN_DECORADO = 'Sin decorado';

function texto(v) {
  return v == null ? '' : String(v);
}

function cantidad(v) {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function precio(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Normaliza una línea suelta al shape estable que guarda el navegador.
 * @param {Record<string, unknown>} input
 * @param {number} now
 * @returns {object|null} la línea, o null si no se podría cotizar
 */
export function normalizeGuestLine(input, now) {
  const variantId = texto(input?.variantId).trim();
  if (!variantId) return null;
  return {
    id: texto(input?.id).trim() || crypto.randomUUID(),
    variantId,
    // Las cuatro claves de intención: lo único que el servidor lee al migrar.
    technique: texto(input?.technique).trim() || SIN_DECORADO,
    surface: texto(input?.surface),
    size: texto(input?.size),
    qty: cantidad(input?.qty),
    // Sólo display, para que el cajón pinte algo antes de que exista sesión.
    productHandle: texto(input?.productHandle ?? input?.handle),
    title: texto(input?.title),
    image: input?.image ?? null,
    options: opcionesDeVariante(input?.options),
    baseUnitPrice: precio(input?.baseUnitPrice ?? input?.price),
    addedAt: now,
  };
}

/** Tope de líneas del carrito de invitado: el sobre no debe crecer sin freno. */
export const MAX_GUEST_LINES = 50;

/** Las cuatro claves que hacen única a una línea (variante + decorado). */
function intentKey(l) {
  return [l.variantId, l.technique, l.surface, l.size].join('|');
}

/**
 * Añade una línea al carrito de invitado sumando cantidades cuando la variante
 * Y el decorado coinciden. Al llegar al tope descarta la más antigua.
 * @param {Array} lines
 * @param {object|null} line - ya normalizada
 * @param {number} now
 * @returns {Array} lista nueva
 */
export function addGuestLine(lines, line, now) {
  const previas = Array.isArray(lines) ? lines : [];
  if (!line || !line.variantId) return previas;
  const clave = intentKey(line);
  const i = previas.findIndex((l) => intentKey(l) === clave);
  if (i !== -1) {
    const next = previas.slice();
    next[i] = {...next[i], qty: next[i].qty + line.qty, addedAt: now};
    return next;
  }
  return [...previas, line].slice(-MAX_GUEST_LINES);
}

/** Versión del sobre. Un sobre de otra versión se descarta, no se migra. */
export const GUEST_QUOTE_VERSION = 1;

/** 30 días. Pasado ese plazo los precios de lista guardados ya no son fiables. */
export const GUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Serializa el carrito de invitado para localStorage.
 * @param {Array} lines
 * @param {number} now
 * @returns {string}
 */
export function serializeGuestQuote(lines, now) {
  return JSON.stringify({
    version: GUEST_QUOTE_VERSION,
    savedAt: now,
    lines: (Array.isArray(lines) ? lines : []).slice(-MAX_GUEST_LINES),
  });
}

/**
 * Lee el sobre. Ante basura, otra versión o caducidad devuelve lista vacía:
 * perder el carrito de un invitado es barato, reventar el primer render no.
 * @param {string|null|undefined} raw
 * @param {number} now
 * @returns {Array}
 */
export function parseGuestQuote(raw, now) {
  let sobre;
  try {
    sobre = JSON.parse(String(raw));
  } catch {
    return [];
  }
  if (!sobre || typeof sobre !== 'object') return [];
  if (sobre.version !== GUEST_QUOTE_VERSION) return [];
  if (!Array.isArray(sobre.lines)) return [];
  const savedAt = Number(sobre.savedAt);
  if (!Number.isFinite(savedAt) || now - savedAt >= GUEST_TTL_MS) return [];
  return sobre.lines
    .map((l) => normalizeGuestLine(l, Number(l?.addedAt) || savedAt))
    .filter(Boolean)
    .slice(-MAX_GUEST_LINES);
}

/**
 * El cuerpo de la migración: sólo intención. Todo lo de display se queda en el
 * navegador porque el servidor vuelve a pedírselo a Shopify.
 * @param {Array} lines
 * @returns {Array<{variantId:string,technique:string,surface:string,size:string,qty:number}>}
 */
export function guestMergePayload(lines) {
  return (Array.isArray(lines) ? lines : [])
    .slice(-MAX_GUEST_LINES)
    .map(({variantId, technique, surface, size, qty}) => ({
      variantId,
      technique,
      surface,
      size,
      qty,
    }));
}

/**
 * Calcula lo que el cajón le enseña al invitado. Corre el MISMO motor puro que
 * el servidor, así que el precio por pieza que ve sin sesión es el que verá al
 * entrar. Si la combinación de decorado no existe cae al precio de lista en vez
 * de pintar NaN: el servidor rechazará esa línea al migrar y se le avisará.
 * @param {object} line
 * @returns {object} la linea con decorationTotal y effectiveUnitPrice
 */
export function priceGuestLine(line) {
  const {decorationTotal, effectiveUnitPrice} = recomputeItemPricing({
    baseUnitPrice: line.baseUnitPrice,
    technique: line.technique,
    surface: line.surface,
    size: line.size,
    qty: line.qty,
  });
  return {...line, decorationTotal, effectiveUnitPrice};
}

/**
 * Qué hacer con el carrito local después de intentar migrarlo.
 *
 * Se borra SÓLO contra una respuesta buena. La migración de favoritos hace lo
 * contrario —borra pase lo que pase— y por eso un 500 o una red caída se lleva
 * la lista para siempre; aquí el carrito se queda y el siguiente intento lo
 * vuelve a subir.
 *
 * @param {{ok?: boolean, migradas?: number, descartadas?: number}|null|undefined} data
 * @returns {{clearLocal: boolean, message: string|null, isError: boolean}}
 */
export function guestMergeOutcome(data) {
  if (!data || data.ok !== true) {
    return {
      clearLocal: false,
      message: 'No pudimos pasar tu lista a tu cuenta. Sigue guardada; vuelve a intentarlo.',
      isError: true,
    };
  }
  const migradas = Number(data.migradas) || 0;
  const descartadas = Number(data.descartadas) || 0;
  if (migradas === 0 && descartadas === 0) {
    return {clearLocal: true, message: null, isError: false};
  }
  const cuantos = `${migradas} ${migradas === 1 ? 'artículo' : 'artículos'}`;
  const fuera =
    descartadas === 1
      ? '1 que ya no está disponible'
      : `${descartadas} que ya no están disponibles`;
  const message =
    descartadas > 0
      ? `${cuantos} en tu cotización. Quitamos ${fuera}.`
      : `${cuantos} en tu cotización.`;
  return {clearLocal: true, message, isError: false};
}
