# Phase 5: Motor de precios de decorado Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL — superpowers:test-driven-development. Follow strict RED→GREEN→REFACTOR. Write the failing test first, run it, watch it fail, then write the minimal implementation, run it, watch it pass, then commit. Never write implementation before a failing test exists.

## Goal

Port the legacy `scripthhglobal.liquid` decoration price engine into a pure, testable JS module `app/lib/decoration/engine.js`, byte-for-byte faithful to the original `matrizPrecios` (accents and casing identical). Surface decoration metafields (`custom.tecnicas_de_impresion`, `custom.superficie`) through the Storefront fragments and `normalizeProduct`, and render an integrated single-unit price in a `DecorationSelector.jsx` PDP component. Prices are display-only in the client; the server is the authority (Phase 4 recompute rule), but the same pure engine is reused on both sides.

## Architecture

```
Storefront API (metafields)
  └─ giFragments.js / products.$handle.jsx  → metafields(identifiers:[tecnicas_de_impresion, superficie])
         └─ normalizeProduct (gi.js)         → product.techniques (string[]) + product.surface (raw string)
                └─ DecorationSelector.jsx (PDP, client) → onChange({technique, surface, size, qty})
                       └─ app/lib/decoration/engine.js  (PURE, no I/O)
                              PRICE_MATRIX, getTechniques, getMeasures,
                              calcDecoration, effectiveUnitPrice, round2
```

- `engine.js` is PURE: no DOM, no fetch, no `import.meta.env`. Runs identically under Node (Vitest) and workerd.
- The legacy function `calcularPrecioDecoradoConDetalle` becomes `calcDecoration`; `obtenerMedidasPorTipoYSuperficie` becomes `getMeasures`; the surface-match routine (`s.split(" / ").includes(superficieFinal)`) is shared by both.
- `DecorationSelector.jsx` is a client component; it imports ONLY the pure engine (allowed — `decoration/` is not in the server-only list).

## Tech Stack

- JS + JSX (no TypeScript). React Router 7 file-based routes.
- Hydrogen on Oxygen (workerd). Storefront API via `context.storefront`.
- Test runner: VITEST. Config `vitest.config.js` (added Phase 1, task 0). Command: `npx vitest run <path>`.
- Branch `feat/auth-decoration-quotes` already exists. Conventional commits; END every commit body with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- `round2(n) = Math.round(n * 100) / 100`. Prices stored raw; format only at render.

---

## Task 1 — `app/lib/decoration/engine.js`: PRICE_MATRIX + getTechniques + getMeasures + matchSurfaceKey

Files:
- Create: `app/lib/decoration/engine.js`
- Test: `app/lib/decoration/engine.matrix.test.js`

Steps:

- [ ] Write the failing test. Create `app/lib/decoration/engine.matrix.test.js` with COMPLETE contents:

