/* Generando Ideas — ficha técnica de la PDP a partir de metafields.
 *
 * Regla de negocio del cliente: un campo vacío o en cero no se enseña. En vez
 * de una fila con "0x0x0" o un guion, la fila desaparece.
 *
 * El formateo es defensivo a propósito: según cómo esté definido el metafield
 * en Shopify, el mismo dato llega como texto plano ("8 x 8 x 21 cm"), como
 * JSON de tipo `dimension` ({"value":21,"unit":"CENTIMETERS"}) o como lista
 * JSON. Se cubren los tres para que un cambio de tipo en el admin no vacíe la
 * ficha sin avisar.
 */

/** Campos que componen la ficha, en el orden en que se pintan. */
const SPEC_FIELDS = [
  {key: 'material_front', label: 'Material'},
  {key: 'medidas', label: 'Medidas'},
  {key: 'area_de_impresion', label: 'Área de impresión'},
];

const SIN_DATO = new Set(['n/a', 'na', 'n.a.', '-', '--', '---', 'sin dato', 'sin datos']);

const UNIDADES = {
  CENTIMETERS: 'cm',
  MILLIMETERS: 'mm',
  METERS: 'm',
  INCHES: 'in',
  FEET: 'ft',
  YARDS: 'yd',
};

/** ¿Este texto es un único número igual a cero? ("0", "0.0", "0,00", "0 cm") */
function esCeroSimple(texto) {
  return /^0+([.,]0+)?\s*[a-z"'´]*$/i.test(texto.trim());
}

/**
 * Recorta de una medida los componentes que valen cero.
 *
 * Casi un tercio del catálogo son cilindros que el admin captura como
 * "alto x diámetro x 0": la tercera dimensión no aplica y mostrarla como
 * "22.5 x 7.7 x 0 cm" se lee como un dato roto. Al recortar queda
 * "22.5 x 7.7 cm", que es la medida real.
 *
 * Devuelve null si al quitar los ceros no queda ninguna medida (el "0x0x0"
 * que pidió ocultar el cliente), y el texto intacto si no es una lista de
 * medidas —"4 x 15 cm / 4 x 8 cm" son dos áreas alternativas, no una sola.
 *
 * @param {string} texto
 * @returns {string|null|undefined} undefined si no aplica y hay que seguir
 */
function recortarCeros(texto) {
  // Sólo se procesan cadenas de la forma "n x n [x n] [unidad]". Cualquier
  // otra cosa (barras, texto libre) se deja intacta.
  const m = texto.trim().match(/^([\d.,\s]+(?:[x×*][\d.,\s]+)+)\s*([a-z"'´]*)$/i);
  if (!m) return undefined;

  const separador = texto.match(/\s*[x×*]\s*/i)[0];
  const unidad = m[2] ? ` ${m[2]}` : '';
  const componentes = m[1]
    .split(/\s*[x×*]\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const utiles = componentes.filter((p) => parseFloat(p.replace(',', '.')) !== 0);
  if (!utiles.length) return null; // era 0x0x0
  if (utiles.length === componentes.length) return undefined; // no había ceros

  return `${utiles.join(separador)}${unidad}`.trim();
}

/**
 * Normaliza el valor de un metafield para mostrarlo, o devuelve null si no hay
 * nada que enseñar (vacío, cero, medidas en cero o marcador de "sin dato").
 *
 * @param {string|number|null|undefined} raw
 * @returns {string|null}
 */
export function formatSpecValue(raw) {
  if (raw == null) return null;

  if (typeof raw === 'number') {
    return raw === 0 ? null : String(raw);
  }

  const texto = String(raw).trim();
  if (!texto) return null;

  // Metafields de tipo `dimension` y listas llegan serializados en JSON.
  if (texto.startsWith('{') || texto.startsWith('[')) {
    let dato;
    try {
      dato = JSON.parse(texto);
    } catch {
      // No era JSON válido: se trata como texto normal más abajo.
      dato = null;
    }

    if (Array.isArray(dato)) {
      const items = dato.map((d) => formatSpecValue(d)).filter(Boolean);
      return items.length ? items.join(' · ') : null;
    }

    if (dato && typeof dato === 'object' && 'value' in dato) {
      const n = parseFloat(dato.value);
      if (!Number.isFinite(n) || n === 0) return null;
      const unidad = UNIDADES[dato.unit] || '';
      return unidad ? `${n} ${unidad}` : String(n);
    }
  }

  if (SIN_DATO.has(texto.toLowerCase())) return null;
  if (esCeroSimple(texto)) return null;

  const recortado = recortarCeros(texto);
  if (recortado !== undefined) return recortado; // null = todo era cero

  return texto;
}

/** Lee un metafield `custom.<key>` de un producto de la Storefront API. */
function leer(product, key) {
  const lista = product?.metafields || [];
  // La API devuelve null en las posiciones de los identificadores no hallados.
  return lista.find((m) => m && m.namespace === 'custom' && m.key === key)?.value ?? null;
}

/**
 * Filas de la ficha técnica de un producto, ya filtradas: sólo las que tienen
 * un valor que merezca pintarse.
 *
 * @param {{metafields?: Array<{namespace: string, key: string, value: string}|null>}|null} product
 * @returns {Array<{label: string, value: string}>}
 */
export function buildProductSpecs(product) {
  return SPEC_FIELDS.map(({key, label}) => {
    const value = formatSpecValue(leer(product, key));
    return value ? {label, value} : null;
  }).filter(Boolean);
}
