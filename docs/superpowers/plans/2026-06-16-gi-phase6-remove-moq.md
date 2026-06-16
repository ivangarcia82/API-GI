# Phase 6: Quitar rangos/MOQ (cantidad desde 1) Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL — superpowers:executing-plans (read it before starting; execute tasks in order, stop at each checkpoint, never batch commits).

## Goal

Remove all minimum-order-quantity (MOQ) flooring, volume-tier UI, and "salto de 25 piezas" behavior from the storefront so a logged-in user can quote any product from quantity **1** with **±1** increments. The `moq` value and the `parseMoq` helper stay in the data model as informational metadata (available to code/analytics) but are **never** rendered and **never** force a minimum. The `volumeTiers` helper stays exported (legacy, may be removed later) but is no longer imported or used for pricing in any product surface.

This is per spec §10 and §16 decision 5: "`moq`: se conserva como dato, se elimina de toda la UI y de cualquier forzado de cantidad."

> Note: the `cotizacion.jsx` quantity stepper change (±25 → ±1) is handled in Phase 4, not here, to avoid a duplicate/conflicting edit of the same lines.

## Architecture

Phase 6 is purely a presentation-layer change. No server modules, no DB, no routes/loaders/actions are added. The edits touch:

- `app/lib/gi.js` — `normalizeProduct` keeps `moq` (informational); `parseMoq`/`volumeTiers` remain exported but `volumeTiers` is no longer consumed by any UI. No price path uses tiers.
- `app/routes/products.$handle.jsx` — initial `qty=1`, remove the volume-tier block + tier state, `min={1}`, ±1 stepper, drop "mínimo N pz" heading + "Saltos sugeridos de 25 piezas" hint + MOQ rows in the delivery grid and specs table.
- `app/components/gi/ProductCard.jsx` — quote/cart quantity uses `1` instead of `product.moq`; remove "MOQ {moq} pz" text in both list and grid views.
- `app/routes/cotizacion.jsx` — the ±25→±1 quantity stepper edit is owned exclusively by Phase 4 (not done here, to avoid a duplicate/conflicting edit of the same lines).
- `app/components/gi/HomeSections.jsx` — remove the "Mínimo {moq} piezas" spec row.
- `app/routes/collections.$handle.jsx` — remove the hardcoded "MOQ promedio 50" ticker.

## Tech Stack

- JS + JSX (no TypeScript). React Router 7 file-based routes, Hydrogen on Oxygen (workerd).
- Test runner: **VITEST** (added in Phase 1, config `vitest.config.js`). Command: `npx vitest run <path>`.
- These are presentational React components and a pure helper module. The only meaningfully unit-testable surface is `app/lib/gi.js` (pure functions, run under Node). JSX edits are verified by a **manual browser checklist** plus a repo-wide grep assertion, since rendering these components requires the full Hydrogen/Storefront context (workerd-only) and a fake render test would add no signal.
- Branch already exists: `feat/auth-decoration-quotes`. Conventional commits; every commit body ends with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## Task 1: Lock the data-model contract for `moq` (pure unit test)

Pin the invariant that `normalizeProduct` keeps `moq` as a number (informational) and that `parseMoq` still works, so later UI edits cannot accidentally drop the field. No production code changes are expected here — this is a regression guard written first.

**Files:**
- Modify: none expected (guard test only; `app/lib/gi.js` lines 73-143 are the subject under test).
- Test: `app/lib/gi.moq.test.js` (Create)

**Steps:**

- [ ] (1) Write the failing test. Create `app/lib/gi.moq.test.js`:

