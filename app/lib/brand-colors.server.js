/* Generando Ideas — resolución en servidor de la paleta de marca del cliente.
 *
 * Server-only: importa el cliente de Admin API. Las funciones puras que también
 * necesita el navegador viven en brand-colors.js.
 */
import {CacheLong, CacheShort} from '@shopify/hydrogen';
import {getSessionUser} from './auth/session.js';
import {getCustomerBrandColors} from './admin/operations.js';
import {parseBrandColors} from './brand-colors.js';
import {GI_CATALOG_SEARCH_QUERY} from './giFragments.js';

/* Memo por request. El loader de root y el de la ruta corren en paralelo, así
   que sin esto cada página pagaría dos veces lo mismo. Va en un WeakMap y no
   como propiedad del contexto para no escribir sobre un objeto de Hydrogen; la
   entrada se recolecta con la request. */
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

const FACET_COLOR = 'filter.v.option.color';

async function leerPaleta(context) {
  const usuario = getSessionUser(context.session);
  if (!usuario?.gid) return null;

  let raw = null;
  try {
    raw = await context.withCache.run(
      {
        // La clave lleva el gid: dos clientes con paletas distintas nunca
        // comparten entrada. Es la caché de servidor, no la del navegador.
        cacheKey: ['gi-brand-colors', usuario.gid],
        cacheStrategy: CacheShort({maxAge: 300, staleWhileRevalidate: 300}),
        shouldCacheResult: (v) => v !== undefined,
      },
      () => getCustomerBrandColors(context.env, usuario.gid),
    );
  } catch (error) {
    // El catálogo no puede caerse porque el Admin API tenga un mal día.
    console.error('[brand-colors] no se pudo leer custom.colores:', error);
    return null;
  }

  if (!raw) return null;

  const families = parseBrandColors(raw);
  if (!families.length) {
    // Fail-open: alguien escribió "Pantone 186C" o un hexadecimal en el admin.
    // Vaciarle el catálogo al cliente sería un castigo desproporcionado por
    // una errata, pero tiene que quedar rastro para corregirla.
    console.warn(
      `[brand-colors] ningún valor reconocible en custom.colores de ${usuario.gid}: ${raw}`,
    );
    return null;
  }
  return {families, raw};
}

/**
 * La paleta de marca del cliente de esta request, o null si no hay restricción
 * que aplicar (sin sesión, sin gid, sin token de Admin, metafield vacío o
 * ilegible, o el Admin API caído).
 * @param {any} context contexto de Hydrogen
 * @returns {Promise<{families: string[], raw: string}|null>}
 */
export function getBrandColors(context) {
  return memo(context, 'brand', () => leerPaleta(context));
}

/**
 * Los tonos crudos de color que existen en la tienda ("ROJO", "AZUL MARINO",
 * "VERDE PISTACHO"…), de la faceta de color del catálogo completo.
 *
 * Hace falta porque expandir la familia "Rojo" a sus tonos exige saber cuáles
 * existen, y /collections/:handle y /search no tienen ninguna pre-consulta de
 * facetas de donde sacarlos. Cambia con el catálogo, no con el cliente: es una
 * sola entrada compartida, con CacheLong.
 *
 * Devuelve **null** en cuanto no se pudo leer —la consulta falló, la faceta no
 * vino, o vino sin un solo valor—, y nunca una lista vacía: quien lo consume
 * tiene que poder distinguir "no sé qué colores hay" de "sé que no hay
 * ninguno", porque llevan a decisiones opuestas (ver brandProductFilters).
 * @param {any} context
 * @returns {Promise<Array<{label: string, count: number}>|null>}
 */
export function getColorVocabulary(context) {
  return memo(context, 'vocabulario', async () => {
    let valores;
    try {
      const res = await context.storefront.query(GI_CATALOG_SEARCH_QUERY, {
        cache: CacheLong(),
        variables: {
          query: '*',
          productFilters: null,
          sortKey: 'RELEVANCE',
          reverse: false,
          first: 1,
        },
      });
      const facetas = res?.search?.productFilters || [];
      valores = (facetas.find((f) => f.id === FACET_COLOR)?.values || []).filter(
        (v) => v.count > 0,
      );
    } catch (error) {
      console.error('[brand-colors] no se pudo leer el vocabulario de color:', error);
      return null;
    }
    if (!valores.length) {
      // Esta tienda tiene ~100 tonos: cero es siempre el índice de búsqueda
      // degradado, no un catálogo sin colores. Medido el 2026-09-04 contra el
      // servidor de desarrollo: search(query:"*") devolvía totalCount 0 y cero
      // facetas mientras el catálogo respondía con normalidad por otras vías.
      console.error(
        '[brand-colors] la faceta de color llegó vacía: no se aplicará ninguna paleta de marca en esta request',
      );
      return null;
    }
    return valores;
  });
}
