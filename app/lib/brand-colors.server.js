/* Generando Ideas — resolución en servidor de la paleta de marca del cliente.
 *
 * Server-only: importa el cliente de Admin API. Las funciones puras que también
 * necesita el navegador viven en brand-colors.js.
 */
import {CacheLong, CacheShort} from '@shopify/hydrogen';
import {getSessionUser} from './auth/session.js';
import {getCustomerBrandColors} from './admin/operations.js';
import {parseBrandColors} from './brand-colors.js';

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

/* Consulta propia y mínima. Reusar GI_CATALOG_SEARCH_QUERY salía caro para
   nada: pedía totalCount, una página entera de `...GiProductCard` y las cinco
   facetas del catálogo, cuando de aquí sólo se usan los valores de una. */
const GI_COLOR_VOCABULARY_QUERY = `#graphql
  query GiColorVocabulary(
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    search(query: "*", types: PRODUCT, first: 1) {
      productFilters {
        id
        values { label count }
      }
    }
  }
`;

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
 * Quien lo pide tiene que comprobar antes que hay alguna familia que expandir:
 * sin paleta y sin colores elegidos no sirve para nada, y con la entrada de
 * CacheLong fría es una consulta íntegra delante de la real que pagaría todo
 * visitante anónimo.
 *
 * Devuelve **null** en cuanto no se pudo leer —la consulta falló, la faceta no
 * vino, o vino sin un solo valor—, y nunca una lista vacía: quien lo consume
 * tiene que poder distinguir "no sé qué colores hay" de "sé que no hay
 * ninguno", porque llevan a decisiones opuestas (ver brandProductFilters).
 * @param {any} context
 * @returns {Promise<Array<{label: string, count: number}>|null>}
 */
/* Las facetas del catálogo completo, una sola vez por request y con CacheLong:
   de aquí salen el vocabulario de color y el de técnica y talla. null si la
   consulta falló. */
function leerFacetas(context) {
  return memo(context, 'facetas', async () => {
    try {
      const res = await context.storefront.query(GI_COLOR_VOCABULARY_QUERY, {
        cache: CacheLong(),
      });
      return res?.search?.productFilters || [];
    } catch (error) {
      console.error('[brand-colors] no se pudo leer el vocabulario del catálogo:', error);
      return null;
    }
  });
}

/**
 * Valores crudos de una faceta en todo el catálogo ("GRABADO LÁSER-SERIGRAFÍA",
 * "EXTRA GRANDE"…), para expandir las técnicas y tallas genéricas. null si no
 * se pudo leer o vino vacía: quien lo consume no debe inventar filtros.
 * @param {any} context
 * @param {string} facetId p. ej. 'filter.v.option.talla'
 * @returns {Promise<Array<{label: string, count: number}>|null>}
 */
export async function getFacetValues(context, facetId) {
  const facetas = await leerFacetas(context);
  const valores = (facetas?.find((f) => f.id === facetId)?.values || []).filter((v) => v.count > 0);
  return valores.length ? valores : null;
}

export function getColorVocabulary(context) {
  return memo(context, 'vocabulario', async () => {
    const facetas = await leerFacetas(context);
    if (!facetas) return null;
    const valores = (facetas.find((f) => f.id === FACET_COLOR)?.values || []).filter(
      (v) => v.count > 0,
    );
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