```js
import {describe, it, expect} from 'vitest';
import {parseMoq, normalizeProduct} from '~/lib/gi';

describe('parseMoq stays in the data model (informational only)', () => {
  it('parses "La compra mínima es de N piezas"', () => {
    expect(parseMoq('La compra mínima es de 144 piezas.')).toBe(144);
  });

  it('returns null when no minimum is present', () => {
    expect(parseMoq('Producto promocional sin texto de mínimo.')).toBe(null);
  });

  it('handles thousands separators', () => {
    expect(parseMoq('La compra mínima es de 1,000 piezas')).toBe(1000);
  });
});

describe('normalizeProduct keeps moq as a number', () => {
  const node = {
    id: 'gid://shopify/Product/1',
    handle: 'taza-promo',
    title: 'Taza Promo',
    description: 'La compra mínima es de 72 piezas.',
    priceRange: {minVariantPrice: {amount: '25.50', currencyCode: 'MXN'}},
    tags: [],
    options: [],
    variants: {nodes: []},
  };

  it('exposes the parsed moq value', () => {
    const p = normalizeProduct(node);
    expect(p.moq).toBe(72);
  });

  it('falls back to 50 when description has no minimum', () => {
    const p = normalizeProduct({...node, description: 'Sin minimo'});
    expect(p.moq).toBe(50);
  });

  it('still returns a valid normalized shape', () => {
    const p = normalizeProduct(node);
    expect(p).toMatchObject({
      id: 'gid://shopify/Product/1',
      handle: 'taza-promo',
      title: 'Taza Promo',
      price: 25.5,
      currency: 'MXN',
    });
  });
});
```

- [ ] (2) Run it expecting PASS-or-FAIL determination. Command:

```
npx vitest run app/lib/gi.moq.test.js
```

Expected: this test **PASSES immediately** because `gi.js` already implements `parseMoq` and `normalizeProduct` with the `moq` field (lines 73-82 and 141). This task is a guard, not red→green. If it FAILS, the `~/lib/gi` path alias is not resolved by vitest — confirm `vitest.config.js` (from Phase 1) maps `~` to `app/`; do not change `gi.js`. Expected passing output contains:

```
 ✓ app/lib/gi.moq.test.js (6 tests)
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

- [ ] (3) Minimal implementation: NONE. The behavior under test already exists in `app/lib/gi.js`. This guard test exists to fail loudly if a later edit removes `moq` from `normalizeProduct`. Do not edit production code in this step.

- [ ] (4) Re-run to confirm green:

```
npx vitest run app/lib/gi.moq.test.js
```

Expected: `Tests  6 passed (6)`.

- [ ] (5) Commit:

```
git add app/lib/gi.moq.test.js
git commit -m "test(gi): guard that moq stays informational in normalizeProduct

Pins the Phase 6 invariant: parseMoq and normalizeProduct keep moq as
a number for code/analytics while it is removed from all UI. Guards
against a later UI edit dropping the field.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Quantity from 1 + remove tiers/MOQ in PDP (`products.$handle.jsx`)

Default quantity becomes `1`, the volume-tier block and `tier` state are removed, the quantity input gets `min={1}` with ±1 steppers, and every MOQ/"mínimo" string is removed (heading, hint, delivery grid row, specs row). The import of `volumeTiers` is dropped.

**Files:**
- Modify: `app/routes/products.$handle.jsx` (line 16 import; 60-78 derived state; 69-72 useState; 168-227 price bar + tiers; 279-301 quantity; 419-466 delivery grid; 494-505 specs table)
- Test: none (presentational; verified by Task 5 grep + manual checklist)

**Steps:**

- [ ] (1) Write failing test: N/A. This is a JSX-only edit inside a route component that requires the Hydrogen/Storefront runtime to render. A unit render test would mock so much that it asserts nothing real. Verification is the repo-wide grep gate in Task 5 plus the manual browser checklist. Proceed directly to implementation.

- [ ] (2) Run-expecting-FAIL: N/A (no test for this task). The "failing" baseline is captured by Task 5's grep, which currently matches the strings we are about to remove.

- [ ] (3) Minimal implementation. Apply these exact before/after edits.

**Edit 3a — import (line 16):** drop `volumeTiers`.

BEFORE:
```jsx
import {formatPrice, parseMoq, volumeTiers, colorHex, TECHNIQUES} from '~/lib/gi';
```
AFTER:
```jsx
import {formatPrice, parseMoq, colorHex, TECHNIQUES} from '~/lib/gi';
```

