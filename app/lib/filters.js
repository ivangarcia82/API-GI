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
 *  - El filtro `tag` pasado como ProductFilter se IGNORA en silencio, así que
 *    la categoría viaja dentro de `query` como `tag:"..."`.
 *  - Filtros del mismo tipo se combinan con O; de tipos distintos, con Y.
 */

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
export function buildSearchQuery({q = '', cat = '', nuevos = false, ofertas = false} = {}) {
  const partes = [];
  // Las comillas del usuario romperían la sintaxis `tag:"..."` que añadimos.
  if (q) partes.push(q.replace(/"/g, '\\"'));
  if (cat) partes.push(`tag:"${handleToTag(cat)}"`);
  if (nuevos) partes.push('tag:"nuevo"');
  if (ofertas) partes.push('tag:"oferta"');
  // `*` recupera el catálogo completo y respeta igualmente los productFilters.
  return partes.length ? partes.join(' AND ') : '*';
}

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
 */
export function buildProductFilters(filters, colorFamilies = []) {
  const out = [];

  for (const familyId of filters.color || []) {
    const fam = colorFamilies.find((f) => f.family === familyId);
    // Una familia que no está en el resultado actual no aporta ningún tono:
    // añadir un filtro inventado vaciaría la búsqueda en vez de no filtrar.
    if (!fam) continue;
    for (const value of fam.values) {
      out.push({variantOption: {name: 'color', value}});
    }
  }

  for (const value of filters.talla || []) {
    out.push({variantOption: {name: 'talla', value}});
  }

  for (const value of filters.material || []) {
    out.push({productMetafield: {namespace: 'custom', key: 'material', value}});
  }

  for (const value of filters.tecnica || []) {
    out.push({productMetafield: {namespace: 'custom', key: 'tecnicas_de_impresion', value}});
  }

  if (filters.precioMin != null || filters.precioMax != null) {
    const price = {};
    if (filters.precioMin != null) price.min = filters.precioMin;
    if (filters.precioMax != null) price.max = filters.precioMax;
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
    for (const value of values || []) {
      chips.push({key: `${group}:${value}`, group, value, label: value});
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