```js
import {describe, it, expect} from 'vitest';
import {PRICE_MATRIX, getTechniques, getMeasures} from './engine.js';

describe('PRICE_MATRIX parity with scripthhglobal.liquid', () => {
  it('has exactly the 9 technique keys with identical accents/casing', () => {
    expect(Object.keys(PRICE_MATRIX)).toEqual([
      'SERIGRAFÍA',
      'BORDADO',
      'PARCHE SUBLIMADO',
      'VINIL IMPRIMIBLE Y DTF',
      'IMPRESIÓN UV PLANA FULL COLOR',
      'IMPRESIÓN 360° FULL COLOR',
      'SUBLIMACION',
      'GRABADO LÁSER',
      'GOTA DE RESINA',
    ]);
  });

  it('SERIGRAFÍA surfaces and an exact row match the Liquid', () => {
    expect(Object.keys(PRICE_MATRIX['SERIGRAFÍA'])).toEqual([
      'ACERO / METAL / MADERA / PLÁSTICO',
      'TEXTIL',
      'RUBBER / VIDRIO',
      'TRANSFER',
    ]);
    expect(PRICE_MATRIX['SERIGRAFÍA']['TEXTIL']).toEqual([
      {medida: '4 x 4', precioMinimo: 3.33, precioMaximo: 1641.8, cantidadMinima: 300},
      {medida: '10 x 10', precioMinimo: 3.33, precioMaximo: 1641.8, cantidadMinima: 300},
      {medida: '18 x 18', precioMinimo: 3.33, precioMaximo: 1641.8, cantidadMinima: 300},
    ]);
  });

  it('preserves the mixed-case "10 X 10" key under SERIGRAFÍA/ACERO', () => {
    const rows = PRICE_MATRIX['SERIGRAFÍA']['ACERO / METAL / MADERA / PLÁSTICO'];
    expect(rows.map((r) => r.medida)).toEqual(['4 x 4', '10 X 10', '15 x 15']);
  });

  it('GRABADO LÁSER "14 x 21" row matches the Liquid exactly', () => {
    const rows = PRICE_MATRIX['GRABADO LÁSER']['MADERA / METAL / VIDRIO'];
    expect(rows[5]).toEqual({medida: '14 x 21', precioMinimo: 20, precioMaximo: 20.85, cantidadMinima: 1});
  });
});

describe('getTechniques', () => {
  it('parses a dash-delimited single_line_text_field', () => {
    expect(getTechniques('SERIGRAFÍA-BORDADO-SUBLIMACION')).toEqual([
      'SERIGRAFÍA',
      'BORDADO',
      'SUBLIMACION',
    ]);
  });

  it('parses a JSON-array string from list.single_line_text_field', () => {
    expect(getTechniques('["SERIGRAFÍA", "BORDADO"]')).toEqual(['SERIGRAFÍA', 'BORDADO']);
  });

  it('trims and drops empty entries', () => {
    expect(getTechniques(' SERIGRAFÍA - - BORDADO ')).toEqual(['SERIGRAFÍA', 'BORDADO']);
  });

  it('returns [] for null/empty', () => {
    expect(getTechniques(null)).toEqual([]);
    expect(getTechniques('')).toEqual([]);
    expect(getTechniques(undefined)).toEqual([]);
  });

  it('falls back to dash split when JSON is malformed', () => {
    expect(getTechniques('[SERIGRAFÍA-BORDADO')).toEqual(['[SERIGRAFÍA', 'BORDADO']);
  });
});

describe('getMeasures', () => {
  it('returns measures for an exact surface membership (uppercased)', () => {
    expect(getMeasures('SERIGRAFÍA', 'textil')).toEqual(['4 x 4', '10 x 10', '18 x 18']);
  });

  it('matches a multi-surface key by exact membership, not substring', () => {
    expect(getMeasures('SERIGRAFÍA', 'metal')).toEqual(['4 x 4', '10 X 10', '15 x 15']);
  });

  it('returns [] for unknown technique or surface', () => {
    expect(getMeasures('NOPE', 'textil')).toEqual([]);
    expect(getMeasures('SERIGRAFÍA', 'papel')).toEqual([]);
  });
});
```

- [ ] Run it expecting FAIL. Command: `npx vitest run app/lib/decoration/engine.matrix.test.js`
  Expected output: failure resolving the import — `Failed to load url ./engine.js` / `Cannot find module`, all tests error (0 passed).

- [ ] Minimal implementation. Create `app/lib/decoration/engine.js` with COMPLETE contents (PRICE_MATRIX reproduced EXACTLY from `scripthhglobal.liquid`, accents/casing/order preserved):

```js
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
```

- [ ] Run test expecting PASS. Command: `npx vitest run app/lib/decoration/engine.matrix.test.js`
  Expected output: all tests pass (3 suites, green).

- [ ] Commit:
```
git add app/lib/decoration/engine.js app/lib/decoration/engine.matrix.test.js
git commit -m "feat(decoration): port PRICE_MATRIX + getTechniques/getMeasures from Liquid

Reproduce matrizPrecios byte-for-byte (accents/case) and add the
dash/JSON-array technique parser plus the exact surface-membership
measure lookup. Pure module, Vitest parity tests included.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 — `calcDecoration` + `effectiveUnitPrice` + `round2` parity tests

Files:
- Modify: none (functions already implemented in Task 1; this task adds the numeric parity tests that lock the contract)
- Test: `app/lib/decoration/engine.calc.test.js`

Steps:

- [ ] Write the failing test. Create `app/lib/decoration/engine.calc.test.js` with COMPLETE contents:

```js
import {describe, it, expect} from 'vitest';
import {calcDecoration, effectiveUnitPrice, round2} from './engine.js';