**Edit 3b — derived pricing (lines 60-63):** keep `moq` (informational, unused in UI now) but stop computing `tiers`.

BEFORE:
```jsx
  const moq = parseMoq(product.description) || 50;
  const unit = selectedVariant?.price ? parseFloat(selectedVariant.price.amount) : null;
  const currency = selectedVariant?.price?.currencyCode || 'MXN';
  const tiers = unit ? volumeTiers(unit, moq) : [];
```
AFTER:
```jsx
  const unit = selectedVariant?.price ? parseFloat(selectedVariant.price.amount) : null;
  const currency = selectedVariant?.price?.currencyCode || 'MXN';
```

> Note: `moq` is no longer referenced anywhere in this file after the edits below, so its declaration is removed (the `parseMoq` export still lives in `gi.js` for analytics/other code). If a linter flags an unused `parseMoq` import, also drop `parseMoq` from the import in Edit 3a, leaving `import {formatPrice, colorHex, TECHNIQUES} from '~/lib/gi';`.

**Edit 3c — quantity state (line 69):** start at 1, remove the `tier` state (line 71).

BEFORE:
```jsx
  const [qty, setQty] = useState(moq);
  const [activeImg, setActiveImg] = useState(0);
  const [tier, setTier] = useState(0);
  const [hasFile, setHasFile] = useState(false);
```
AFTER:
```jsx
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [hasFile, setHasFile] = useState(false);
```

**Edit 3d — price math (lines 77-78):** there is no per-tier price; use `unit` directly.

BEFORE:
```jsx
  const isFav = favs.includes(product.id);
  const tierPrice = tiers[tier]?.price ?? unit;
  const total = tierPrice != null ? tierPrice * qty : null;
```
AFTER:
```jsx
  const isFav = favs.includes(product.id);
  const total = unit != null ? unit * qty : null;
```

**Edit 3e — price bar (lines 169-190):** drop the "Desde · N+ pz" tier label; show the unit price plainly.

BEFORE:
```jsx
            <div className="pdp-price-bar">
              <div>
                <div className="pdp-price-from">
                  Desde · {tiers[tier]?.qty ?? moq}+ pz
                </div>
                <div className="pdp-price">{formatPrice(tierPrice, currency)}</div>
              </div>
              <div style={{textAlign: 'right'}}>
                <div className="pdp-price-from">Total · {qty} pz</div>
```
AFTER:
```jsx
            <div className="pdp-price-bar">
              <div>
                <div className="pdp-price-from">Precio por pieza</div>
                <div className="pdp-price">{formatPrice(unit, currency)}</div>
              </div>
              <div style={{textAlign: 'right'}}>
                <div className="pdp-price-from">Total · {qty} pz</div>
```

The closing `{formatPrice(total, currency)}` block (lines 178-188) stays unchanged — `total` now derives from `unit`.

**Edit 3f — remove the volume-tier block entirely (lines 207-227).**

BEFORE:
```jsx
          {/* VOLUME TIERS */}
          {isLoggedIn && tiers.length > 0 && (
            <div className="pdp-section">
              <h3>Precio por volumen</h3>
              <div className="pdp-tiers">
                {tiers.map((t, i) => (
                  <button
                    key={i}
                    className={`pdp-tier ${tier === i ? 'active' : ''}`}
                    onClick={() => {
                      setTier(i);
                      setQty(t.qty);
                    }}
                  >
                    <span className="qty">{t.qty}+ pz</span>
                    <span className="pr">{formatPrice(t.price, currency)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* VARIANT OPTIONS (color/size as swatches) */}
```
AFTER:
```jsx
          {/* VARIANT OPTIONS (color/size as swatches) */}
```

**Edit 3g — quantity section (lines 280-300):** heading without "mínimo N pz", `min={1}`, ±1 steppers, no "Saltos sugeridos de 25 piezas".

