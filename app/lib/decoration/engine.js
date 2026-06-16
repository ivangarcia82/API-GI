/* Generando Ideas — pure decoration price engine.
   Faithful port of matrizPrecios + helpers from scripthhglobal.liquid.
   PURE: no DOM, no I/O, no import.meta.env. Safe in Node (Vitest) and workerd. */

/** matrizPrecios EXACT from scripthhglobal.liquid — keys with accents/case identical. */
export const PRICE_MATRIX = {
  'SERIGRAFÍA': {
    'ACERO / METAL / MADERA / PLÁSTICO': [
      {medida: '4 x 4', precioMinimo: 1, precioMaximo: 1641.8, cantidadMinima: 1000},
      {medida: '10 X 10', precioMinimo: 2.1, precioMaximo: 1641.8, cantidadMinima: 500},
      {medida: '15 x 15', precioMinimo: 2.1, precioMaximo: 1641.8, cantidadMinima: 500},
    ],
    'TEXTIL': [
      {medida: '4 x 4', precioMinimo: 3.33, precioMaximo: 1641.8, cantidadMinima: 300},
      {medida: '10 x 10', precioMinimo: 3.33, precioMaximo: 1641.8, cantidadMinima: 300},
      {medida: '18 x 18', precioMinimo: 3.33, precioMaximo: 1641.8, cantidadMinima: 300},
    ],
    'RUBBER / VIDRIO': [
      {medida: '4 x 4', precioMinimo: 3.6, precioMaximo: 2686.56, cantidadMinima: 500},
      {medida: '10 x 10', precioMinimo: 3.6, precioMaximo: 2686.56, cantidadMinima: 500},
      {medida: '18 x 18', precioMinimo: 3.6, precioMaximo: 2686.56, cantidadMinima: 500},
    ],
    'TRANSFER': [
      {medida: '4 x 4', precioMinimo: 4, precioMaximo: 1791.04, cantidadMinima: 300},
      {medida: '10 x 10', precioMinimo: 4, precioMaximo: 1791.04, cantidadMinima: 300},
      {medida: '18 x 18', precioMinimo: 4, precioMaximo: 1791.04, cantidadMinima: 300},
    ],
  },
  'BORDADO': {
    'TEXTIL': [
      {medida: '8 x 8', precioMinimo: 18, precioMaximo: 59.7, cantidadMinima: 50},
      {medida: '20 x 10', precioMinimo: 30, precioMaximo: 89.55, cantidadMinima: 50},
    ],
  },
  'PARCHE SUBLIMADO': {
    'TEXTIL': [
      {medida: '8 x 8', precioMinimo: 40, precioMaximo: 89.55, cantidadMinima: 50},
    ],
  },
  'VINIL IMPRIMIBLE Y DTF': {
    'TEXTIL / PLASTICO / MADERA / METAL': [
      {medida: '9 x 9', precioMinimo: 15, precioMaximo: 22.38, cantidadMinima: 1},
      {medida: '18 x 18', precioMinimo: 30, precioMaximo: 44.77, cantidadMinima: 1},
      {medida: '28 x 28', precioMinimo: 80, precioMaximo: 119.4, cantidadMinima: 1},
    ],
  },
  'IMPRESIÓN UV PLANA FULL COLOR': {
    'TEXTIL / PLASTICO / MADERA / METAL': [
      {medida: '9 x 9', precioMinimo: 15, precioMaximo: 22.38, cantidadMinima: 1},
      {medida: '18 x 18', precioMinimo: 30, precioMaximo: 44.77, cantidadMinima: 1},
      {medida: '28 x 28', precioMinimo: 60, precioMaximo: 89.5, cantidadMinima: 1},
    ],
  },
  'IMPRESIÓN 360° FULL COLOR': {
    'TEXTIL / PLASTICO / MADERA / METAL': [
      {medida: 'MEDIDAS en CM', precioMinimo: 30, precioMaximo: 52.23, cantidadMinima: 50},
    ],
  },
  'SUBLIMACION': {
    'TEXTIL / CERAMICA / ACERO': [
      {medida: 'MEDIDAS en CM', precioMinimo: 20, precioMaximo: 29.85, cantidadMinima: 1},
    ],
  },
  'GRABADO LÁSER': {
    'MADERA / METAL / VIDRIO': [
      {medida: '5 x 5', precioMinimo: 5, precioMaximo: 7.46, cantidadMinima: 1},
      {medida: '10 x 10', precioMinimo: 7, precioMaximo: 10.44, cantidadMinima: 1},
      {medida: '13 x 13', precioMinimo: 10, precioMaximo: 14.92, cantidadMinima: 1},
      {medida: 'Rotativo', precioMinimo: 15, precioMaximo: 22.38, cantidadMinima: 1},
      {medida: 'Personalizado', precioMinimo: 12, precioMaximo: 17.91, cantidadMinima: 1},
      {medida: '14 x 21', precioMinimo: 20, precioMaximo: 20.85, cantidadMinima: 1},
    ],
  },
  'GOTA DE RESINA': {
    'PLASTICO / METAL': [
      {medida: '2 x 2', precioMinimo: 3, precioMaximo: 4.47, cantidadMinima: 1},
      {medida: '3 x 3', precioMinimo: 6, precioMaximo: 8.95, cantidadMinima: 1},
      {medida: '5 x 5', precioMinimo: 12, precioMaximo: 17.91, cantidadMinima: 1},
    ],
  },
};