describe('calcDecoration — parity with scripthhglobal.liquid', () => {
  it('SERIGRAFÍA / TEXTIL / "4 x 4" / qty=300 ⇒ (300*3.33)/0.67', () => {
    const r = calcDecoration('SERIGRAFÍA', 'TEXTIL', 300, '4 x 4');
    expect(r.error).toBeNull();
    expect(r.isMinPriceUsed).toBe(true);
    expect(r.neededQtyForMin).toBe(300);
    expect(r.totalPrice).toBeCloseTo((300 * 3.33) / 0.67, 6); // 1491.044776...
    expect(r.unitPrice).toBeCloseTo(((300 * 3.33) / 0.67) / 300, 6); // 4.970149...
  });

  it('SERIGRAFÍA / metal / "10 X 10" (uppercase X) matches case-insensitively', () => {
    const r = calcDecoration('SERIGRAFÍA', 'metal', 500, '10 x 10'); // lowercase x input
    expect(r.error).toBeNull();
    expect(r.neededQtyForMin).toBe(500);
    expect(r.totalPrice).toBeCloseTo((500 * 2.1) / 0.67, 6);
  });

  it('qty=1 below minimum ⇒ flat precioMaximo as total', () => {
    const r = calcDecoration('SERIGRAFÍA', 'TEXTIL', 1, '4 x 4');
    expect(r.error).toBeNull();
    expect(r.isMinPriceUsed).toBe(false);
    expect(r.totalPrice).toBe(1641.8); // precioMaximo
    expect(r.unitPrice).toBe(1641.8); // total / 1
    expect(r.neededQtyForMin).toBe(300);
  });

  it('"Sin decorado" short-circuits to total 0 with no error', () => {
    const r = calcDecoration('Sin decorado', 'TEXTIL', 300, '4 x 4');
    expect(r).toEqual({error: null, totalPrice: 0, unitPrice: 0, neededQtyForMin: 0, isMinPriceUsed: false});
  });

  it('qty=0 yields unitPrice 0 (no divide-by-zero)', () => {
    const r = calcDecoration('SERIGRAFÍA', 'TEXTIL', 0, '4 x 4');
    expect(r.error).toBeNull();
    expect(r.totalPrice).toBe(1641.8); // 0 < min ⇒ precioMaximo
    expect(r.unitPrice).toBe(0);
  });

  it('unknown technique ⇒ structured error', () => {
    const r = calcDecoration('NOPE', 'TEXTIL', 10, '4 x 4');
    expect(r.error).toBe('Tipo de decorado no encontrado: NOPE');
    expect(r.totalPrice).toBe(0);
  });

  it('unknown surface ⇒ structured error (uppercased in message)', () => {
    const r = calcDecoration('SERIGRAFÍA', 'papel', 10, '4 x 4');
    expect(r.error).toBe('Superficie no encontrada: PAPEL');
    expect(r.totalPrice).toBe(0);
  });

  it('unknown measure ⇒ structured error', () => {
    const r = calcDecoration('SERIGRAFÍA', 'TEXTIL', 10, '99 x 99');
    expect(r.error).toBe('Medida no encontrada: 99 x 99');
    expect(r.totalPrice).toBe(0);
  });
});

describe('effectiveUnitPrice + round2', () => {
  it('amortizes decoration total over qty on top of base price', () => {
    // base 40.60, decoration total 1491.0447..., qty 300
    const deco = (300 * 3.33) / 0.67;
    expect(effectiveUnitPrice(40.6, deco, 300)).toBeCloseTo(40.6 + deco / 300, 6);
  });

  it('qty=0 ⇒ returns base price only', () => {
    expect(effectiveUnitPrice(40.6, 1641.8, 0)).toBe(40.6);
  });

  it('round2 matches Math.round(n*100)/100', () => {
    expect(round2(4.970149253731343)).toBe(4.97);
    expect(round2(45.57014925373134)).toBe(45.57);
    expect(round2(1641.805)).toBe(1641.81);
  });
});
```

- [ ] Run it expecting FAIL... actually GREEN-on-arrival check. Command: `npx vitest run app/lib/decoration/engine.calc.test.js`
  Expected output: all tests PASS immediately, because the functions were implemented in Task 1. This is the intended verification that the Task 1 implementation satisfies the full numeric parity contract. (If any assertion fails, the Task 1 code is wrong — fix `engine.js`, re-run until green, before committing.)

- [ ] Commit:
```
git add app/lib/decoration/engine.calc.test.js
git commit -m "test(decoration): lock numeric parity for calcDecoration/effectiveUnitPrice

