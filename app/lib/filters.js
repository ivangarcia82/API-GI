/* Generando Ideas — estado de filtros del catálogo.
 *
 * Todo lo que hay aquí es puro: traduce entre la URL, el estado de filtros y
 * los argumentos que espera `search` de la Storefront API. El motivo de que
 * viva fuera de la ruta es poder probarlo sin navegador ni red.
 *
 * Contexto de la API (verificado contra la tienda, ver el spec del 2026-08-04):
 *  - `products(query:)` acepta texto pero no facetas.
 *  - `collection.products(filters:)` acepta facetas pero no texto.
 *  - `search(query:, productFilters:)` acepta AMBOS: es el motor que usamos.
 *  - El filtro `tag` pasado como ProductFilter se IGNORA en silencio.
 *  - `tag:"..."` dentro de `query` TAMPOCO filtra: sólo pesa en la relevancia.
 *    Comprobado el 2026-08-31 producto a producto: con la categoría sola los
 *    24 primeros son correctos por casualidad, pero al añadir cualquier filtro
 *    que amplíe el conjunto (PLÁSTICO, color, disponibilidad) se cuelan hasta
 *    17 de 24 productos de otras categorías. Por eso la categoría ya NO viaja
 *    en `query`: se resuelve con `collection.products(filters:)`, que sí es
 *    estricto.
 *  - Filtros del mismo tipo se combinan con O; de tipos distintos, con Y.
 */

import {toListRange} from './pricing.js';

/* ------------------------------------------------------------------ *
 * Familias de color                                                   *
 * ------------------------------------------------------------------ */

/* La tienda tiene ~100 valores de color, muchos compuestos ("AZUL MARINO",
   "VERDE PISTACHO", "PLATA DAMA"). Mostrarlos todos es inusable, así que se
   agrupan en familias. La tabla mapea palabra clave → familia; la
   clasificación es por palabra completa para no confundir substrings. */
export const COLOR_FAMILIES = [
  {id: 'negro', label: 'Negro', hex: '#1a1a1a', keywords: ['negro', 'black']},
  {id: 'blanco', label: 'Blanco', hex: '#f5f5f0', keywords: ['blanco', 'white', 'hueso', 'marfil']},
  {id: 'gris', label: 'Gris', hex: '#8b8b8b', keywords: ['gris', 'grey', 'gray', 'jaspeado']},
  {id: 'plata', label: 'Plata', hex: '#c7cbd1', keywords: ['plata', 'plateado', 'silver', 'acero', 'aluminio']},
  {id: 'azul', label: 'Azul', hex: '#2563a8', keywords: ['azul', 'blue', 'marino', 'royal', 'turquesa', 'aqua', 'cyan']},
  {id: 'verde', label: 'Verde', hex: '#3f8f4a', keywords: ['verde', 'green', 'olivo', 'militar', 'menta', 'pistacho', 'lima']},
  {id: 'rojo', label: 'Rojo', hex: '#c2352c', keywords: ['rojo', 'red', 'vino', 'tinto', 'guinda', 'granate']},
  {id: 'naranja', label: 'Naranja', hex: '#e2762b', keywords: ['naranja', 'orange', 'durazno', 'coral']},
  {id: 'amarillo', label: 'Amarillo', hex: '#e8c33a', keywords: ['amarillo', 'yellow', 'oro', 'dorado', 'mostaza']},
  {id: 'rosa', label: 'Rosa', hex: '#d97fa4', keywords: ['rosa', 'pink', 'fucsia', 'magenta', 'palo']},
  {id: 'morado', label: 'Morado', hex: '#7a5ba6', keywords: ['morado', 'purple', 'lila', 'violeta', 'uva']},
  {id: 'cafe', label: 'Café', hex: '#8a6141', keywords: ['cafe', 'café', 'beige', 'camel', 'brown', 'arena', 'kraft', 'madera', 'chocolate']},
  {id: 'multicolor', label: 'Multicolor', hex: null, keywords: ['multicolor', 'arcoiris', 'surtido']},
];

const FAMILY_BY_KEYWORD = new Map();
for (const fam of COLOR_FAMILIES) {
  for (const kw of fam.keywords) FAMILY_BY_KEYWORD.set(normalize(kw), fam.id);
}

