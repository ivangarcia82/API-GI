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

/** The most expensive surface group for a technique, used as the fallback when
 *  a product's material doesn't match any group. "Most expensive" = the group
 *  with the highest ceiling (max precioMaximo, which is the flat charge applied
 *  below the minimum quantity — the common case when quoting "from 1 piece");
 *  ties broken by the highest precioMinimo. Returns undefined for an unknown
 *  technique. Picking the priciest group guarantees we never under-quote. */
export function mostExpensiveSurfaceKey(technique) {
  const tk = resolveTechniqueKey(technique);
  const groups = tk ? PRICE_MATRIX[tk] : null;
  if (!groups) return undefined;
  let best;
  let bestMax = -Infinity;
  let bestMin = -Infinity;
  for (const key of Object.keys(groups)) {
    const rows = groups[key];
    const maxCeil = Math.max(...rows.map((r) => r.precioMaximo));
    const maxFloor = Math.max(...rows.map((r) => r.precioMinimo));
    if (maxCeil > bestMax || (maxCeil === bestMax && maxFloor > bestMin)) {
      best = key;
      bestMax = maxCeil;
      bestMin = maxFloor;
    }
  }
  return best;
}

/** Resolve a product surface to a PRICE_MATRIX group key for a technique.
 *  Exact membership wins; otherwise fall back to the most expensive group so a
 *  non-standard / missing material still produces a (conservative) quote.
 *  @returns {{key: string|undefined, fallback: boolean}} */
export function resolveSurfaceKey(technique, surface) {
  const tk = resolveTechniqueKey(technique);
  if (!tk) return {key: undefined, fallback: false};
  const exact = matchSurfaceKey(tk, surface);
  if (exact) return {key: exact, fallback: false};
  const fb = mostExpensiveSurfaceKey(tk);
  return {key: fb, fallback: Boolean(fb)};
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
  // Real store data is COMMA-separated ("Serigrafía, Grabado en láser, …").
  // The legacy Liquid used dashes; keep that as a fallback when no comma exists.
  const parts = raw.includes(',') ? raw.split(',') : raw.split('-');
  return parts.map((s) => s.trim()).filter(Boolean);
}

/* Store technique labels don't always match PRICE_MATRIX keys 1:1 (case/wording).
   Map known store labels (normalized uppercase) to the canonical matrix key. */
const TECHNIQUE_ALIASES = {
  'GRABADO EN LASER': 'GRABADO LÁSER',
  'GRABADO EN LÁSER': 'GRABADO LÁSER',
  'GRABADO LASER': 'GRABADO LÁSER',
};

/** Resolve a (possibly differently-cased/worded) technique label to a PRICE_MATRIX key,
 *  or null if it has no pricing entry yet. */
export function resolveTechniqueKey(technique) {
  if (PRICE_MATRIX[technique]) return technique; // exact
  const u = String(technique ?? '').trim().toUpperCase();
  if (TECHNIQUE_ALIASES[u]) return TECHNIQUE_ALIASES[u];
  return Object.keys(PRICE_MATRIX).find((k) => k.toUpperCase() === u) || null;
}

/** List of available measures (medida) for a technique + product surface.
 *  Falls back to the most expensive surface group when the material is unknown. */
export function getMeasures(technique, surface) {
  const tk = resolveTechniqueKey(technique);
  if (!tk) return [];
  const {key} = resolveSurfaceKey(tk, surface);
  return key ? PRICE_MATRIX[tk][key].map((op) => op.medida) : [];
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
  const tk = resolveTechniqueKey(technique);
  if (!tk) {
    return {error: `Tipo de decorado no encontrado: ${technique}`, totalPrice: 0, unitPrice: 0, neededQtyForMin: 0, isMinPriceUsed: false};
  }
  // Material that isn't in the matrix falls back to the most expensive group
  // (never under-quote); surfaceFallback flags it so the UI/quote can note it.
  const {key, fallback} = resolveSurfaceKey(tk, surface);
  if (!key) {
    return {error: `Superficie no encontrada: ${String(surface).toUpperCase()}`, totalPrice: 0, unitPrice: 0, neededQtyForMin: 0, isMinPriceUsed: false};
  }
  const op = PRICE_MATRIX[tk][key].find(
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
    surfaceUsed: key,
    surfaceFallback: fallback,
  };
}

/** Per-unit price including decoration, amortized over qty.
 *  ≡ (basePrice*qty + decorationTotal)/qty from the Liquid. */
export function effectiveUnitPrice(basePrice, decorationTotal, qty) {
  return basePrice + (qty > 0 ? decorationTotal / qty : 0);
}
