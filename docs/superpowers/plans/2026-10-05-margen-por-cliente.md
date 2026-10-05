# Margen por cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un cliente con `custom.margen` ve, filtra, ordena y cotiza con `costo / (1 − margen/100)`; los demás siguen con el precio de lista.

**Architecture:** Una fórmula pura (`app/lib/pricing.js`) y un módulo de servidor (`app/lib/pricing.server.js`) que lee el margen del cliente (Admin API, caché por cliente) y los costos de variante (Admin API, caché compartida). Los loaders pasan su respuesta cruda de Storefront por `applyCustomerPrices`, que reescribe `price.amount` de cada variante; la cotización usa `resolveBasePrices` como precio base y reprecia al enviar. El filtro de precio convierte el rango del cliente a rango de lista porque la lista es `costo / 0.30` en el 99,7 % del catálogo.

**Tech Stack:** Shopify Hydrogen (React Router 7), Storefront + Admin GraphQL API `2026-04`, Turso/libSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-margen-por-cliente-design.md`

## Global Constraints

- Fórmula: margen bruto, `precio = costo / (1 − margen/100)`, redondeado a 2 decimales con `round2` de `app/lib/decoration/engine.js`.
- `custom.margen` se captura como porcentaje (`30` = 30 %). Válido sólo si es finito y `0 < m < 100`; cualquier otro valor ⇒ precio de lista.
- Sin margen (anónimo, sin `gid` en sesión, metafield vacío o inválido, fallo de Admin API, modo stub) ⇒ precio de lista **y ninguna consulta de costos**.
- Variante sin costo (nulo, 0 o no numérico) ⇒ precio de lista para esa variante; se puede cotizar.
- `LIST_MARGIN = 70` (el precio de lista es `costo / 0.30`).
- La decoración no cambia (sigue con su `/0.67`). El cupón no cambia.
- El costo **nunca** llega al navegador: ningún loader devuelve `unitCost` ni `inventoryItem`.
- Comentarios en español, mismo tono que el código vecino. Tests con Vitest (`npx vitest run <ruta>`).
- Línea base antes de empezar: `npx vitest run` → 123 archivos, 1054 tests en verde.

## Review Focus

1. **Visitante anónimo o cliente sin margen**: la página debe salir idéntica a hoy y sin llamadas al Admin API. → Task 3 (`applyCustomerPrices` sin margen no llama a `getVariantCosts`) y Task 6 (los loaders devuelven los mismos datos).
2. **Metafield con basura** (`"0"`, `"100"`, `"-5"`, `"abc"`, `"30.5"`): sólo `30.5` aplica; el resto es lista con un `console.warn`. → Task 1 y Task 3.
3. **Admin API caído a mitad de página**: precio de lista, nunca un 500. → Task 3 (costos que lanzan ⇒ lista).
4. **Cotización enviada días después de armada, con el margen cambiado**: el draft order y los correos llevan el precio nuevo, y lo guardado coincide. → Task 5 (`submit` persiste y notifica con los items repreciados).
5. **Rango de precio en el borde por redondeo de punto flotante** (`100 × 0.6 / 0.3 = 200.00000000000003`): Shopify debe recibir exactamente `200`, no `200.01`. → Task 1 (`toListRange`).

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `app/lib/pricing.js` (nuevo) | Fórmula pura: `LIST_MARGIN`, `parseMargin`, `customerPrice`, `listFactor`, `toListRange`. |
| `app/lib/admin/operations.js` | + `getCustomerMarginRaw(env, gid)`, `getVariantCosts(env, ids)`. |
| `app/lib/pricing.server.js` (nuevo) | `getCustomerMargin(context)`, `resolveBasePrices(context, entries)`, `applyCustomerPrices(context, data)`. Caché y memo por request. |
| `app/lib/quotes/reprice.server.js` (nuevo) | `repriceItems(context, items)`: precio de lista actual + margen + decoración. |
| `app/routes/api.quote.add.jsx`, `api.quote.merge.jsx` | Precio base vía `resolveBasePrices`. |
| `app/routes/api.quote.reorder.jsx`, `api.quote.submit.jsx` | Repricing vía `repriceItems`. |
| `app/lib/filters.js` | `buildProductFilters(..., {margin})` traduce el rango. |
| `app/routes/catalogo.jsx`, `collections.$handle.jsx`, `_index.jsx`, `account.favoritos.jsx`, `products.$handle.jsx`, `search.jsx` | Pasan la respuesta de Storefront por `applyCustomerPrices`. |

---

### Task 1: Fórmula pura

**Files:**
- Create: `app/lib/pricing.js`
- Test: `app/lib/pricing.test.js`

**Interfaces:**
- Consumes: `round2(n: number): number` de `app/lib/decoration/engine.js`.
- Produces:
  - `LIST_MARGIN: 70`
  - `parseMargin(raw: unknown): number|null`
  - `customerPrice({cost, margin, listPrice}: {cost: number|null|undefined, margin: number|null, listPrice: number}): number`
  - `listFactor(margin: number|null): number`
  - `toListRange({min, max}: {min: number|null, max: number|null}, margin: number|null): {min: number|null, max: number|null}`

- [ ] **Step 1: Write the failing test**

`app/lib/pricing.test.js`:

```js
import {describe, it, expect} from 'vitest';
import {LIST_MARGIN, parseMargin, customerPrice, listFactor, toListRange} from './pricing.js';

describe('parseMargin', () => {
  it('acepta porcentajes entre 0 y 100, exclusivos', () => {
    expect(parseMargin('30')).toBe(30);
    expect(parseMargin('30.5')).toBe(30.5);
    expect(parseMargin(' 27.5 ')).toBe(27.5);
    expect(parseMargin(45)).toBe(45);
  });

  it('descarta lo que no es un margen usable', () => {
    for (const raw of [null, undefined, '', 'abc', '0', 0, '-5', '100', '250', NaN, Infinity]) {
      expect(parseMargin(raw)).toBeNull();
    }
  });
});

describe('customerPrice', () => {
  it('aplica margen bruto sobre el costo', () => {
    expect(customerPrice({cost: 100, margin: 30, listPrice: 333.33})).toBe(142.86);
    expect(customerPrice({cost: 100, margin: 50, listPrice: 333.33})).toBe(200);
  });

  it('con margen 70 reproduce el precio de lista de la tienda', () => {
    // Muestra real: costo 40.01, lista 133.36.
    expect(customerPrice({cost: 40.01, margin: LIST_MARGIN, listPrice: 133.36})).toBeCloseTo(133.36, 1);
  });

  it('sin margen devuelve el precio de lista', () => {
    expect(customerPrice({cost: 100, margin: null, listPrice: 333.33})).toBe(333.33);
  });

  it('sin costo devuelve el precio de lista', () => {
    for (const cost of [null, undefined, 0, -1, NaN]) {
      expect(customerPrice({cost, margin: 30, listPrice: 50})).toBe(50);
    }
  });
});

