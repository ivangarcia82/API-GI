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

/** ¿Este texto representa "cero" en alguna de sus formas? */
function esCero(texto) {
  const s = texto.trim();
  if (!s) return true;

  // Un único número igual a cero, con o sin unidad: "0", "0.0", "0,00", "0 cm".
  if (/^0+([.,]0+)?\s*[a-z"'´]*$/i.test(s)) return true;

  // Medidas donde TODOS los componentes son cero: "0x0x0", "0 × 0", "0x0x0 cm".
  // Se exige que todos lo sean para no descartar "10x0x5", que sí es una
  // medida real con un componente plano.
  const partes = s.split(/\s*[x×*]\s*/i);
  if (partes.length > 1) {
    const numeros = partes.map((p) => p.replace(/[^\d.,]/g, '')).filter(Boolean);
    if (numeros.length === partes.length && numeros.every((n) => parseFloat(n.replace(',', '.')) === 0)) {
      return true;
    }
  }

  return false;
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
  if (esCero(texto)) return null;

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