BEFORE:
```jsx
          <div className="pdp-section">
            <h3>Cantidad · mínimo {moq} pz</h3>
            <div style={{display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
              <div className="pdp-qty">
                <button onClick={() => setQty(Math.max(moq, qty - 25))}>
                  <Icon name="minus" size={14} />
                </button>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(Math.max(moq, +e.target.value || moq))}
                  min={moq}
                />
                <button onClick={() => setQty(qty + 25)}>
                  <Icon name="plus" size={14} />
                </button>
              </div>
              <span style={{fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)'}}>
                Saltos sugeridos de 25 piezas
              </span>
            </div>
          </div>
```
AFTER:
```jsx
          <div className="pdp-section">
            <h3>Cantidad</h3>
            <div style={{display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
              <div className="pdp-qty">
                <button onClick={() => setQty(Math.max(1, qty - 1))}>
                  <Icon name="minus" size={14} />
                </button>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, +e.target.value || 1))}
                  min={1}
                />
                <button onClick={() => setQty(qty + 1)}>
                  <Icon name="plus" size={14} />
                </button>
              </div>
            </div>
          </div>
```

**Edit 3h — delivery grid (lines 430-433):** replace the MOQ row with a non-MOQ metric.

BEFORE:
```jsx
            {[
              {icon: 'truck', label: 'Producción', value: '8–15 días'},
              {icon: 'package', label: 'MOQ', value: `${moq} piezas`},
              {icon: 'shield', label: 'Garantía', value: 'Reposición s/c'},
            ].map((m) => (
```
AFTER:
```jsx
            {[
              {icon: 'truck', label: 'Producción', value: '8–15 días'},
              {icon: 'package', label: 'Personalización', value: 'Incluida'},
              {icon: 'shield', label: 'Garantía', value: 'Reposición s/c'},
            ].map((m) => (
```

**Edit 3i — specs table (line 499):** remove the MOQ row.

BEFORE:
```jsx
                <tr><td>Proveedor</td><td>{product.vendor || 'Generando Ideas'}</td></tr>
                <tr><td>MOQ</td><td>{moq} piezas</td></tr>
                <tr><td>Técnicas</td><td>{TECHNIQUES.map((t) => t.name).join(' · ')}</td></tr>
```
AFTER:
```jsx
                <tr><td>Proveedor</td><td>{product.vendor || 'Generando Ideas'}</td></tr>
                <tr><td>Técnicas</td><td>{TECHNIQUES.map((t) => t.name).join(' · ')}</td></tr>
```

- [ ] (4) Run test expecting PASS: N/A. Instead run the build/lint to confirm no broken references (no remaining `moq`/`tiers`/`tier` symbols):

```
npx eslint app/routes/products.\$handle.jsx
```

Expected: no errors. If ESLint reports `'parseMoq' is defined but never used`, apply the import fallback noted in Edit 3b.

- [ ] (5) Commit:

```
git add app/routes/products.\$handle.jsx
git commit -m "feat(pdp): quantity from 1, remove volume tiers and MOQ text

Default qty=1 with +/-1 stepper and min=1. Removes the volume-tier
block, tier state, the 'mínimo N pz' heading, the 'saltos de 25
piezas' hint, and the MOQ rows in the delivery grid and specs table.
volumeTiers import dropped. moq stays informational in gi.js only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Quantity 1 + remove MOQ text in `ProductCard.jsx`

The card-level add-to-cart and add-to-quote actions should use quantity `1` (not `product.moq`), and the "· MOQ {moq} pz" SKU suffix is removed in both list and grid views.

**Files:**
- Modify: `app/components/gi/ProductCard.jsx` (line 59 cart quantity; line 102 quote qty; lines 132-134 list-view SKU; lines 187-189 grid-view SKU)
- Test: none (presentational; verified by Task 5 grep + manual checklist)

**Steps:**

- [ ] (1) Write failing test: N/A — presentational component requiring `useApp`/`useNavigate`/Hydrogen context; verified by grep + manual checklist.

- [ ] (2) Run-expecting-FAIL: N/A.

- [ ] (3) Minimal implementation.

**Edit 3a — cart quantity (line 59):**

BEFORE:
```jsx
        inputs={{lines: [{merchandiseId: product.firstVariantId, quantity: product.moq}]}}