Pin (qty*precioMinimo)/0.67 above-min, flat precioMaximo below-min,
Sin decorado short-circuit, case-insensitive size match, structured
error paths, and round2 behavior against the Liquid engine.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 — Metafields in fragments + `normalizeProduct` exposes `techniques` + `surface`

Files:
- Modify: `app/lib/giFragments.js` (fragment `GiProductCard`, lines 5-25 — add a `metafields(...)` selection before the closing brace)
- Modify: `app/routes/products.$handle.jsx` (fragment `Product`, lines 555-582 — add the same `metafields(...)` selection)
- Modify: `app/lib/gi.js` (`normalizeProduct`, lines 108-143 — derive `techniques` + `surface`; import `getTechniques`)
- Test: `app/lib/gi.normalizeProduct.decoration.test.js`

Steps:

- [ ] Write the failing test. Create `app/lib/gi.normalizeProduct.decoration.test.js` with COMPLETE contents:

```js
import {describe, it, expect} from 'vitest';
import {normalizeProduct} from './gi.js';
import {getMeasures} from './decoration/engine.js';

function baseNode(metafields) {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'taza-test',
    title: 'Taza Test',
    description: 'Producto de prueba',
    vendor: 'GI',
    tags: [],
    featuredImage: {url: 'https://x/y.jpg', altText: 'Taza'},
    priceRange: {minVariantPrice: {amount: '40.60', currencyCode: 'MXN'}},
    options: [],
    variants: {nodes: [{id: 'gid://shopify/ProductVariant/9', title: 'Default', sku: 'T1', availableForSale: true, price: {amount: '40.60', currencyCode: 'MXN'}}]},
    metafields,
  };
}

describe('normalizeProduct decoration fields', () => {
  it('exposes techniques from a dash-delimited metafield and raw surface', () => {
    const p = normalizeProduct(
      baseNode([
        {namespace: 'custom', key: 'tecnicas_de_impresion', value: 'SERIGRAFÍA-BORDADO'},
        {namespace: 'custom', key: 'superficie', value: 'TEXTIL'},
      ]),
    );
    expect(p.techniques).toEqual(['SERIGRAFÍA', 'BORDADO']);
    expect(p.surface).toBe('TEXTIL');
  });

  it('exposes techniques from a JSON-array (list) metafield shape', () => {
    const p = normalizeProduct(
      baseNode([
        {namespace: 'custom', key: 'tecnicas_de_impresion', value: '["SERIGRAFÍA", "SUBLIMACION"]'},
        {namespace: 'custom', key: 'superficie', value: 'textil'},
      ]),
    );
    expect(p.techniques).toEqual(['SERIGRAFÍA', 'SUBLIMACION']);
    expect(p.surface).toBe('textil');
  });

  it('every parsed technique + surface maps to at least one measure in PRICE_MATRIX', () => {
    const p = normalizeProduct(
      baseNode([
        {namespace: 'custom', key: 'tecnicas_de_impresion', value: 'SERIGRAFÍA-BORDADO'},
        {namespace: 'custom', key: 'superficie', value: 'TEXTIL'},
      ]),
    );
    for (const t of p.techniques) {
      expect(getMeasures(t, p.surface).length).toBeGreaterThan(0);
    }
  });

  it('defaults to [] techniques and "" surface when metafields absent or null', () => {
    const p = normalizeProduct(baseNode([null, null]));
    expect(p.techniques).toEqual([]);
    expect(p.surface).toBe('');
    const p2 = normalizeProduct(baseNode(null));
    expect(p2.techniques).toEqual([]);
    expect(p2.surface).toBe('');
  });
});
```

- [ ] Run it expecting FAIL. Command: `npx vitest run app/lib/gi.normalizeProduct.decoration.test.js`
  Expected output: assertions fail — `p.techniques` is `undefined` (expected array), `p.surface` is `undefined` (expected string). Several failing tests.

- [ ] Minimal implementation, part A — import and derive in `app/lib/gi.js`. Add the import near the top of the file (after the existing leading comment, before the first `export function`):