/** Minúsculas sin acentos, para comparar "CAFÉ" con "cafe". */
function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Familia a la que pertenece un valor crudo de color, o null si no es un
 * color reconocible — la faceta real incluye ruido como "7X4CM".
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function colorFamilyOf(value) {
  const norm = normalize(value);
  if (!norm) return null;
  // Se parte por separadores para que "AZUL/NEGRO" o "CAFE CLARO" se
  // clasifiquen por su primera palabra reconocible, no por coincidencia suelta.
  const words = norm.split(/[\s/\-_,.]+/).filter(Boolean);
  for (const w of words) {
    const family = FAMILY_BY_KEYWORD.get(w);
    if (family) return family;
  }
  return null;
}

/**
 * Agrupa los valores que devuelve la faceta de color en familias, sumando sus
 * conteos y quedándose con los tonos crudos de cada una (los que luego se
 * expanden a un OR de filtros).
 * @param {Array<{label: string, count: number}>|null} facetValues
 * @returns {Array<{family: string, label: string, hex: string|null, count: number, values: string[]}>}
 */
export function groupColorValues(facetValues) {
  if (!facetValues?.length) return [];
  const byFamily = new Map();
  for (const v of facetValues) {
    const family = colorFamilyOf(v.label);
    if (!family) continue; // ruido de la faceta
    const acc = byFamily.get(family) || {count: 0, values: []};
    acc.count += v.count || 0;
    acc.values.push(v.label);
    byFamily.set(family, acc);
  }
  return COLOR_FAMILIES.filter((f) => byFamily.has(f.id))
    .map((f) => ({
      family: f.id,
      label: f.label,
      hex: f.hex,
      count: byFamily.get(f.id).count,
      values: byFamily.get(f.id).values,
    }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------ *
 * Técnicas y tallas genéricas                                         *
 * ------------------------------------------------------------------ */

const sinAcentos = (s) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

/* El metafield `tecnicas_de_impresion` guarda la combinación completa
   ("GRABADO LÁSER-SERIGRAFÍA"), así que la faceta ofrecía 57 opciones que en
   realidad son 6 técnicas. Se ofrecen las 6 y cada una se expande a todas las
   combinaciones que la incluyen. Medido el 2026-10-05: no hay otras. */
export const TECNICAS_GENERICAS = [
  {id: 'serigrafia', label: 'Serigrafía', re: /SERIGRAF/},
  {id: 'grabado-laser', label: 'Grabado láser', re: /GRABADO/},
  {id: 'full-color', label: 'Full color', re: /FULL COLOR/},
  {id: 'bordado', label: 'Bordado', re: /BORDADO/},
  {id: 'sublimacion', label: 'Sublimación', re: /SUBLIMA/},
  {id: 'gota-de-resina', label: 'Gota de resina', re: /RESINA/},
];

/* La opción "talla" trae el mismo tamaño escrito de muchas formas (CH, SMALL,
   CHICA; XG, XL, EXTRA GRANDE; hasta "AZUL 3XL"). `orden` es el de la talla;
   la lista va en el orden en que se prueban las reglas: primero las más
   específicas, para que "EXTRA GRANDE" no caiga en G ni "EXTRA CHICA" en CH. */
export const TALLAS_GENERICAS = [
  {id: '4xg', label: '4XG', orden: 8, re: /\b4XL?\b|XXXXL/},
  {id: '3xg', label: '3XG', orden: 7, re: /\b3XL?\b|XXXL/},
  {id: '2xg', label: '2XG', orden: 6, re: /\b2XL?\b|\bXXL\b|EXTRA EXTRA GRANDE/},
  {id: 'xg', label: 'XG', orden: 5, re: /\bXG\b|\bXL\b|EXTRA GRANDE|EXTRA LARGE/},
  {id: 'xch', label: 'XCH', orden: 1, re: /\bXS\b|\bXC\b|\bXCH\b|EXTRA CHICA|EXTRA SMALL/},
  {id: 'ch', label: 'CH', orden: 2, re: /\bCH\b|CHICA|SMALL|\bS\b/},
  {id: 'm', label: 'M', orden: 3, re: /\bMD\b|MEDIUM|MEDIANA|\bM\b/},
  {id: 'g', label: 'G', orden: 4, re: /\bGD\b|GRANDE|LARGE|\bL\b/},
  {id: 'unitalla', label: 'Unitalla', orden: 9, re: /UNITALLA|\bUNICA\b/},
];

/**
 * Valores crudos de una faceta agrupados en opciones genéricas. Un valor puede
 * caer en varias (una combinación de técnicas) o en una sola (`exclusivo`, las
 * tallas). Lo que no reconoce ninguna regla no se ofrece.
 * @returns {Array<{id: string, label: string, count: number, values: string[]}>}
 */
function agrupar(facetValues, genericos, exclusivo) {
  if (!facetValues?.length) return [];
  const acc = new Map();
  for (const v of facetValues) {
    const texto = sinAcentos(v.label);
    const tocados = exclusivo
      ? [genericos.find((g) => g.re.test(texto))].filter(Boolean)
      : genericos.filter((g) => g.re.test(texto));
    for (const g of tocados) {
      const a = acc.get(g.id) || {count: 0, values: []};
      a.count += v.count || 0;
      a.values.push(v.label);
      acc.set(g.id, a);
    }
  }
  return genericos
    .filter((g) => acc.has(g.id))
    .map((g) => ({id: g.id, label: g.label, orden: g.orden, ...acc.get(g.id)}));
}

const sinOrden = ({id, label, count, values}) => ({id, label, count, values});

/** Técnicas de la faceta, de la más usada a la menos. */
export function groupTechniqueValues(facetValues) {
  return agrupar(facetValues, TECNICAS_GENERICAS, false)
    .sort((a, b) => b.count - a.count)
    .map(sinOrden);
}

/** Tallas de la faceta, de la más chica a la más grande. */
export function groupSizeValues(facetValues) {
  return agrupar(facetValues, TALLAS_GENERICAS, true)
    .sort((a, b) => a.orden - b.orden)
    .map(sinOrden);
}

/* ------------------------------------------------------------------ *
 * Ordenación                                                          *
 * ------------------------------------------------------------------ */

/* `SearchSortKeys` sólo expone RELEVANCE y PRICE — no hay equivalente de
   BEST_SELLING ni CREATED_AT. "Novedades" y "Ofertas" se ofrecen como filtros
   por tag en su lugar. */
/* `short` es para la barra fija de móvil, donde el botón comparte una fila de
   375px con el de filtros: "Precio: menor a mayor" no cabe, y recortar `label`
   por el ":" dejaría los dos criterios de precio indistinguibles. */
export const SORTS = {
  relevance: {label: 'Relevancia', short: 'Relevancia', sortKey: 'RELEVANCE', reverse: false},
  'price-asc': {label: 'Precio: menor a mayor', short: 'Precio ↑', sortKey: 'PRICE', reverse: false},
  'price-desc': {label: 'Precio: mayor a menor', short: 'Precio ↓', sortKey: 'PRICE', reverse: true},
};

/* ------------------------------------------------------------------ *
 * URL ↔ estado                                                        *
 * ------------------------------------------------------------------ */

const MULTI = ['color', 'material', 'tecnica', 'talla'];

function readMulti(params, key) {
  return (params.get(key) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function readNumber(params, key) {
  const raw = params.get(key);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lee el estado completo de filtros desde los parámetros de la URL.
 * @param {URLSearchParams} params
 */
export function parseFilterParams(params) {
  const sort = params.get('sort');
  return {
    q: params.get('q') || '',
    cat: params.get('cat') || '',
    color: readMulti(params, 'color'),
    material: readMulti(params, 'material'),
    tecnica: readMulti(params, 'tecnica'),
    talla: readMulti(params, 'talla'),
    precioMin: readNumber(params, 'precioMin'),
    precioMax: readNumber(params, 'precioMax'),
    soloDisponibles: params.get('disp') === '1',
    nuevos: params.get('nuevos') === '1',
    ofertas: params.get('ofertas') === '1',
    sort: SORTS[sort] ? sort : 'relevance',
  };
}

/** Vuelca el estado a URLSearchParams, omitiendo lo que está en su valor por defecto. */
export function toSearchParams(filters) {
  const p = new URLSearchParams();
  if (filters.q) p.set('q', filters.q);
  if (filters.cat) p.set('cat', filters.cat);
  for (const key of MULTI) {
    if (filters[key]?.length) p.set(key, filters[key].join(','));
  }
  if (filters.precioMin != null) p.set('precioMin', String(filters.precioMin));
  if (filters.precioMax != null) p.set('precioMax', String(filters.precioMax));
  if (filters.soloDisponibles) p.set('disp', '1');
  if (filters.nuevos) p.set('nuevos', '1');
  if (filters.ofertas) p.set('ofertas', '1');
  if (filters.sort && filters.sort !== 'relevance') p.set('sort', filters.sort);
  return p;
}

/** Añade o quita un valor de una lista multivalor. */
export function toggleMulti(list, value) {
  const arr = list || [];
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

/** ¿Hay algo aplicado más allá del orden? */
export function hasActiveFilters(f) {
  return Boolean(
    f.q ||
      f.cat ||
      f.color?.length ||
      f.material?.length ||
      f.tecnica?.length ||
      f.talla?.length ||
      f.precioMin != null ||
      f.precioMax != null ||
      f.soloDisponibles ||
      f.nuevos ||
      f.ofertas,
  );
}

/* ------------------------------------------------------------------ *
 * Construcción de la consulta                                         *
 * ------------------------------------------------------------------ */

/** Los handles de colección son con guiones; los tags, con espacios. */
function handleToTag(handle) {
  return String(handle || '').replace(/-/g, ' ');
}

/**
 * Cadena de búsqueda para `search(query:)`.
 *
 * La categoría y los accesos rápidos van aquí como `tag:"..."` y no en
 * `productFilters` porque ahí el filtro `tag` se ignora en silencio (un tag
 * inexistente devuelve el resultado sin filtrar).
 */
export function buildSearchQuery({q = ''} = {}) {
  // Sólo el texto libre. Categoría, Novedades y Ofertas NO viajan aquí: como
  // `tag:"..."` no filtra, prometerlas desde la búsqueda era mentir. Las tres
  // se resuelven por colección — ver resolveCatalogSource.
  // Las comillas del usuario romperían cualquier sintaxis que añadiéramos.
  const texto = String(q ?? '').trim().replace(/"/g, '\\"');
  // `*` recupera el catálogo completo y respeta igualmente los productFilters.
  return texto || '*';
}

/* Categoría, Novedades y Ofertas son las tres COLECCIONES de la tienda, y sólo
   se puede consultar una por carga. El orden marca cuál gana cuando el usuario
   pide varias: la categoría expresa la intención más concreta; los otros dos
   son accesos rápidos. */
const COLECCIONES = [
  {clave: 'cat', handle: (f) => f.cat},
  {clave: 'nuevos', handle: () => 'nuevos'},
  {clave: 'ofertas', handle: () => 'ofertas'},
];

/**
 * De dónde salen los productos de esta carga.
 *
 * `collection.products(filters:)` filtra de verdad, pero NO acepta texto libre;
 * `search` acepta texto pero no sabe filtrar por colección — `tag:"..."` dentro
 * de la consulta sólo pesa en la relevancia. No se pueden combinar, así que hay
 * una jerarquía: si hay texto manda la búsqueda; si no, manda la primera
 * colección pedida. `appliedFilters` borra las que no se aplican para que la
 * pantalla nunca prometa un filtro que la consulta no está aplicando.
 *
 * @param {object} filters
 * @returns {{modo: 'coleccion', handle: string, clave: string} | {modo: 'busqueda'}}
 */
export function resolveCatalogSource(filters) {
  if (filters.q) return {modo: 'busqueda'};
  for (const c of COLECCIONES) {
    if (filters[c.clave]) return {modo: 'coleccion', handle: c.handle(filters), clave: c.clave};
  }
  return {modo: 'busqueda'};
}

/**
 * Los filtros tal como se están aplicando de verdad, para pintar los chips.
 * Todo lo que se pidió y no cupo se borra en vez de quedarse mintiendo.
 * @param {object} filters
 */
export function appliedFilters(filters) {
  const fuente = resolveCatalogSource(filters);
  const out = {...filters};
  for (const c of COLECCIONES) {
    if (fuente.modo === 'coleccion' && c.clave === fuente.clave) continue;
    out[c.clave] = c.clave === 'cat' ? '' : false;
  }
  return out;
}

/* Un cliente con paleta de marca no puede acabar en "no filtro nada": eso le
   enseñaría el catálogo entero, lo contrario de lo prometido. Cuando su paleta
   no tiene ningún tono en la tienda, se filtra por un valor imposible para que
   la respuesta sea 0 productos, que es la verdad. */
export const SIN_COINCIDENCIA = {
  variantOption: {name: 'color', value: 'GI-SIN-COINCIDENCIA'},
};

/**
 * Array de `ProductFilter` para `search(productFilters:)`.
 *
 * Cada familia de color se expande a un filtro por tono: al ser todos del
 * mismo tipo, la API los combina con O, que es justo lo que significa "quiero
 * los verdes". Los tipos distintos (precio, disponibilidad…) se cruzan con Y.
 *
 * @param {object} filters estado leído de la URL
 * @param {Array<{family: string, values: string[]}>} colorFamilies familias
 *   presentes en el resultado actual, de `groupColorValues`
 * @param {{colorObligatorio?: boolean, margin?: number|null}} [opciones] `margin`
 *   es el margen del cliente; traduce el rango de precio a precio de lista
 */
export function buildProductFilters(
  filters,
  colorFamilies = [],
  {colorObligatorio = false, margin = null, tecnicas = [], tallas = []} = {},
) {
  const out = [];

  let tonosDeColor = 0;
  for (const familyId of filters.color || []) {
    const fam = colorFamilies.find((f) => f.family === familyId);
    // Una familia que no está en el resultado actual no aporta ningún tono:
    // añadir un filtro inventado vaciaría la búsqueda en vez de no filtrar.
    if (!fam) continue;
    for (const value of fam.values) {
      out.push({variantOption: {name: 'color', value}});
      tonosDeColor += 1;
    }
  }
  if (colorObligatorio && tonosDeColor === 0) out.push(SIN_COINCIDENCIA);

  // Cada talla y técnica genérica se expande a sus valores crudos (semántica O
  // entre ellos). Sin vocabulario no se puede expandir y no se inventa nada.
  for (const id of filters.talla || []) {
    for (const value of tallas.find((t) => t.id === id)?.values || []) {
      out.push({variantOption: {name: 'talla', value}});
    }
  }

  for (const value of filters.material || []) {
    out.push({productMetafield: {namespace: 'custom', key: 'material', value}});
  }

  for (const id of filters.tecnica || []) {
    for (const value of tecnicas.find((t) => t.id === id)?.values || []) {
      out.push({productMetafield: {namespace: 'custom', key: 'tecnicas_de_impresion', value}});
    }
  }

  if (filters.precioMin != null || filters.precioMax != null) {
    /* El cliente escribe el rango en SU precio; Shopify sólo sabe filtrar por
       el de lista. Como la lista es costo / 0.30 en casi todo el catálogo, su
       precio es proporcional al de lista y basta con convertir el rango. Sin
       margen, toListRange lo deja igual. */
    const rango = toListRange({min: filters.precioMin, max: filters.precioMax}, margin);
    const price = {};
    if (rango.min != null) price.min = rango.min;
    if (rango.max != null) price.max = rango.max;
    out.push({price});
  }

  if (filters.soloDisponibles) out.push({available: true});

  return out.length ? out : null;
}

/* ------------------------------------------------------------------ *
 * Chips de filtros aplicados                                          *
 * ------------------------------------------------------------------ */

const money = (n) => `$${Number(n).toLocaleString('es-MX')}`;

/**
 * Describe lo aplicado para pintarlo como chips con su botón de quitar.
 * @param {object} filters
 * @param {{categorias?: Array<{handle: string, name: string}>}} ctx
 * @returns {Array<{key: string, label: string, group: string, value?: string}>}
 */
export function activeChips(filters, ctx = {}) {
  const chips = [];
  const categorias = ctx.categorias || [];

  if (filters.q) chips.push({key: 'q', group: 'q', label: `“${filters.q}”`});

  if (filters.cat) {
    const found = categorias.find((c) => c.handle === filters.cat);
    chips.push({key: 'cat', group: 'cat', label: found?.name || handleToTag(filters.cat)});
  }

  for (const familyId of filters.color || []) {
    const fam = COLOR_FAMILIES.find((f) => f.id === familyId);
    chips.push({
      key: `color:${familyId}`,
      group: 'color',
      value: familyId,
      label: fam?.label || familyId,
    });
  }

  for (const [group, values] of [
    ['material', filters.material],
    ['tecnica', filters.tecnica],
    ['talla', filters.talla],
  ]) {
    // Técnica y talla viajan como id genérico ("grabado-laser"); el chip
    // enseña su nombre. Material sigue siendo el valor tal cual.
    const genericos = group === 'tecnica' ? TECNICAS_GENERICAS : group === 'talla' ? TALLAS_GENERICAS : [];
    for (const value of values || []) {
      const label = genericos.find((g) => g.id === value)?.label ?? value;
      chips.push({key: `${group}:${value}`, group, value, label});
    }
  }

  if (filters.precioMin != null || filters.precioMax != null) {
    const {precioMin: min, precioMax: max} = filters;
    const label =
      min != null && max != null
        ? `${money(min)} – ${money(max)}`
        : max != null
          ? `Hasta ${money(max)}`
          : `Desde ${money(min)}`;
    chips.push({key: 'precio', group: 'precio', label});
  }

  if (filters.soloDisponibles) chips.push({key: 'disp', group: 'disp', label: 'En existencia'});
  if (filters.nuevos) chips.push({key: 'nuevos', group: 'nuevos', label: 'Novedades'});
  if (filters.ofertas) chips.push({key: 'ofertas', group: 'ofertas', label: 'Ofertas'});

  return chips;
}