```
AFTER:
```jsx
        inputs={{lines: [{merchandiseId: product.firstVariantId, quantity: 1}]}}
```

**Edit 3b — quote quantity (line 102):**

BEFORE:
```jsx
          image: product.image,
          price: product.price,
          qty: product.moq,
        });
```
AFTER:
```jsx
          image: product.image,
          price: product.price,
          qty: 1,
        });
```

**Edit 3c — list-view SKU line (lines 132-134):**

BEFORE:
```jsx
          <div className="pcard-name">{product.title}</div>
          <div className="pcard-sku">
            {product.sku} · MOQ {product.moq} pz
          </div>
```
AFTER:
```jsx
          <div className="pcard-name">{product.title}</div>
          <div className="pcard-sku">{product.sku}</div>
```

**Edit 3d — grid-view SKU line (lines 187-189):**

BEFORE:
```jsx
        <div className="pcard-sku">
          {product.sku} · MOQ {product.moq} pz
        </div>
```
AFTER:
```jsx
        <div className="pcard-sku">{product.sku}</div>
```

- [ ] (4) Run test expecting PASS: N/A. Lint instead:

```
npx eslint app/components/gi/ProductCard.jsx
```

Expected: no errors.

- [ ] (5) Commit:

```
git add app/components/gi/ProductCard.jsx
git commit -m "feat(card): quantity 1 on add, remove MOQ pz text

Cart and quote adds now use quantity 1 instead of product.moq.
Removes the '· MOQ {moq} pz' suffix from the SKU line in both list
and grid views.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Remove "Mínimo N piezas" (HomeSections) and "MOQ promedio" ticker (collections)

Drop the minimum-piece spec row from the product spotlight and the hardcoded "MOQ promedio 50" ticker from the collection hero.

**Files:**
- Modify: `app/components/gi/HomeSections.jsx` (line 188 spec row)
- Modify: `app/routes/collections.$handle.jsx` (lines 74-77 ticker block)
- Test: none (presentational; verified by Task 5 grep + manual checklist)

**Steps:**

- [ ] (1) Write failing test: N/A — presentational components; verified by grep + manual checklist.

- [ ] (2) Run-expecting-FAIL: N/A.

- [ ] (3) Minimal implementation.

**Edit 3a — HomeSections spotlight specs (lines 185-190):** remove the "Mínimo" row.

BEFORE:
```jsx
  const specs = [
    {l: 'Material', v: product.vendor ? `Línea ${product.vendor}` : 'Premium'},
    {l: 'Personalización', v: 'Láser / Serigrafía'},
    {l: 'Mínimo', v: `${product.moq} piezas`},
    {l: 'Entrega', v: '8–15 días'},
  ];
```
AFTER:
```jsx
  const specs = [
    {l: 'Material', v: product.vendor ? `Línea ${product.vendor}` : 'Premium'},
    {l: 'Personalización', v: 'Láser / Serigrafía'},
    {l: 'Entrega', v: '8–15 días'},
  ];
```

**Edit 3b — collections hero ticker (lines 74-77):** remove the MOQ ticker, keeping Productos and Producción.

BEFORE:
```jsx
            <div>
              <div className="n ticker">{products.length}+</div>
              <div className="l">Productos</div>
            </div>
            <div>
              <div className="n ticker">50</div>
              <div className="l">MOQ promedio</div>
            </div>
            <div>
              <div className="n ticker">8–12d</div>
              <div className="l">Producción</div>
            </div>
```
AFTER:
```jsx
            <div>
              <div className="n ticker">{products.length}+</div>
              <div className="l">Productos</div>
            </div>
            <div>
              <div className="n ticker">8–12d</div>
              <div className="l">Producción</div>
            </div>
```