```js
import {getTechniques} from './decoration/engine.js';

/** Read a `custom.<key>` metafield value from a Storefront metafields array. */
function readMetafield(node, key) {
  const list = node?.metafields || [];
  const mf = list.find((m) => m && m.namespace === 'custom' && m.key === key);
  return mf?.value ?? null;
}
```

  Then add two fields to the object returned by `normalizeProduct` (inside the `return { ... }`, right after the `moq: parseMoq(node.description) || 50,` line):

```js
    moq: parseMoq(node.description) || 50,
    techniques: getTechniques(readMetafield(node, 'tecnicas_de_impresion')),
    surface: String(readMetafield(node, 'superficie') ?? ''),
```

- [ ] Minimal implementation, part B — add metafields to the card fragment in `app/lib/giFragments.js`. Inside `GiProductCard`, add the selection just before the closing `}` of the fragment (after the `variants(first: 1) { ... }` block):

```graphql
    metafields(identifiers: [
      {namespace: "custom", key: "tecnicas_de_impresion"},
      {namespace: "custom", key: "superficie"}
    ]) { key namespace value }
```

- [ ] Minimal implementation, part C — add metafields to the PDP fragment in `app/routes/products.$handle.jsx`. Inside the `Product` fragment, add the selection just before `seo { description title }`:

```graphql
    metafields(identifiers: [
      {namespace: "custom", key: "tecnicas_de_impresion"},
      {namespace: "custom", key: "superficie"}
    ]) { key namespace value }
```

- [ ] Run test expecting PASS. Command: `npx vitest run app/lib/gi.normalizeProduct.decoration.test.js`
  Expected output: all tests pass.

- [ ] MANUAL verification (Storefront query shape — workerd/network, not unit-testable). With the dev server running (`npm run dev`), open a PDP for a product that has the metafields set and confirm in the browser Network tab that the `Product` GraphQL response includes a `metafields` array with `tecnicas_de_impresion` and `superficie`, and that `value` is non-null. Confirm the technique strings match `PRICE_MATRIX` keys byte-for-byte (accents/case). If `value` arrives as a JSON-array string (list type), `getTechniques` already handles it.

- [ ] Commit:
```
git add app/lib/gi.js app/lib/giFragments.js app/routes/products.\$handle.jsx app/lib/gi.normalizeProduct.decoration.test.js
git commit -m "feat(decoration): surface tecnicas_de_impresion/superficie metafields

Add the custom.tecnicas_de_impresion + custom.superficie selections to
the card and PDP product fragments and expose product.techniques and
product.surface from normalizeProduct (both metafield shapes).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 — `app/components/gi/DecorationSelector.jsx` (technique→measure→single integrated price)

Files:
- Create: `app/components/gi/DecorationSelector.jsx`
- Test: `app/components/gi/DecorationSelector.test.jsx`

Behavior (spec §9.2):
- Props: `product` (with `.techniques`, `.surface`), `basePrice` (number), `qty` (number), `onChange(detail)` where `detail = {technique, surface, size, qty}` (inputs only — numbers are display).
- If `product.techniques` is empty ⇒ render nothing (graceful degradation).
- Technique select = `['Sin decorado', ...product.techniques]`; measure select = `getMeasures(technique, product.surface)` (disabled until a technique is chosen; "Sin decorado" disables measures and uses size `'N/A'`).
- Shows a SINGLE unit price = `round2(effectiveUnitPrice(basePrice, calc.totalPrice, qty))` plus a secondary line "incluye decorado $X/pz".
- Below minimum (`!calc.isMinPriceUsed` and technique not "Sin decorado"): show fixed-charge message "Cargo fijo de decorado $X; alcanza N piezas para precio por unidad".
- On `calc.error`: show the error message and call `onChange` with the current inputs but expose an `aria-disabled` "add" affordance hint via `data-deco-error` (the PDP add button reads it). The component itself does not own the add button; it signals error state so the parent disables add.

Steps:

- [ ] Write the failing test. Create `app/components/gi/DecorationSelector.test.jsx` with COMPLETE contents:

```jsx
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, fireEvent, cleanup} from '@testing-library/react';
import DecorationSelector from './DecorationSelector.jsx';

afterEach(cleanup);

const product = {techniques: ['SERIGRAFÍA', 'BORDADO'], surface: 'TEXTIL'};