/** Shared surface-match routine (Liquid: s.split(" / ").includes(superficie.toUpperCase())).
 *  EXACT membership in the key split on " / ", not a substring match. */
function matchSurfaceKey(technique, surface) {
  const sf = String(surface).toUpperCase();
  return Object.keys(PRICE_MATRIX[technique] || {}).find((k) =>
    k.split(' / ').includes(sf),
  );
}

/** Parse the custom.tecnicas_de_impresion metafield value.
 *  Accepts a JSON-array string (list.single_line_text_field) OR a dash-delimited string. */
export function getTechniques(metafieldValue) {
  const raw = String(metafieldValue ?? '').trim();
  if (raw.startsWith('[')) {
    try {
      return JSON.parse(raw)
        .map((s) => String(s).trim())
        .filter(Boolean);
    } catch {
      /* fall through to dash split */
    }
  }
  return raw
    .split('-')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** List of available measures (medida) for a technique + product surface. */
export function getMeasures(technique, surface) {
  const key = matchSurfaceKey(technique, surface);
  return key ? PRICE_MATRIX[technique][key].map((op) => op.medida) : [];
}

/** round2(n) = Math.round(n * 100) / 100 */
export function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Decoration cost detail for a technique/surface/qty/size selection.
 *  "Sin decorado" short-circuits to total 0. qty>=min ⇒ (qty*precioMinimo)/0.67;
 *  qty<min ⇒ flat precioMaximo (setup/cliché charge). */
export function calcDecoration(technique, surface, qty, size) {
  if (technique === 'Sin decorado') {
    return {error: null, totalPrice: 0, unitPrice: 0, neededQtyForMin: 0, isMinPriceUsed: false};
  }
  if (!PRICE_MATRIX[technique]) {
    return {error: `Tipo de decorado no encontrado: ${technique}`, totalPrice: 0, unitPrice: 0, neededQtyForMin: 0, isMinPriceUsed: false};
  }
  const key = matchSurfaceKey(technique, surface);
  if (!key) {
    return {error: `Superficie no encontrada: ${String(surface).toUpperCase()}`, totalPrice: 0, unitPrice: 0, neededQtyForMin: 0, isMinPriceUsed: false};
  }
  const op = PRICE_MATRIX[technique][key].find(
    (o) => o.medida.toLowerCase() === String(size).toLowerCase(),
  );
  if (!op) {
    return {error: `Medida no encontrada: ${size}`, totalPrice: 0, unitPrice: 0, neededQtyForMin: 0, isMinPriceUsed: false};
  }
  const min = op.cantidadMinima;
  const totalPrice = qty >= min ? (qty * op.precioMinimo) / 0.67 : op.precioMaximo;
  return {
    error: null,
    totalPrice,
    unitPrice: qty > 0 ? totalPrice / qty : 0,
    neededQtyForMin: min,
    isMinPriceUsed: qty >= min,
  };
}

/** Per-unit price including decoration, amortized over qty.
 *  ≡ (basePrice*qty + decorationTotal)/qty from the Liquid. */
export function effectiveUnitPrice(basePrice, decorationTotal, qty) {
  return basePrice + (qty > 0 ? decorationTotal / qty : 0);
}