- [ ] (4) Run test expecting PASS: N/A. Lint both files:

```
npx eslint app/components/gi/HomeSections.jsx app/routes/collections.\$handle.jsx
```

Expected: no errors.

- [ ] (5) Commit:

```
git add app/components/gi/HomeSections.jsx app/routes/collections.\$handle.jsx
git commit -m "feat(home,collections): remove MOQ spec row and ticker

Drops 'Mínimo N piezas' from the product spotlight and the hardcoded
'MOQ promedio 50' ticker from the collection hero.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Verification gate — grep guard + manual browser checklist

Confirm no user-facing MOQ/mínimo/tier strings remain in the touched UI, that the guard test still passes, and walk the live UI to confirm quantity-from-1 behavior.

**Files:**
- Modify: none
- Test: `app/lib/gi.moq.test.js` (re-run, from Task 1)

**Steps:**

- [ ] (1) Re-run the data-model guard test:

```
npx vitest run app/lib/gi.moq.test.js
```

Expected: `Tests  6 passed (6)` — proves `moq`/`parseMoq` survive in the data model.

- [ ] (2) Grep guard: assert no MOQ/mínimo/tier UI strings remain in the four touched files. Run:

```
grep -nE "MOQ|[Mm][ií]nimo|volumeTiers|pdp-tier|Saltos sugeridos|setTier|tiers\[" app/routes/products.\$handle.jsx app/components/gi/ProductCard.jsx app/components/gi/HomeSections.jsx app/routes/collections.\$handle.jsx
```

Expected output: **no matches** (grep exits non-zero). If any line matches, it was missed in Tasks 2-4 — fix it and amend the corresponding commit before proceeding.

- [ ] (3) Confirm `volumeTiers` is no longer imported anywhere (it stays exported in `gi.js` as legacy):

```
grep -rn "volumeTiers" app/ --include="*.jsx" --include="*.js"
```

Expected: the only match is the `export function volumeTiers` definition in `app/lib/gi.js` (and no `import { … volumeTiers … }` lines).

- [ ] (4) Run the project build to confirm no broken references across the bundle:

```
npm run build
```

Expected: build completes with exit code 0, no "is not exported" / "is not defined" errors referencing `moq`, `tier`, or `volumeTiers`.

- [ ] (5) Manual browser verification checklist. Start the dev server (`npm run dev`) and confirm each item against a logged-in session:

  - [ ] PDP (`/products/<handle>`): quantity input shows **1** on load; the **−** button at qty 1 keeps it at 1 (no negative, no jump to a MOQ floor); **+** raises it to **2** (step of 1); typing `7` keeps `7`; typing `0` or blank coerces to `1`.
  - [ ] PDP: there is **no** "Precio por volumen" tier block, **no** "Cantidad · mínimo N pz" heading (heading reads just "Cantidad"), and **no** "Saltos sugeridos de 25 piezas" hint.
  - [ ] PDP: the delivery grid shows no "MOQ … piezas" cell; the Especificaciones tab table has no "MOQ" row.
  - [ ] PDP: "Total · {qty} pz" updates as unit price × qty.
  - [ ] Product card (catalog/grid + list views): the SKU line shows only the SKU, **no** "· MOQ N pz". Adding to cotización from a card adds the item at qty **1**.
  - [ ] Home spotlight: the spec list shows Material / Personalización / Entrega and **no** "Mínimo N piezas" row.
  - [ ] Collection page (`/collections/<handle>`): the hero stats show Productos and Producción only, **no** "MOQ promedio" ticker.

- [ ] (6) Commit (verification artifacts only — no code change expected; if Task 5 found and fixed a miss, that fix was already amended into its task commit, so this step is a no-op unless the guard test itself changed). If nothing changed, skip the commit. If the grep guard required adding cases to the test, commit:

```
git add app/lib/gi.moq.test.js
git commit -m "test(gi): tighten moq data-model guard after Phase 6 verification

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