describe('DecorationSelector', () => {
  it('renders nothing when product has no techniques', () => {
    const {container} = render(
      <DecorationSelector product={{techniques: [], surface: ''}} basePrice={40.6} qty={1} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('lists Sin decorado plus the product techniques', () => {
    render(<DecorationSelector product={product} basePrice={40.6} qty={1} onChange={() => {}} />);
    const techSelect = screen.getByLabelText(/tipo de decorado/i);
    const values = Array.from(techSelect.querySelectorAll('option')).map((o) => o.value);
    expect(values).toContain('Sin decorado');
    expect(values).toContain('SERIGRAFÍA');
    expect(values).toContain('BORDADO');
  });

  it('populates measures after picking a technique and emits inputs', () => {
    const onChange = vi.fn();
    render(<DecorationSelector product={product} basePrice={40.6} qty={300} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/tipo de decorado/i), {target: {value: 'SERIGRAFÍA'}});
    const measure = screen.getByLabelText(/medida/i);
    const opts = Array.from(measure.querySelectorAll('option')).map((o) => o.value);
    expect(opts).toEqual(expect.arrayContaining(['4 x 4', '10 x 10', '18 x 18']));
    fireEvent.change(measure, {target: {value: '4 x 4'}});
    expect(onChange).toHaveBeenLastCalledWith({technique: 'SERIGRAFÍA', surface: 'TEXTIL', size: '4 x 4', qty: 300});
  });

  it('shows a single integrated unit price above the minimum', () => {
    render(<DecorationSelector product={product} basePrice={40.6} qty={300} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText(/tipo de decorado/i), {target: {value: 'SERIGRAFÍA'}});
    fireEvent.change(screen.getByLabelText(/medida/i), {target: {value: '4 x 4'}});
    // base 40.60 + (1491.0447.../300) = 45.5701... ⇒ round2 45.57
    expect(screen.getByTestId('deco-unit-price')).toHaveTextContent('45.57');
    expect(screen.getByTestId('deco-included')).toHaveTextContent(/incluye decorado/i);
  });

  it('shows the fixed-charge message below minimum', () => {
    render(<DecorationSelector product={product} basePrice={40.6} qty={1} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText(/tipo de decorado/i), {target: {value: 'SERIGRAFÍA'}});
    fireEvent.change(screen.getByLabelText(/medida/i), {target: {value: '4 x 4'}});
    expect(screen.getByTestId('deco-fixed-charge')).toHaveTextContent(/cargo fijo de decorado/i);
    expect(screen.getByTestId('deco-fixed-charge')).toHaveTextContent('300');
  });

  it('Sin decorado yields base price and disables measures', () => {
    const onChange = vi.fn();
    render(<DecorationSelector product={product} basePrice={40.6} qty={5} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/tipo de decorado/i), {target: {value: 'Sin decorado'}});
    expect(screen.getByLabelText(/medida/i)).toBeDisabled();
    expect(screen.getByTestId('deco-unit-price')).toHaveTextContent('40.60');
    expect(onChange).toHaveBeenLastCalledWith({technique: 'Sin decorado', surface: 'TEXTIL', size: 'N/A', qty: 5});
  });

  it('signals error state when surface does not match (data-deco-error)', () => {
    render(
      <DecorationSelector
        product={{techniques: ['SERIGRAFÍA'], surface: 'PAPEL'}}
        basePrice={40.6}
        qty={300}
        onChange={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/tipo de decorado/i), {target: {value: 'SERIGRAFÍA'}});
    const root = screen.getByTestId('decoration-selector');
    expect(root).toHaveAttribute('data-deco-error', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/superficie no encontrada/i);
  });
});
```

- [ ] Run it expecting FAIL. Command: `npx vitest run app/components/gi/DecorationSelector.test.jsx`
  Expected output: import resolution failure — `Failed to load url ./DecorationSelector.jsx`; all tests error. (If `@testing-library/react` / `jsdom` are missing, install as devDependencies: `npm i -D @testing-library/react @testing-library/jest-dom jsdom` and ensure `vitest.config.js` sets `test.environment = 'jsdom'`; this is config from Phase 1 — confirm `jsdom` environment is active before proceeding.)

- [ ] Minimal implementation. Create `app/components/gi/DecorationSelector.jsx` with COMPLETE contents:

```jsx
import {useEffect, useMemo, useState} from 'react';
import {
  getMeasures,
  calcDecoration,
  effectiveUnitPrice,
  round2,
} from '~/lib/decoration/engine.js';

const SIN_DECORADO = 'Sin decorado';

function fmt(n) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * PDP decoration selector. Display-only numbers; emits {technique, surface, size, qty}.
 * Renders nothing when the product has no techniques (graceful degradation).
 */
export default function DecorationSelector({product, basePrice, qty, onChange}) {
  const techniques = product?.techniques || [];
  const surface = product?.surface || '';
  const [technique, setTechnique] = useState('');
  const [size, setSize] = useState('');

  const measures = useMemo(
    () => (technique && technique !== SIN_DECORADO ? getMeasures(technique, surface) : []),
    [technique, surface],
  );

  const effectiveSize = technique === SIN_DECORADO ? 'N/A' : size;

  const calc = useMemo(() => {
    if (!technique) return null;
    if (technique === SIN_DECORADO) {
      return calcDecoration(SIN_DECORADO, surface, qty, 'N/A');
    }
    if (!size) return null;
    return calcDecoration(technique, surface, qty, size);
  }, [technique, surface, qty, size]);

  const hasError = Boolean(calc && calc.error);

  useEffect(() => {
    if (!technique) return;
    if (technique !== SIN_DECORADO && !size) return;
    onChange({technique, surface, size: effectiveSize, qty});
  }, [technique, surface, size, qty, effectiveSize, onChange]);

  if (techniques.length === 0) return null;

  function handleTechnique(e) {
    setTechnique(e.target.value);
    setSize('');
  }

  function handleSize(e) {
    setSize(e.target.value);
  }

  const showPrice = Boolean(calc && !calc.error);
  const unitPrice = showPrice
    ? round2(effectiveUnitPrice(basePrice, calc.totalPrice, qty))
    : null;
  const decoPerUnit = showPrice ? round2(calc.unitPrice) : null;

  return (
    <div data-testid="decoration-selector" data-deco-error={hasError ? 'true' : 'false'}>
      <label htmlFor="gi-decorado-select">Elige tipo de decorado:</label>
      <select id="gi-decorado-select" value={technique} onChange={handleTechnique}>
        <option value="" disabled>
          Seleccione técnica de impresión
        </option>
        <option value={SIN_DECORADO}>{SIN_DECORADO}</option>
        {techniques.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <label htmlFor="gi-medida-select">Elige la medida:</label>
      <select
        id="gi-medida-select"
        value={effectiveSize === 'N/A' ? '' : size}
        onChange={handleSize}
        disabled={technique === '' || technique === SIN_DECORADO}
      >
        <option value="" disabled>
          {technique === SIN_DECORADO ? 'N/A' : 'Seleccione medida'}
        </option>
        {measures.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {hasError && (
        <p role="alert" data-testid="deco-error">
          {calc.error}
        </p>
      )}

      {showPrice && (
        <div>
          <p data-testid="deco-unit-price">$ {fmt(unitPrice)} MXN</p>
          {technique !== SIN_DECORADO && (
            <p data-testid="deco-included">incluye decorado ${fmt(decoPerUnit)}/pz</p>
          )}
          {technique !== SIN_DECORADO && !calc.isMinPriceUsed && (
            <p data-testid="deco-fixed-charge">
              Cargo fijo de decorado ${fmt(calc.totalPrice)}; alcanza {calc.neededQtyForMin} piezas
              para precio por unidad
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] Run test expecting PASS. Command: `npx vitest run app/components/gi/DecorationSelector.test.jsx`
  Expected output: all tests pass.

- [ ] Commit:
```
git add app/components/gi/DecorationSelector.jsx app/components/gi/DecorationSelector.test.jsx
git commit -m "feat(decoration): DecorationSelector PDP component

Technique->medida selects driving a single integrated unit price via
the pure engine, fixed-charge message below minimum, Sin decorado base
price, and data-deco-error signal so the PDP can disable add on error.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5 — Render `DecorationSelector` in PDP and expose `decoDetail` via onChange

Scope note: Phase 5 only renders the selector + the integrated single-unit price and exposes `decoDetail` ({technique, surface, size, qty}) to the PDP via `onChange`. The actual wiring of the PDP add-to-quote button to POST those fields to `/api/quote/add` (where the server recomputes prices) is done in Phase 7. In Phase 5 the add-to-quote control is only gated locally (disabled on engine error); it does not yet submit to the quote endpoint.

Files:
- Modify: `app/routes/products.$handle.jsx` (product component body — import `DecorationSelector`, render it under the price, hold `decoDetail` state, disable the add-to-quote control when the selector reports an error)
- Test: none new (covered by Task 4 unit tests + manual). This task is integration glue in a workerd-rendered route — verify manually.

Steps:

- [ ] MANUAL pre-implementation read. Read `app/routes/products.$handle.jsx` to find: the `useLoaderData`-derived product object (run it through `normalizeProduct` if not already), the rendered base price element, and the existing add-to-quote button/handler. Note exact line numbers before editing.

- [ ] Minimal implementation. In `app/routes/products.$handle.jsx`:
  1. Add the import at the top with the other component imports:
     ```jsx
     import DecorationSelector from '~/components/gi/DecorationSelector.jsx';
     ```
  2. In the component body, add state:
     ```jsx
     const [decoDetail, setDecoDetail] = useState(null);
     const decoError = decoDetail?.error || false;
     ```
     (where `decoDetail` is the `{technique, surface, size, qty}` from `onChange`; compute a local `decoError` by re-running `calcDecoration` if you need the message — but for the disable gate, read the selector's `data-deco-error` via the detail: simplest is to compute `const decoCalc = decoDetail ? calcDecoration(decoDetail.technique, decoDetail.surface, decoDetail.qty, decoDetail.size) : null;` importing `calcDecoration` from `~/lib/decoration/engine.js`, then `const decoError = Boolean(decoCalc && decoCalc.error);`).
  3. Render under the price block:
     ```jsx
     <DecorationSelector
       product={product}
       basePrice={product.price}
       qty={qty}
       onChange={setDecoDetail}
     />
     ```
  4. Disable the add-to-quote button when `decoError` is true:
     ```jsx
     <button type="button" disabled={decoError} onClick={handleAddToQuote}>
       Agregar a cotización
     </button>
     ```
     In Phase 5, `decoDetail` ({technique, surface, size, qty} only — never the displayed numbers) is held in state and exposed via `onChange`; the local add-to-quote control is only error-gated. Actually wiring this button to POST `{variantId, technique, surface, size, qty}` to `/api/quote/add` (so the server recomputes prices per the Phase 4 recompute rule) is Phase 7 work. The client must send ONLY `{variantId, technique, surface, size, qty}` — never the displayed numbers.

- [ ] MANUAL verification (browser; workerd route, not unit-testable):
  1. `npm run dev`, open a PDP whose product has `tecnicas_de_impresion` + `superficie`.
  2. Confirm the technique select lists "Sin decorado" + the product techniques; picking a technique populates measures.
  3. SERIGRAFÍA + TEXTIL + "4 x 4" + qty 300 ⇒ unit price shows `$ 45.57 MXN` (base 40.60 example), "incluye decorado" line present, no fixed-charge message.
  4. Same with qty 1 ⇒ fixed-charge message "Cargo fijo de decorado $1,641.80; alcanza 300 piezas...".
  5. A product with a surface NOT in the matrix for the picked technique ⇒ error message shown and the "Agregar a cotización" button is disabled.
  6. "Sin decorado" ⇒ measures disabled, price reverts to base, add enabled.

- [ ] Commit:
```
git add app/routes/products.\$handle.jsx
git commit -m "feat(decoration): wire DecorationSelector into PDP

Render the decoration selector under the price, recompute the display
unit price, and disable add-to-quote when the engine reports an error.
Only {variantId, technique, surface, size, qty} are sent to the server.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done criteria

- `npx vitest run app/lib/decoration/` is green (matrix + calc parity).
- `npx vitest run app/lib/gi.normalizeProduct.decoration.test.js` is green.
- `npx vitest run app/components/gi/DecorationSelector.test.jsx` is green.
- PDP manual checks (Task 5) pass for above-min, below-min, Sin decorado, and error paths.
- `PRICE_MATRIX` is byte-for-byte faithful to `scripthhglobal.liquid` (keys/accents/case/order, the mixed "10 X 10" key, the "14 x 21" row).