describe('listFactor y toListRange', () => {
  it('sin margen no toca el rango', () => {
    expect(listFactor(null)).toBe(1);
    expect(toListRange({min: 10, max: 100}, null)).toEqual({min: 10, max: 100});
  });

  it('convierte el rango del cliente a rango de lista', () => {
    // margen 40: lista = cliente × 0.60 / 0.30 = cliente × 2
    expect(listFactor(40)).toBeCloseTo(2, 10);
    expect(toListRange({min: 0, max: 100}, 40)).toEqual({min: 0, max: 200});
    expect(toListRange({min: 50, max: null}, 40)).toEqual({min: 100, max: null});
  });

  it('el ruido de punto flotante no empuja el borde un centavo', () => {
    // 100 × 0.6 / 0.3 da 200.00000000000003 en JS.
    expect(toListRange({min: null, max: 100}, 40).max).toBe(200);
  });

  it('redondea hacia afuera cuando el valor cae entre centavos', () => {
    // margen 35: factor 0.65/0.30 = 2.1666…
    const r = toListRange({min: 10, max: 10}, 35);
    expect(r.min).toBe(21.66);
    expect(r.max).toBe(21.67);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/pricing.test.js`
Expected: FAIL — `Failed to resolve import "./pricing.js"`.

- [ ] **Step 3: Write minimal implementation**

`app/lib/pricing.js`:

```js
/* Generando Ideas — precio por cliente sobre costo.
 *
 * Puro: sin red ni sesión, lo usan servidor y pruebas. La lectura del margen y
 * de los costos vive en pricing.server.js.
 *
 * El margen es bruto, como el /0.67 de la decoración: con margen 30 el costo es
 * el 70 % del precio, así que precio = costo / 0.70.
 */
import {round2} from './decoration/engine.js';

/* El precio de lista de la tienda es costo / 0.30 en el 99,7 % del catálogo
   (verificado el 2026-10-05). Es lo que deja traducir un rango de precio del
   cliente a uno de lista y que Shopify filtre y ordene por nosotros. */
export const LIST_MARGIN = 70;

/**
 * El margen del metafield `custom.margen` (porcentaje: 30 = 30 %), o null si no
 * es usable. El metafield no tiene validaciones en Shopify: 0, 100, negativos
 * o texto acaban aquí y significan "precio de lista".
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parseMargin(raw) {
  if (raw == null || raw === '') return null;
  const m = typeof raw === 'number' ? raw : Number(String(raw).trim());
  return Number.isFinite(m) && m > 0 && m < 100 ? m : null;
}

/**
 * Precio de una variante para un cliente. Sin margen o sin costo, el de lista.
 * @param {{cost: number|null|undefined, margin: number|null, listPrice: number}} args
 * @returns {number}
 */
export function customerPrice({cost, margin, listPrice}) {
  const c = Number(cost);
  if (margin == null || cost == null || !Number.isFinite(c) || c <= 0) return listPrice;
  return round2(c / (1 - margin / 100));
}

/**
 * Cuánto vale en precio de lista un peso de precio del cliente.
 * @param {number|null} margin
 * @returns {number}
 */
export function listFactor(margin) {
  if (margin == null) return 1;
  return (1 - margin / 100) / (1 - LIST_MARGIN / 100);
}

/* Primero se quita el ruido de punto flotante (a 4 decimales de centavo) y
   luego se redondea hacia afuera: el mínimo baja y el máximo sube, para que el
   redondeo nunca deje fuera un artículo que está justo en el borde. */
const aCentavos = (valor, redondeo) => redondeo(Math.round(valor * 1e6) / 1e4) / 100;

/**
 * El rango de precio que escribió el cliente, expresado en precio de lista.
 * @param {{min: number|null, max: number|null}} rango
 * @param {number|null} margin
 * @returns {{min: number|null, max: number|null}}
 */
export function toListRange({min = null, max = null}, margin) {
  const f = listFactor(margin);
  if (f === 1) return {min, max};
  return {
    min: min == null ? null : aCentavos(min * f, Math.floor),
    max: max == null ? null : aCentavos(max * f, Math.ceil),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/pricing.test.js`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add app/lib/pricing.js app/lib/pricing.test.js
git commit -m "feat(margen): fórmula de precio por cliente sobre costo"
```

---

### Task 2: Operaciones de Admin API — margen y costos

**Files:**
- Modify: `app/lib/admin/operations.js` (agregar al final, junto a `getCustomerBrandColors` ~línea 564)
- Test: `app/lib/admin/operations.test.js` (agregar `describe`s al final y los nombres al `import` de la línea 10)

**Interfaces:**
- Consumes: `adminFetch(env, query, vars)`, `isStubMode(env)` de `./client.js`.
- Produces:
  - `getCustomerMarginRaw(env, customerGid: string|null): Promise<string|null>` — valor crudo del metafield.
  - `getVariantCosts(env, variantIds: string[]): Promise<Record<string, number|null>>` — objeto plano (serializable para la caché), `null` = sin costo.

- [ ] **Step 1: Write the failing test**

Agregar `getCustomerMarginRaw, getVariantCosts` a la lista del `import {...} from './operations.js'` y, al final del archivo:

```js
describe('getCustomerMarginRaw', () => {
  it('devuelve el valor crudo de custom.margen', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValueOnce({customer: {metafield: {value: '30.0'}}});
    const out = await getCustomerMarginRaw({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://shopify/Customer/1');
    expect(out).toBe('30.0');
    const [, query, vars] = adminFetch.mock.calls[0];
    expect(query).toMatch(/key: "margen"/);
    expect(vars.gid).toBe('gid://shopify/Customer/1');
  });

  it('devuelve null sin metafield', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValueOnce({customer: {metafield: null}});
    expect(await getCustomerMarginRaw({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://x')).toBeNull();
  });

  it('no consulta en stub ni sin gid', async () => {
    expect(await getCustomerMarginRaw({}, 'gid://x')).toBeNull();
    isStubMode.mockReturnValue(false);
    expect(await getCustomerMarginRaw({PRIVATE_ADMIN_API_TOKEN: 't'}, null)).toBeNull();
    expect(adminFetch).not.toHaveBeenCalled();
  });
});

describe('getVariantCosts', () => {
  const env = {PRIVATE_ADMIN_API_TOKEN: 't'};
  const V = (n) => `gid://shopify/ProductVariant/${n}`;

  it('mapea cada variante a su costo, null si no tiene', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValueOnce({
      nodes: [
        {id: V(1), inventoryItem: {unitCost: {amount: '40.01'}}},
        {id: V(2), inventoryItem: {unitCost: null}},
        {id: V(3), inventoryItem: {unitCost: {amount: '0.0'}}},
        null,
      ],
    });
    const out = await getVariantCosts(env, [V(1), V(2), V(3), V(4)]);
    expect(out).toEqual({[V(1)]: 40.01, [V(2)]: null, [V(3)]: null});
  });

  it('parte en lotes de 250 y no repite ids', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({nodes: []});
    const ids = Array.from({length: 300}, (_, i) => V(i));
    await getVariantCosts(env, [...ids, V(0)]);
    expect(adminFetch).toHaveBeenCalledTimes(2);
    expect(adminFetch.mock.calls[0][2].ids).toHaveLength(250);
    expect(adminFetch.mock.calls[1][2].ids).toHaveLength(50);
  });

  it('no consulta en stub ni con la lista vacía', async () => {
    expect(await getVariantCosts({}, [V(1)])).toEqual({});
    isStubMode.mockReturnValue(false);
    expect(await getVariantCosts(env, [])).toEqual({});
    expect(adminFetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/admin/operations.test.js`
Expected: FAIL — `getCustomerMarginRaw is not a function`.

- [ ] **Step 3: Write minimal implementation**

Al final de `app/lib/admin/operations.js`:

```js
const CUSTOMER_MARGIN = `
  query customerMargin($gid: ID!) {
    customer(id: $gid) {
      metafield(namespace: "custom", key: "margen") { value }
    }
  }
`;

/**
 * Lee el margen negociado del cliente: el metafield de customer `custom.margen`
 * (number_decimal, porcentaje). Devuelve la cadena cruda —la validación vive en
 * pricing.js, que es puro—.
 *
 * Null-safe como getCustomerBrandColors: sin token, sin gid o sin metafield
 * devuelve null, que aguas arriba significa "precio de lista".
 * @param {Record<string, any>} env
 * @param {string|null|undefined} customerGid
 * @returns {Promise<string|null>}
 */
export async function getCustomerMarginRaw(env, customerGid) {
  if (isStubMode(env) || !customerGid) return null;
  const data = await adminFetch(env, CUSTOMER_MARGIN, {gid: customerGid});
  return data?.customer?.metafield?.value ?? null;
}

const VARIANT_COSTS = `
  query variantCosts($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        inventoryItem { unitCost { amount } }
      }
    }
  }
`;

// Límite de `nodes(ids:)` en Admin API.
const MAX_NODES = 250;

/**
 * Costo unitario de cada variante (`inventoryItem.unitCost`). Requiere el scope
 * read_inventory, que el token ya tiene. Devuelve un objeto plano y no un Map
 * porque el resultado pasa por la caché de Hydrogen, que serializa a JSON.
 * Una variante sin costo (nulo o 0) queda como null; una que no existe no
 * aparece.
 * @param {Record<string, any>} env
 * @param {string[]} variantIds
 * @returns {Promise<Record<string, number|null>>}
 */
export async function getVariantCosts(env, variantIds) {
  const out = {};
  const ids = [...new Set((variantIds || []).filter(Boolean))];
  if (isStubMode(env) || ids.length === 0) return out;
  for (let i = 0; i < ids.length; i += MAX_NODES) {
    const data = await adminFetch(env, VARIANT_COSTS, {ids: ids.slice(i, i + MAX_NODES)});
    for (const node of data?.nodes || []) {
      if (!node?.id) continue;
      const amount = Number(node.inventoryItem?.unitCost?.amount);
      out[node.id] = Number.isFinite(amount) && amount > 0 ? amount : null;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/admin/operations.test.js`
Expected: PASS (los existentes y los nuevos).

- [ ] **Step 5: Commit**

```bash
git add app/lib/admin/operations.js app/lib/admin/operations.test.js
git commit -m "feat(margen): lee custom.margen y el costo de variantes por Admin API"
```

---

### Task 3: Módulo de servidor de precios

**Files:**
- Create: `app/lib/pricing.server.js`
- Test: `app/lib/pricing.server.test.js`

**Interfaces:**
- Consumes: `getSessionUser(session)` de `./auth/session.js` → `{gid}|null`; `getCustomerMarginRaw`, `getVariantCosts` (Task 2); `parseMargin`, `customerPrice` (Task 1); `CacheShort` de `@shopify/hydrogen`; `context.withCache.run(opts, fn)`.
- Produces:
  - `getCustomerMargin(context): Promise<number|null>` — memo por request.
  - `resolveBasePrices(context, entries: {variantId: string, listPrice: number}[]): Promise<Map<string, number>>` — un precio base por variante; sin margen, la lista.
  - `applyCustomerPrices(context, data: T): Promise<T>` — copia de `data` con `price.amount` reescrito (string) en cada variante `gid://shopify/ProductVariant/...` que traiga `price.amount`, `compareAtPrice` en `null` en esas variantes, y `priceRange.minVariantPrice.amount` alineado con `variants.nodes[0]`. Sin margen devuelve `data` tal cual (misma referencia).

- [ ] **Step 1: Write the failing test**

`app/lib/pricing.server.test.js`:

```js
import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('@shopify/hydrogen', () => ({CacheShort: (o) => ({mode: 'short', ...o})}));

const getCustomerMarginRaw = vi.fn();
const getVariantCosts = vi.fn();
vi.mock('./admin/operations.js', () => ({
  getCustomerMarginRaw: (...a) => getCustomerMarginRaw(...a),
  getVariantCosts: (...a) => getVariantCosts(...a),
}));

const getSessionUser = vi.fn();
vi.mock('./auth/session.js', () => ({getSessionUser: (...a) => getSessionUser(...a)}));

import {getCustomerMargin, resolveBasePrices, applyCustomerPrices} from './pricing.server.js';

const opcionesDeCache = [];
const hazContexto = () => ({
  env: {PRIVATE_ADMIN_API_TOKEN: 't'},
  session: {},
  withCache: {
    run: (opciones, fn) => {
      opcionesDeCache.push(opciones);
      return fn();
    },
  },
});

const V = (n) => `gid://shopify/ProductVariant/${n}`;
const conMargen = (raw = '30') => {
  getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://shopify/Customer/1'});
  getCustomerMarginRaw.mockResolvedValue(raw);
};

beforeEach(() => {
  getCustomerMarginRaw.mockReset();
  getVariantCosts.mockReset();
  getSessionUser.mockReset();
  opcionesDeCache.length = 0;
});

describe('getCustomerMargin', () => {
  it('lee y valida el margen del cliente', async () => {
    conMargen('30.0');
    expect(await getCustomerMargin(hazContexto())).toBe(30);
  });

  it('la clave de caché lleva el gid del cliente', async () => {
    conMargen();
    await getCustomerMargin(hazContexto());
    expect(opcionesDeCache[0].cacheKey).toEqual(['gi-margin', 'gid://shopify/Customer/1']);
  });

  it('sin sesión o sin gid no toca la red', async () => {
    getSessionUser.mockReturnValue(null);
    expect(await getCustomerMargin(hazContexto())).toBeNull();
    getSessionUser.mockReturnValue({userId: 'u1', gid: null});
    expect(await getCustomerMargin(hazContexto())).toBeNull();
    expect(getCustomerMarginRaw).not.toHaveBeenCalled();
  });

  it('un valor inválido es lista, con aviso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    conMargen('100');
    expect(await getCustomerMargin(hazContexto())).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('si el Admin API falla es lista', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://x'});
    getCustomerMarginRaw.mockRejectedValue(new Error('caído'));
    expect(await getCustomerMargin(hazContexto())).toBeNull();
    error.mockRestore();
  });

  it('se lee una sola vez por request', async () => {
    conMargen();
    const ctx = hazContexto();
    await Promise.all([getCustomerMargin(ctx), getCustomerMargin(ctx)]);
    expect(getCustomerMarginRaw).toHaveBeenCalledTimes(1);
  });
});

describe('resolveBasePrices', () => {
  it('sin margen devuelve la lista y no pide costos', async () => {
    getSessionUser.mockReturnValue(null);
    const out = await resolveBasePrices(hazContexto(), [{variantId: V(1), listPrice: 50}]);
    expect(out.get(V(1))).toBe(50);
    expect(getVariantCosts).not.toHaveBeenCalled();
  });

  it('con margen calcula sobre el costo; sin costo, lista', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({[V(1)]: 100, [V(2)]: null});
    const out = await resolveBasePrices(hazContexto(), [
      {variantId: V(1), listPrice: 333.33},
      {variantId: V(2), listPrice: 50},
    ]);
    expect(out.get(V(1))).toBe(142.86);
    expect(out.get(V(2))).toBe(50);
  });

  it('si los costos fallan es lista', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    conMargen('30');
    getVariantCosts.mockRejectedValue(new Error('caído'));
    const out = await resolveBasePrices(hazContexto(), [{variantId: V(1), listPrice: 50}]);
    expect(out.get(V(1))).toBe(50);
    error.mockRestore();
  });
});

describe('applyCustomerPrices', () => {
  /* Forma de un producto de GiProductCard. */
  const producto = () => ({
    id: 'gid://shopify/Product/9',
    priceRange: {minVariantPrice: {amount: '333.33', currencyCode: 'MXN'}},
    options: [{name: 'color', optionValues: [{name: 'ROJO', firstSelectableVariant: {id: V(7)}}]}],
    variants: {
      nodes: [{id: V(1), price: {amount: '333.33', currencyCode: 'MXN'}, compareAtPrice: {amount: '400.0'}}],
    },
  });

  it('sin margen devuelve lo mismo y no pide costos', async () => {
    getSessionUser.mockReturnValue(null);
    const data = {nodes: [producto()]};
    expect(await applyCustomerPrices(hazContexto(), data)).toBe(data);
    expect(getVariantCosts).not.toHaveBeenCalled();
  });

  it('reescribe precio de variante y priceRange, y quita compareAtPrice', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({[V(1)]: 100});
    const data = {nodes: [producto()]};
    const out = await applyCustomerPrices(hazContexto(), data);
    const p = out.nodes[0];
    expect(p.variants.nodes[0].price).toEqual({amount: '142.86', currencyCode: 'MXN'});
    expect(p.variants.nodes[0].compareAtPrice).toBeNull();
    expect(p.priceRange.minVariantPrice).toEqual({amount: '142.86', currencyCode: 'MXN'});
    // El original no se toca.
    expect(data.nodes[0].variants.nodes[0].price.amount).toBe('333.33');
  });

  it('sólo pide costos de variantes con precio, en una sola consulta', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({});
    await applyCustomerPrices(hazContexto(), {a: [producto()], b: {x: producto()}});
    expect(getVariantCosts).toHaveBeenCalledTimes(1);
    // V(7) sólo trae id (firstSelectableVariant de la tarjeta): no se pide.
    expect(getVariantCosts.mock.calls[0][1]).toEqual([V(1)]);
  });

  it('la clave de caché de costos es la misma para cualquier cliente', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({});
    await applyCustomerPrices(hazContexto(), {nodes: [producto()]});
    const claveCostos = opcionesDeCache.find((o) => o.cacheKey[0] === 'gi-variant-costs').cacheKey;
    expect(claveCostos).toEqual(['gi-variant-costs', V(1)]);
  });

  it('sin costo deja la lista en esa variante', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({[V(1)]: null});
    const out = await applyCustomerPrices(hazContexto(), {nodes: [producto()]});
    expect(Number(out.nodes[0].variants.nodes[0].price.amount)).toBe(333.33);
  });

  it('nunca devuelve el costo', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({[V(1)]: 100});
    const out = await applyCustomerPrices(hazContexto(), {nodes: [producto()]});
    expect(JSON.stringify(out)).not.toMatch(/unitCost|inventoryItem|"100"/);
  });

  it('tolera null', async () => {
    conMargen('30');
    expect(await applyCustomerPrices(hazContexto(), null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/pricing.server.test.js`
Expected: FAIL — `Failed to resolve import "./pricing.server.js"`.

- [ ] **Step 3: Write minimal implementation**

`app/lib/pricing.server.js`:

```js
/* Generando Ideas — precio por cliente en servidor.
 *
 * Server-only: importa el cliente de Admin API. La fórmula vive en pricing.js.
 *
 * Dos lecturas con cachés distintas a propósito:
 *   - el margen depende del cliente: clave con su gid;
 *   - el costo no depende de quién mira: una entrada compartida por todos.
 * Sin margen no se pide ni un costo: el visitante anónimo y el cliente sin
 * margen no pagan nada por esta funcionalidad.
 */
import {CacheShort} from '@shopify/hydrogen';
import {getSessionUser} from './auth/session.js';
import {getCustomerMarginRaw, getVariantCosts} from './admin/operations.js';
import {parseMargin, customerPrice} from './pricing.js';

/* Memo por request, igual que en brand-colors.server.js: root y la ruta corren
   en paralelo y no deben pagar dos veces la misma lectura. */
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

async function leerMargen(context) {
  const usuario = getSessionUser(context.session);
  if (!usuario?.gid) return null;

  let raw;
  try {
    raw = await context.withCache.run(
      {
        // La clave lleva el gid: dos clientes con márgenes distintos nunca
        // comparten entrada.
        cacheKey: ['gi-margin', usuario.gid],
        cacheStrategy: CacheShort({maxAge: 300, staleWhileRevalidate: 300}),
        shouldCacheResult: (v) => v !== undefined,
      },
      () => getCustomerMarginRaw(context.env, usuario.gid),
    );
  } catch (error) {
    // Ninguna página se cae por el margen: sin él, precio de lista.
    console.error('[pricing] no se pudo leer custom.margen:', error);
    return null;
  }

  if (raw == null) return null;
  const margin = parseMargin(raw);
  if (margin == null) {
    console.warn(`[pricing] custom.margen inválido en ${usuario.gid}: ${raw}`);
  }
  return margin;
}

/**
 * El margen del cliente de esta request (porcentaje), o null si se le cobra el
 * precio de lista.
 * @param {any} context contexto de Hydrogen
 * @returns {Promise<number|null>}
 */
export function getCustomerMargin(context) {
  return memo(context, 'margin', () => leerMargen(context));
}

async function leerCostos(context, ids) {
  const unicos = [...new Set(ids.filter(Boolean))].sort();
  if (!unicos.length) return {};
  try {
    return await context.withCache.run(
      {
        // Sin gid en la clave: el costo es el mismo para todos los clientes.
        cacheKey: ['gi-variant-costs', ...unicos],
        cacheStrategy: CacheShort(),
        shouldCacheResult: (v) => Boolean(v) && typeof v === 'object',
      },
      () => getVariantCosts(context.env, unicos),
    );
  } catch (error) {
    console.error('[pricing] no se pudieron leer los costos:', error);
    return {};
  }
}

/**
 * Precio base de cada variante para el cliente de esta request. Es lo que la
 * cotización guarda como baseUnitPrice.
 * @param {any} context
 * @param {{variantId: string, listPrice: number}[]} entries
 * @returns {Promise<Map<string, number>>}
 */
export async function resolveBasePrices(context, entries) {
  const lista = (e) => Number(e.listPrice) || 0;
  const out = new Map(entries.map((e) => [e.variantId, lista(e)]));
  if (!entries.length) return out;
  const margin = await getCustomerMargin(context);
  if (margin == null) return out;
  const costos = await leerCostos(context, entries.map((e) => e.variantId));
  for (const e of entries) {
    out.set(e.variantId, customerPrice({cost: costos[e.variantId], margin, listPrice: lista(e)}));
  }
  return out;
}

const VARIANT_GID = 'gid://shopify/ProductVariant/';

function recorrer(nodo, visitar) {
  if (Array.isArray(nodo)) {
    for (const n of nodo) recorrer(n, visitar);
  } else if (nodo && typeof nodo === 'object') {
    visitar(nodo);
    for (const v of Object.values(nodo)) recorrer(v, visitar);
  }
}

const esVarianteConPrecio = (n) =>
  typeof n?.id === 'string' && n.id.startsWith(VARIANT_GID) && n.price?.amount != null;

/**
 * Reescribe con el precio del cliente cualquier respuesta cruda de Storefront:
 * tarjetas, ficha, recomendaciones, búsqueda predictiva. Encuentra las
 * variantes por su gid, así que no depende de la forma de cada consulta.
 *
 * Sin margen devuelve `data` intacto (misma referencia) y no hace consultas.
 * Con margen trabaja sobre una copia: la respuesta de Storefront puede venir de
 * una caché compartida y no se debe escribir encima.
 * @template T
 * @param {any} context
 * @param {T} data
 * @returns {Promise<T>}
 */
export async function applyCustomerPrices(context, data) {
  if (data == null) return data;
  const margin = await getCustomerMargin(context);
  if (margin == null) return data;

  const copia = structuredClone(data);
  const variantes = [];
  recorrer(copia, (n) => {
    if (esVarianteConPrecio(n)) variantes.push(n);
  });
  if (!variantes.length) return copia;

  const costos = await leerCostos(context, variantes.map((v) => v.id));
  for (const v of variantes) {
    const precio = customerPrice({
      cost: costos[v.id],
      margin,
      listPrice: Number(v.price.amount),
    });
    v.price = {...v.price, amount: String(precio)};
    // Tachar el precio de lista junto al del cliente no tiene sentido.
    if ('compareAtPrice' in v) v.compareAtPrice = null;
  }

  /* La tarjeta pinta priceRange.minVariantPrice (normalizeProduct). Se alinea
     con la variante que se acaba de preciar para que precio y costo hablen de
     la misma variante. */
  recorrer(copia, (n) => {
    const primera = n.variants?.nodes?.[0];
    if (n.priceRange?.minVariantPrice && esVarianteConPrecio(primera)) {
      n.priceRange = {
        ...n.priceRange,
        minVariantPrice: {...n.priceRange.minVariantPrice, amount: primera.price.amount},
      };
    }
  });
  return copia;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/pricing.server.test.js`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add app/lib/pricing.server.js app/lib/pricing.server.test.js
git commit -m "feat(margen): margen del cliente y costos en servidor, con caché"
```

---

### Task 4: Agregar y fusionar a la cotización con el precio del cliente

**Files:**
- Modify: `app/routes/api.quote.add.jsx` (imports y líneas ~57-60)
- Modify: `app/routes/api.quote.merge.jsx` (imports, línea ~107 y ~125)
- Test: `app/routes/api.quote.add.margen.test.js` (nuevo), `app/routes/api.quote.merge.test.js` (agregar mock y un test)

**Interfaces:**
- Consumes: `resolveBasePrices(context, entries)` (Task 3).
- Produces: nada nuevo; las líneas guardadas llevan `baseUnitPrice` del cliente.

- [ ] **Step 1: Write the failing tests**

`app/routes/api.quote.add.margen.test.js`:

```js
import {describe, it, expect, vi, beforeEach} from 'vitest';

const upsertQuoteItem = vi.fn();
const resolveBasePrices = vi.fn();
const storefrontQuery = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));
vi.mock('~/lib/auth/guard', () => ({
  requireUser: async () => ({userId: 'u1', sessionVersion: 1}),
}));
vi.mock('~/lib/quotes/repo', () => ({
  getOrCreateDraftQuote: async () => ({id: 'q1', userId: 'u1', status: 'draft'}),
  upsertQuoteItem: (...a) => upsertQuoteItem(...a),
  getQuoteWithItems: async () => ({quote: {id: 'q1'}, items: []}),
}));
vi.mock('~/lib/pricing.server', () => ({
  resolveBasePrices: (...a) => resolveBasePrices(...a),
}));

import {action} from './api.quote.add.jsx';

const V = 'gid://shopify/ProductVariant/1';

beforeEach(() => {
  upsertQuoteItem.mockReset();
  resolveBasePrices.mockReset();
  storefrontQuery.mockReset();
  storefrontQuery.mockResolvedValue({
    node: {
      id: V,
      title: 'Chica',
      price: {amount: '333.33'},
      image: null,
      product: {handle: 'taza', title: 'Taza', featuredImage: null, metafields: []},
    },
  });
});

function agregar() {
  const body = new FormData();
  body.set('variantId', V);
  body.set('qty', '10');
  return action({
    request: new Request('https://gi.test/api/quote/add', {method: 'POST', body}),
    context: {env: {}, storefront: {query: (...a) => storefrontQuery(...a)}},
  });
}

describe('api.quote.add con margen', () => {
  it('guarda el precio base que resuelve el margen del cliente', async () => {
    resolveBasePrices.mockResolvedValue(new Map([[V, 142.86]]));
    const res = await agregar();
    expect(res.status).toBe(200);
    expect(resolveBasePrices.mock.calls[0][1]).toEqual([{variantId: V, listPrice: 333.33}]);
    const guardado = upsertQuoteItem.mock.calls[0][2];
    expect(guardado.baseUnitPrice).toBe(142.86);
    expect(guardado.effectiveUnitPrice).toBe(142.86);
  });
});
```

En `app/routes/api.quote.merge.test.js`, junto a los demás `vi.mock` (antes del `import {action}`):

```js
const resolveBasePrices = vi.fn();
vi.mock('~/lib/pricing.server', () => ({
  resolveBasePrices: (...a) => resolveBasePrices(...a),
}));
```

En su `beforeEach` (si no hay uno, crearlo) agregar el default identidad, para que los tests existentes no cambien:

```js
beforeEach(() => {
  resolveBasePrices.mockReset();
  resolveBasePrices.mockImplementation(async (_ctx, entries) =>
    new Map(entries.map((e) => [e.variantId, e.listPrice])),
  );
});
```

Y un test nuevo al final:

```js
describe('merge con margen', () => {
  it('migra con el precio base del cliente, no con el de lista', async () => {
    storefrontQuery.mockResolvedValue({nodes: [nodo()]});
    getQuoteWithItems.mockResolvedValue({quote: {id: 'q1'}, items: []});
    resolveBasePrices.mockResolvedValue(new Map([['gid://v1', 60]]));
    await pedir([{variantId: 'gid://v1', qty: 5}]);
    expect(resolveBasePrices.mock.calls[0][1]).toEqual([{variantId: 'gid://v1', listPrice: 100}]);
    expect(migrados()[0].baseUnitPrice).toBe(60);
  });
});
```

(`nodo`, `pedir` y `migrados` ya existen en ese archivo.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/routes/api.quote.add.margen.test.js app/routes/api.quote.merge.test.js`
Expected: FAIL — `resolveBasePrices` nunca se llama (`mock.calls[0]` undefined) / `baseUnitPrice` 100 en vez de 60.

- [ ] **Step 3: Write minimal implementation**

`app/routes/api.quote.add.jsx` — agregar el import:

```js
import {resolveBasePrices} from '~/lib/pricing.server';
```

y reemplazar

```js
  const baseUnitPrice = Number(node.price?.amount) || 0;
```

por

```js
  // El precio base es el del cliente: costo / (1 − margen) si tiene
  // custom.margen, el de lista si no. Siempre del servidor, nunca del cliente.
  const listPrice = Number(node.price?.amount) || 0;
  const bases = await resolveBasePrices(context, [{variantId, listPrice}]);
  const baseUnitPrice = bases.get(variantId) ?? listPrice;
```

`app/routes/api.quote.merge.jsx` — agregar el import:

```js
import {resolveBasePrices} from '~/lib/pricing.server';
```

justo después de construir `porId` (tras `const porId = new Map(...)`):

```js
  // Una sola resolución para todo el lote, como la consulta de arriba.
  const bases = await resolveBasePrices(
    context,
    [...porId.values()].map((n) => ({variantId: n.id, listPrice: Number(n.price?.amount) || 0})),
  );
```

y en `recomputeItemPricing` reemplazar

```js
      baseUnitPrice: Number(node.price?.amount) || 0,
```

por

```js
      baseUnitPrice: bases.get(node.id) ?? (Number(node.price?.amount) || 0),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/routes/api.quote.add.margen.test.js app/routes/api.quote.merge.test.js`
Expected: PASS (los existentes de merge y los nuevos).

- [ ] **Step 5: Commit**

```bash
git add app/routes/api.quote.add.jsx app/routes/api.quote.merge.jsx app/routes/api.quote.add.margen.test.js app/routes/api.quote.merge.test.js
git commit -m "feat(margen): agregar y fusionar a la cotización con el precio del cliente"
```

---

### Task 5: Repreciar al volver a cotizar y al enviar

**Files:**
- Create: `app/lib/quotes/reprice.server.js`
- Test: `app/lib/quotes/reprice.server.test.js`
- Modify: `app/routes/api.quote.reorder.jsx`, `app/routes/api.quote.submit.jsx`
- Test: `app/routes/api.quote.submit.margen.test.js` (nuevo), `app/routes/api.quote.submit.cupon.test.js` (agregar mocks)

**Interfaces:**
- Consumes: `resolveBasePrices` (Task 3); `recomputeItemPricing({baseUnitPrice, technique, surface, size, qty})` de `./recompute.js` → `{error, baseUnitPrice, decorationTotal, effectiveUnitPrice}`; `upsertQuoteItem(db, quoteId, item)` de `repo.js` (con `item.id` existente actualiza).
- Produces: `repriceItems(context, items: Item[]): Promise<Item[]>` — mismo orden y longitud; un item cuya variante ya no existe o cuya decoración da error se devuelve sin cambios (misma referencia).

- [ ] **Step 1: Write the failing test for `repriceItems`**

`app/lib/quotes/reprice.server.test.js`:

```js
import {describe, it, expect, vi, beforeEach} from 'vitest';

const resolveBasePrices = vi.fn();
vi.mock('../pricing.server.js', () => ({
  resolveBasePrices: (...a) => resolveBasePrices(...a),
}));

import {repriceItems} from './reprice.server.js';

const V = (n) => `gid://shopify/ProductVariant/${n}`;
const item = (over = {}) => ({
  id: 'i1', variantId: V(1), qty: 10, technique: 'Sin decorado', surface: null, size: null,
  baseUnitPrice: 100, decorationTotal: 0, effectiveUnitPrice: 100, ...over,
});

const storefrontQuery = vi.fn();
const ctx = () => ({storefront: {query: (...a) => storefrontQuery(...a)}});

beforeEach(() => {
  resolveBasePrices.mockReset();
  storefrontQuery.mockReset();
});

describe('repriceItems', () => {
  it('recalcula con el precio de lista actual y el margen', async () => {
    storefrontQuery.mockResolvedValue({nodes: [{id: V(1), price: {amount: '120.0'}}]});
    resolveBasePrices.mockResolvedValue(new Map([[V(1), 90]]));
    const [out] = await repriceItems(ctx(), [item()]);
    expect(resolveBasePrices.mock.calls[0][1]).toEqual([{variantId: V(1), listPrice: 120}]);
    expect(out).toMatchObject({id: 'i1', baseUnitPrice: 90, effectiveUnitPrice: 90});
  });

  it('una variante que ya no existe conserva lo guardado', async () => {
    storefrontQuery.mockResolvedValue({nodes: [null]});
    resolveBasePrices.mockResolvedValue(new Map());
    const original = item();
    const [out] = await repriceItems(ctx(), [original]);
    expect(out).toBe(original);
  });

  it('si Storefront falla devuelve los items tal cual', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    storefrontQuery.mockRejectedValue(new Error('caído'));
    const items = [item()];
    expect(await repriceItems(ctx(), items)).toBe(items);
    error.mockRestore();
  });

  it('lista vacía no consulta', async () => {
    expect(await repriceItems(ctx(), [])).toEqual([]);
    expect(storefrontQuery).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/quotes/reprice.server.test.js`
Expected: FAIL — `Failed to resolve import "./reprice.server.js"`.

- [ ] **Step 3: Implement `repriceItems`**

`app/lib/quotes/reprice.server.js`:

```js
// Server-only. Vuelve a preciar líneas ya guardadas con el precio de lista
// ACTUAL y el margen ACTUAL del cliente. Lo usan "volver a cotizar" (la
// cotización vieja puede tener meses) y el envío (el borrador puede tener días
// y el margen o el costo pudieron cambiar entretanto).
import {recomputeItemPricing} from './recompute.js';
import {resolveBasePrices} from '../pricing.server.js';

const LIST_PRICES_QUERY = `#graphql
  query QuoteListPrices($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        price { amount }
      }
    }
  }
`;

/**
 * @param {any} context contexto de Hydrogen (storefront, env, session, withCache)
 * @param {Array<Record<string, any>>} items líneas con la forma de repo.js
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function repriceItems(context, items) {
  if (!items.length) return items;

  const ids = [...new Set(items.map((i) => i.variantId).filter(Boolean))];
  let nodes;
  try {
    ({nodes} = await context.storefront.query(LIST_PRICES_QUERY, {variables: {ids}}));
  } catch (error) {
    // Sin precio de lista actual no se reprecia: se sigue con lo guardado.
    console.error('[quote.reprice] no se pudo leer el precio de lista:', error);
    return items;
  }

  const vivas = (nodes || []).filter((n) => n?.id && n.price?.amount != null);
  const bases = await resolveBasePrices(
    context,
    vivas.map((n) => ({variantId: n.id, listPrice: Number(n.price.amount)})),
  );

  return items.map((item) => {
    // La variante se retiró de la tienda: se queda con el precio con que se cotizó.
    if (!bases.has(item.variantId)) return item;
    const priced = recomputeItemPricing({
      baseUnitPrice: bases.get(item.variantId),
      technique: item.technique,
      surface: item.surface,
      size: item.size,
      qty: item.qty,
    });
    if (priced.error) return item;
    return {
      ...item,
      baseUnitPrice: priced.baseUnitPrice,
      decorationTotal: priced.decorationTotal,
      effectiveUnitPrice: priced.effectiveUnitPrice,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/quotes/reprice.server.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing test for submit**

`app/routes/api.quote.submit.margen.test.js` (mismos mocks que `api.quote.submit.cupon.test.js`, más reprice y `upsertQuoteItem`):

```js
import {describe, it, expect, vi, beforeEach} from 'vitest';

const createDraftOrder = vi.fn();
const upsertQuoteItem = vi.fn();
const repriceItems = vi.fn();
const notifyQuoteSubmitted = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({execute: async () => ({rows: []})})}));
vi.mock('~/lib/auth/guard', () => ({
  requireUser: async () => ({userId: 'u1', sessionVersion: 1}),
}));
vi.mock('~/lib/auth/users', () => ({
  findById: async () => ({
    id: 'u1', email: 'cliente@empresa.com', firstName: 'A', lastName: 'B',
    shopifyCustomerGid: 'gid://shopify/Customer/1',
  }),
  setShopifyGid: async () => {},
}));
vi.mock('~/lib/admin/client', () => ({isStubMode: () => false}));
vi.mock('~/lib/admin/operations', () => ({
  createCustomer: async () => ({gid: 'gid://shopify/Customer/1'}),
  createDraftOrder: (...a) => createDraftOrder(...a),
  getCustomerAdvisor: async () => ({email: null, gid: null, handle: null, fields: {}}),
  setDraftOrderAdvisor: async () => {},
  getDiscountByCode: async () => ({ok: false}),
}));
vi.mock('~/lib/quotes/notify', () => ({
  notifyQuoteSubmitted: (...a) => notifyQuoteSubmitted(...a),
  resolveAdvisorRecipient: () => 'ventas@gi.test',
}));
vi.mock('~/lib/quotes/repo', () => ({
  getOrCreateDraftQuote: async () => ({id: 'q1', userId: 'u1', status: 'draft'}),
  getQuoteWithItems: async () => ({
    quote: {id: 'q1', notes: null, deadline: null, discountCode: null, discountPercentage: null},
    items: [{id: 'i1', variantId: 'gid://shopify/ProductVariant/1', title: 'Taza', qty: 10,
             baseUnitPrice: 100, decorationTotal: 0, effectiveUnitPrice: 100, technique: 'Sin decorado'}],
  }),
  markSubmitted: async () => ({folio: 'GI-0001'}),
  setQuoteDiscount: async () => {},
  upsertQuoteItem: (...a) => upsertQuoteItem(...a),
}));
vi.mock('~/lib/quotes/reprice.server', () => ({
  repriceItems: (...a) => repriceItems(...a),
}));

import {action} from './api.quote.submit.jsx';

beforeEach(() => {
  createDraftOrder.mockReset();
  createDraftOrder.mockResolvedValue({gid: 'gid://shopify/DraftOrder/1', invoiceUrl: 'https://x'});
  upsertQuoteItem.mockReset();
  notifyQuoteSubmitted.mockReset();
  repriceItems.mockReset();
  repriceItems.mockImplementation(async (_ctx, items) =>
    items.map((i) => ({...i, baseUnitPrice: 80, effectiveUnitPrice: 80})),
  );
});

function enviar() {
  return action({
    request: new Request('https://gi.test/api/quote/submit', {method: 'POST', body: new FormData()}),
    context: {env: {ENVIRONMENT: 'development'}},
  });
}

describe('api.quote.submit reprecia', () => {
  it('persiste el precio nuevo antes de crear la draft order', async () => {
    await enviar();
    expect(upsertQuoteItem).toHaveBeenCalledWith(
      expect.anything(), 'q1', expect.objectContaining({id: 'i1', effectiveUnitPrice: 80}),
    );
    expect(upsertQuoteItem.mock.invocationCallOrder[0]).toBeLessThan(
      createDraftOrder.mock.invocationCallOrder[0],
    );
  });

  it('la draft order y el correo llevan el precio nuevo', async () => {
    await enviar();
    const input = createDraftOrder.mock.calls[0][1];
    expect(JSON.stringify(input)).toMatch(/"amount":"?80/);
    expect(notifyQuoteSubmitted.mock.calls[0][1].items[0].effectiveUnitPrice).toBe(80);
  });
});
```

En `app/routes/api.quote.submit.cupon.test.js`, para que sus tests no dependan del repricing, agregar antes del `import {action}`:

```js
vi.mock('~/lib/quotes/reprice.server', () => ({repriceItems: async (_ctx, items) => items}));
```

y añadir `upsertQuoteItem: async () => {},` dentro de su `vi.mock('~/lib/quotes/repo', ...)`.

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run app/routes/api.quote.submit.margen.test.js`
Expected: FAIL — `upsertQuoteItem` no se llama.

- [ ] **Step 7: Wire `repriceItems` into submit and reorder**

`app/routes/api.quote.submit.jsx` — imports: agregar `upsertQuoteItem` al import de `~/lib/quotes/repo` y

```js
import {repriceItems} from '~/lib/quotes/reprice.server';
```

Cambiar

```js
  const {quote, items} = await getQuoteWithItems(db, draft.id);
  if (!quote || items.length === 0) {
    return Response.json({error: 'La cotización está vacía.'}, {status: 400});
  }
```

por

```js
  const {quote, items: guardados} = await getQuoteWithItems(db, draft.id);
  if (!quote || guardados.length === 0) {
    return Response.json({error: 'La cotización está vacía.'}, {status: 400});
  }

  /* Se reprecia con el precio de lista y el margen de HOY: el borrador pudo
     armarse hace días y el margen o el costo cambiar entretanto. Se persiste
     antes de la draft order para que lo guardado, la draft order, el PDF y los
     correos digan lo mismo. Si no se pudo repreciar, se sigue con lo guardado. */
  const items = await repriceItems(context, guardados);
  for (const [i, item] of items.entries()) {
    if (item !== guardados[i]) await upsertQuoteItem(db, quote.id, item);
  }
```

(El resto de la función ya usa `items`, así que la draft order y `notifyQuoteSubmitted` reciben los repreciados.)

`app/routes/api.quote.reorder.jsx` — agregar

```js
import {repriceItems} from '~/lib/quotes/reprice.server';
```

y reemplazar el bucle completo `for (const item of source.items) { ... }` por:

```js
  /* Al precio de HOY: la cotización de origen puede tener meses. Una variante
     retirada conserva su precio guardado (repriceItems no la toca). */
  const actuales = await repriceItems(context, source.items);
  for (const item of actuales) {
    const priced = recomputeItemPricing({
      baseUnitPrice: item.baseUnitPrice,
      technique: item.technique,
      surface: item.surface,
      size: item.size,
      qty: item.qty,
    });
    // Skip an item whose decoration no longer resolves (e.g. retired technique).
    if (priced.error) continue;
    await upsertQuoteItem(db, draft.id, {
      id: crypto.randomUUID(),
      quoteId: draft.id,
      variantId: item.variantId,
      productHandle: item.productHandle,
      title: item.title,
      qty: item.qty,
      image: item.image,
      baseUnitPrice: priced.baseUnitPrice,
      technique: item.technique,
      surface: item.surface,
      size: item.size,
      decorationTotal: priced.decorationTotal,
      effectiveUnitPrice: priced.effectiveUnitPrice,
    });
  }
```

y cambiar el comentario de cabecera ("Pricing is recomputed server-side from the persisted decoration inputs…") por:

```js
// Copy a past quote's items into the user's active draft ("Volver a cotizar").
// Base price is today's: current list price plus the customer's current margin
// (repriceItems); decoration is recomputed from the persisted inputs.
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run app/routes/api.quote.submit.margen.test.js app/routes/api.quote.submit.cupon.test.js app/lib/quotes/`
Expected: PASS (todos).

- [ ] **Step 9: Commit**

```bash
git add app/lib/quotes/reprice.server.js app/lib/quotes/reprice.server.test.js app/routes/api.quote.submit.jsx app/routes/api.quote.reorder.jsx app/routes/api.quote.submit.margen.test.js app/routes/api.quote.submit.cupon.test.js
git commit -m "feat(margen): reprecia al volver a cotizar y al enviar la cotización"
```

---

### Task 6: Precio del cliente en todas las superficies

**Files:**
- Modify: `app/routes/catalogo.jsx` (loader, ~línea 147-171), `app/routes/collections.$handle.jsx` (loader, ~línea 76-80), `app/routes/_index.jsx` (loadCriticalData, ~línea 40-56), `app/routes/account.favoritos.jsx` (loader, ~línea 48-55), `app/routes/products.$handle.jsx` (loadCriticalData, ~línea 79-121), `app/routes/search.jsx` (predictiveSearch, ~línea 413-441)
- Modify (mocks): `app/routes/_index.brandColors.test.js`, `app/routes/_index.giMkt.test.jsx`, `app/routes/catalogo.brandColors.test.js`, `app/routes/catalogo.paginacion.test.js`, `app/routes/collections.brandColors.test.js`, `app/routes/products.brandRedirect.test.js`, `app/routes/search.brandColors.test.js`, y cualquier otro test de loader que falle en el Step 2
- Test: `app/routes/precios.margen.test.js` (nuevo)

**Interfaces:**
- Consumes: `applyCustomerPrices(context, data)` (Task 3).
- Produces: loaders cuyos precios ya son los del cliente.

- [ ] **Step 1: Write the failing test**

`app/routes/precios.margen.test.js` — comprueba que cada loader pasa su respuesta por `applyCustomerPrices` (el mock marca lo que toca):

```js
import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('@shopify/hydrogen', async (importOriginal) => ({
  ...(await importOriginal()),
  getPaginationVariables: () => ({first: 24, endCursor: null}),
  Pagination: () => null,
}));
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: async () => null,
  getColorVocabulary: async () => null,
}));
vi.mock('~/lib/admin/operations', () => ({getVariantInventory: async () => null}));
vi.mock('~/lib/auth/guard', () => ({requireUser: async () => ({userId: 'u1'})}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({})}));
vi.mock('~/lib/wishlist/repo', () => ({listWishlist: async () => ['gid://shopify/Product/1']}));

const applyCustomerPrices = vi.fn();
vi.mock('~/lib/pricing.server', () => ({
  applyCustomerPrices: (...a) => applyCustomerPrices(...a),
  getCustomerMargin: async () => null,
}));

const storefrontQuery = vi.fn();
const context = {
  env: {},
  session: {},
  storefront: {query: (...a) => storefrontQuery(...a)},
};

const V = 'gid://shopify/ProductVariant/1';
const tarjeta = () => ({
  id: 'gid://shopify/Product/1', handle: 'taza', title: 'Taza', description: '', tags: [],
  featuredImage: {url: 'x.jpg'},
  priceRange: {minVariantPrice: {amount: '333.33', currencyCode: 'MXN'}},
  options: [], metafields: [],
  variants: {nodes: [{id: V, price: {amount: '333.33', currencyCode: 'MXN'}, image: null}]},
});

beforeEach(() => {
  storefrontQuery.mockReset();
  applyCustomerPrices.mockReset();
  // Marca lo que pasó por aquí: el precio sale como 1.
  applyCustomerPrices.mockImplementation(async (_ctx, data) =>
    JSON.parse(JSON.stringify(data).replaceAll('"333.33"', '"1"')),
  );
});

describe('los loaders muestran el precio del cliente', () => {
  it('catálogo', async () => {
    storefrontQuery.mockResolvedValue({
      search: {totalCount: 1, nodes: [tarjeta()], pageInfo: {}, productFilters: []},
    });
    const {loader} = await import('./catalogo.jsx');
    const out = await loader({context, request: new Request('https://gi.test/catalogo')});
    expect(out.products.nodes[0].variants.nodes[0].price.amount).toBe('1');
  });

  it('colección', async () => {
    storefrontQuery.mockResolvedValue({
      collection: {id: 'c', handle: 'tazas', title: 'Tazas', products: {nodes: [tarjeta()], pageInfo: {}}},
    });
    const {loader} = await import('./collections.$handle.jsx');
    const out = await loader({
      context, params: {handle: 'tazas'}, request: new Request('https://gi.test/collections/tazas'),
    });
    expect(out.collection.products.nodes[0].variants.nodes[0].price.amount).toBe('1');
  });

  it('favoritos', async () => {
    storefrontQuery.mockResolvedValue({nodes: [tarjeta()]});
    const {loader} = await import('./account.favoritos.jsx');
    const out = await loader({context});
    expect(out.products[0].price).toBe(1);
  });
});
```

Nota para quien implementa: si `account.favoritos.jsx` importa el repo de favoritos desde otra ruta que `~/lib/wishlist/repo`, ajusta ese `vi.mock` a la ruta real (`grep -n "listWishlist" app/routes/account.favoritos.jsx`). El home, el PDP y la búsqueda predictiva tienen loaders con más dependencias; se cubren con sus tests existentes (que deben seguir verdes) y con la verificación manual de la Task 8.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/routes/precios.margen.test.js`
Expected: FAIL — los precios siguen en `'333.33'`.

- [ ] **Step 3: Wire `applyCustomerPrices` into each loader**

En cada archivo, agregar:

```js
import {applyCustomerPrices} from '~/lib/pricing.server';
```

**`app/routes/catalogo.jsx`** — después de calcular `res` (la llamada a `buscar(...)`) y antes de `const coleccion = res?.collection;`:

```js
  // Precios del cliente (margen sobre costo) antes de que nada los lea.
  const res = await applyCustomerPrices(context, resCrudo);
```

renombrando la constante que hoy se llama `res` (la del `fuente.modo === 'coleccion' ? ... : ...`) a `resCrudo`.

**`app/routes/collections.$handle.jsx`** — reemplazar

```js
  const {collection} = await context.storefront.query(COLLECTION_QUERY, {
    variables: {handle, filters, ...paginationVariables},
  });
```

por

```js
  const {collection} = await applyCustomerPrices(
    context,
    await context.storefront.query(COLLECTION_QUERY, {
      variables: {handle, filters, ...paginationVariables},
    }),
  );
```

**`app/routes/_index.jsx`** — en el `Promise.all`, envolver la consulta de productos:

```js
    storefront
      .query(GI_PRODUCTS_QUERY, {variables: {first: 60, sortKey: 'BEST_SELLING'}})
      .then((r) => applyCustomerPrices(context, r)),
```

(sustituye a `storefront.query(GI_PRODUCTS_QUERY, {...})`; conservar el comentario que la precede).

**`app/routes/account.favoritos.jsx`** — reemplazar

```js
  const [{nodes}, marca] = await Promise.all([
    context.storefront.query(FAVORITOS_QUERY, {variables: {ids}}),
```

por

```js
  const [{nodes}, marca] = await Promise.all([
    context.storefront
      .query(FAVORITOS_QUERY, {variables: {ids}})
      .then((r) => applyCustomerPrices(context, r)),
```

**`app/routes/products.$handle.jsx`** — en `loadCriticalData`:

1. Reemplazar
   ```js
   const [{product}, marca] = await Promise.all([
     storefront.query(PRODUCT_QUERY, {
       variables: {handle, selectedOptions: getSelectedProductOptions(request)},
     }),
   ```
   por
   ```js
   const [{product}, marca] = await Promise.all([
     /* Todas las variantes que llegan al navegador —la seleccionada y las
        adyacentes con las que cambia de opción— salen ya con el precio del
        cliente. */
     storefront
       .query(PRODUCT_QUERY, {
         variables: {handle, selectedOptions: getSelectedProductOptions(request)},
       })
       .then((r) => applyCustomerPrices(context, r)),
   ```
2. En las recomendaciones, reemplazar
   ```js
   .then((r) =>
     (r?.productRecommendations || [])
   ```
   por
   ```js
   .then((r) => applyCustomerPrices(context, r))
   .then((r) =>
     (r?.productRecommendations || [])
   ```

**`app/routes/search.jsx`** — en `predictiveSearch`, reemplazar

```js
  const [{predictiveSearch: items, errors}, marca] = await Promise.all([
    storefront.query(PREDICTIVE_SEARCH_QUERY, {
      variables: {
        // customize search options as needed
        limit,
        limitScope: 'EACH',
        term,
      },
    }),
```

por

```js
  const [{predictiveSearch: items, errors}, marca] = await Promise.all([
    storefront
      .query(PREDICTIVE_SEARCH_QUERY, {
        variables: {
          // customize search options as needed
          limit,
          limitScope: 'EACH',
          term,
        },
      })
      .then((r) => applyCustomerPrices(context, r)),
```

- [ ] **Step 4: Run the new test**

Run: `npx vitest run app/routes/precios.margen.test.js`
Expected: PASS.

- [ ] **Step 5: Keep existing loader tests green**

Run: `npx vitest run app/routes`
Expected: los tests de loaders que no mockean `~/lib/pricing.server` fallan (su `context.session` es `{}` sin `.get`). En cada archivo que falle, agregar junto a sus otros `vi.mock`:

```js
vi.mock('~/lib/pricing.server', () => ({
  applyCustomerPrices: async (_ctx, data) => data,
  getCustomerMargin: async () => null,
}));
```

Volver a correr `npx vitest run app/routes` hasta que todo esté en verde.

- [ ] **Step 6: Commit**

```bash
git add app/routes
git commit -m "feat(margen): tarjetas, ficha y búsqueda con el precio del cliente"
```

---

### Task 7: Filtro de precio en precio del cliente

**Files:**
- Modify: `app/lib/filters.js:297` (`buildProductFilters`) y `:325-330`
- Modify: `app/routes/catalogo.jsx` (llamada a `buildProductFilters`, ~línea 129)
- Test: `app/lib/filters.test.js` (agregar al `describe('buildProductFilters')`), `app/routes/catalogo.brandColors.test.js` o `app/routes/precios.margen.test.js` (un test de la ruta)

**Interfaces:**
- Consumes: `toListRange` (Task 1); `getCustomerMargin(context)` (Task 3).
- Produces: `buildProductFilters(filters, colorFamilies = [], {colorObligatorio = false, margin = null} = {})`.

- [ ] **Step 1: Write the failing tests**

En `app/lib/filters.test.js`, dentro de `describe('buildProductFilters', ...)`:

```js
  it('sin margen manda el rango tal cual', () => {
    expect(buildProductFilters({precioMin: 0, precioMax: 100}, [])).toEqual([
      {price: {min: 0, max: 100}},
    ]);
  });

  it('con margen traduce el rango del cliente a precio de lista', () => {
    // margen 40: lista = cliente × 2
    expect(buildProductFilters({precioMin: 0, precioMax: 100}, [], {margin: 40})).toEqual([
      {price: {min: 0, max: 200}},
    ]);
    expect(buildProductFilters({precioMax: 50}, [], {margin: 40})).toEqual([
      {price: {max: 100}},
    ]);
  });
```

En `app/routes/precios.margen.test.js`, cambiar el mock de `~/lib/pricing.server` para que `getCustomerMargin` sea configurable:

```js
const getCustomerMargin = vi.fn(async () => null);
vi.mock('~/lib/pricing.server', () => ({
  applyCustomerPrices: (...a) => applyCustomerPrices(...a),
  getCustomerMargin: (...a) => getCustomerMargin(...a),
}));
```

y agregar:

```js
describe('filtro de precio con margen', () => {
  it('el catálogo pide a Shopify el rango traducido', async () => {
    getCustomerMargin.mockResolvedValue(40);
    storefrontQuery.mockResolvedValue({
      search: {totalCount: 0, nodes: [], pageInfo: {}, productFilters: []},
    });
    const {loader} = await import('./catalogo.jsx');
    await loader({context, request: new Request('https://gi.test/catalogo?precioMin=0&precioMax=100')});
    const [, {variables}] = storefrontQuery.mock.calls.at(-1);
    expect(variables.productFilters).toContainEqual({price: {min: 0, max: 200}});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/lib/filters.test.js app/routes/precios.margen.test.js`
Expected: FAIL — `{price: {min: 0, max: 100}}` en vez de `max: 200`.

- [ ] **Step 3: Implement**

`app/lib/filters.js` — import arriba del archivo:

```js
import {toListRange} from './pricing.js';
```

firma:

```js
export function buildProductFilters(
  filters,
  colorFamilies = [],
  {colorObligatorio = false, margin = null} = {},
) {
```

y el bloque de precio:

```js
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
```

Agregar a la JSDoc de `buildProductFilters` (si tiene) la línea `@param {number|null} [opciones.margin] margen del cliente; traduce el rango de precio`.

`app/routes/catalogo.jsx` — importar `getCustomerMargin` junto a `applyCustomerPrices`:

```js
import {applyCustomerPrices, getCustomerMargin} from '~/lib/pricing.server';
```

leer el margen junto a la paleta (reemplazar `const marca = await getBrandColors(context);`):

```js
  /* Paleta y margen en paralelo: sin `gid` ninguno toca la red, así que el
     visitante anónimo no paga nada por preguntar. */
  const [marca, margen] = await Promise.all([
    getBrandColors(context),
    getCustomerMargin(context),
  ]);
```

y pasarlo a `buildProductFilters`:

```js
  const productFilters = buildProductFilters(
    filtrosEfectivos,
    groupColorValues(vocabulario),
    {
      colorObligatorio: marcaColores.length > 0 && hayVocabulario(vocabulario),
      margin: margen,
    },
  );
```

El orden `PRICE` no se toca: con la relación proporcional, ordenar por lista es ordenar por precio del cliente.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/lib/filters.test.js app/routes`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add app/lib/filters.js app/lib/filters.test.js app/routes/catalogo.jsx app/routes/precios.margen.test.js
git commit -m "feat(margen): el filtro de precio del catálogo usa el precio del cliente"
```

---

### Task 8: Verificación completa

**Files:** ninguno nuevo.

- [ ] **Step 1: Suite completa y lint**

Run: `npx vitest run`
Expected: todo en verde, con más tests que la línea base (1054).

Run: `npx eslint app/lib/pricing.js app/lib/pricing.server.js app/lib/quotes/reprice.server.js app/lib/filters.js app/routes`
Expected: sin errores nuevos.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 3: Comprobar que el costo no viaja al navegador**

Run: `grep -rn "unitCost\|inventoryItem" app --include=*.jsx --include=*.js | grep -v "\.test\." | grep -v "app/lib/admin/operations.js"`
Expected: sin resultados.

- [ ] **Step 4: Prueba manual en la tienda de desarrollo**

Requiere que **el usuario** le cargue `custom.margen` (p. ej. `40`) a su customer de prueba en Shopify admin; no lo hace el agente. Con `npm run dev`:

1. Sin sesión: el catálogo muestra los mismos precios que antes.
2. Con sesión del customer con margen 40 (cerrar sesión y volver a entrar si el `gid` se enlazó hace poco): una tarjeta con lista $333.33 (costo ≈ $100) muestra ≈ $166.67.
3. La ficha muestra el mismo precio, sin precio tachado, y cambia bien al elegir otro color.
4. Filtro $0–$200 en el catálogo: todos los precios visibles caen en el rango; ordenar por precio ↑ queda en orden.
5. Agregar a la cotización, enviarla y abrir la draft order en Shopify admin: el precio unitario coincide con el que se vio.

- [ ] **Step 5: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(margen): ajustes de la verificación"
```
