# Phase 4: Cotizaciones persistentes -> draft orders Implementation Plan

> ⚠️ DEPENDENCY — READ FIRST. This phase does NOT create the decoration engine. It IMPORTS `calcDecoration` / `effectiveUnitPrice` / `round2` from `app/lib/decoration/engine.js`, which is created in **Phase 5**, and it IMPORTS `createCustomer` / `createDraftOrder` (`app/lib/admin/operations.js`) and `isStubMode` (`app/lib/admin/client.js`) from `app/lib/admin/*`, created in **Phase 2**. Per the INDEX execution order, **Phase 5's pure engine and Phase 2 are built BEFORE this phase**, so these symbols already exist when Phase 4 runs. Do NOT (re)create `engine.js` or `app/lib/admin/*` here — only consume them.

> For agentic workers: REQUIRED SUB-SKILL — superpowers:test-driven-development. Follow the red-green-commit loop on every task: write a failing test, run it and SEE it fail, write the minimal code, run it and SEE it pass, then commit. Never skip the failing-test step. Never write implementation before the test.

## Goal

Persist quotes in Turso as a single per-user `draft` quote (get-or-create, enforced by the partial unique index `idx_one_draft_per_user` created in Phase 1's `migrate`), expose server-only quote actions (`add`/`update`/`remove`/`submit`) that recompute prices server-side via the decoration engine, and convert a submitted quote into a Shopify draft order via the Admin API (`createDraftOrder`). Wire the real submit into `cotizacion.jsx` (folio + invoice link) and add the `account.cotizaciones` list/detail routes. Quantity controls become +/-1 with a minimum of 1.

## Architecture

- `app/lib/quotes/repo.js` — server-only libSQL repo (Quote/Item shapes per the frozen contract). Uses the per-request client from `getDb(env)`. `getOrCreateDraftQuote` relies on the partial unique index and catches the unique violation to re-select.
- `app/routes/api.quote.{add,update,remove,submit}.jsx` — React Router actions. Each FIRST calls `assertSameOrigin(request)` then `requireUser(context)`. Add/update accept ONLY `{variantId, technique, surface, size, qty}`; the server recomputes `baseUnitPrice` (Storefront), `decorationTotal`, `effectiveUnitPrice` (decoration engine, Phase 5). Client-sent prices are NEVER persisted.
- `submit` builds a `DraftOrderInput` and calls `createDraftOrder(env, input)` (Phase 2); lazily reconciles a null/STUB customer gid via `createCustomer` + `setShopifyGid`; then `markSubmitted`. Uses a libSQL `batch()` to collapse reads/writes into one round-trip (subrequest budget).
- `app/routes/cotizacion.jsx` — replaces the fake `setTimeout` submit with a real POST to `/api/quote/submit`; shows folio (`quote.id`) and a real `invoiceUrl` link when present. Qty +/-1, minimum 1.
- `app/routes/account.cotizaciones._index.jsx` + `account.cotizaciones.$id.jsx` — list/history loaders from Turso (`listUserQuotes`, `getQuoteWithItems`).

> Client/server quote reconciliation (Phase 7). In this phase `cotizacion.jsx` still renders from the client-side `AppContext` quote (localStorage), while `/api/quote/submit` reads the items from the SERVER draft. The two are reconciled in **Phase 7**: `AppContext.quote` becomes a server fetcher and `cotizacion.jsx` hydrates from the server draft keyed by `item.id`, so what the user sees and what submit reads are the same items. Until Phase 7 lands, treat the server draft as the source of truth for submit.

## Tech Stack

- JS + JSX (no TypeScript). React Router 7 file-based routes.
- Hydrogen on Oxygen (workerd). libSQL via `import {createClient} from '@libsql/client/web'` (bare import forbidden).
- VITEST for tests: `npx vitest run <path>`. Config `vitest.config.js` (added Phase 1, task 0).
- Money stored raw; `round2(n) = Math.round(n*100)/100`; format only at render.
- Branch `feat/auth-decoration-quotes`. Conventional commits; every commit body ends with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Frozen symbols this phase USES (do not redefine)

- `getDb(env)` — `app/lib/db/client.js`
- `migrate(db)` and the table/index DDL incl. `idx_one_draft_per_user` — `app/lib/db/migrate.js`
- `requireUser(context)` — `app/lib/auth/guard.js`
- `assertSameOrigin(request)` — `app/lib/http/csrf.js`
- `createCustomer(env, {...})`, `createDraftOrder(env, input)` — `app/lib/admin/operations.js` (created in Phase 2; imported here, NOT created here)
- `isStubMode(env)` — `app/lib/admin/client.js` (created in Phase 2; imported here, NOT created here)
- `setShopifyGid(db, id, gid)`, `findById(db, id)` — `app/lib/auth/users.js`
- `calcDecoration(...)`, `effectiveUnitPrice(...)`, `round2(n)` — `app/lib/decoration/engine.js` (created in Phase 5; imported here, NOT created here)

---

## Task 1: `app/lib/quotes/repo.js` — quote/item repository

Pure-DB module. Unit-test the SQL/parse/idempotency logic against an in-memory libSQL client (`createClient({url: ':memory:'})` works under Node in vitest — `@libsql/client/web` resolves to the local-capable build; if `:memory:` is unavailable in the `/web` entry under Node, the test uses `file::memory:?cache=shared`). Apply the Phase 1 `migrate` schema before each test.

### Files
- Create: `app/lib/quotes/repo.js`
- Test: `app/lib/quotes/repo.test.js`

### Steps

- [ ] Write the failing test. COMPLETE contents of `app/lib/quotes/repo.test.js`:

```js
import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client/web';
import {migrate} from '../db/migrate.js';
import {
  getOrCreateDraftQuote,
  upsertQuoteItem,
  removeQuoteItem,
  clearQuote,
  getQuoteWithItems,
  listUserQuotes,
  markSubmitted,
} from './repo.js';

const USER = 'user-1';

async function makeDb() {
  const db = createClient({url: 'file::memory:?cache=shared'});
  await migrate(db);
  // satisfy the FK users(id): insert a minimal user row.
  await db.execute({
    sql: `INSERT INTO users (id,email,password_hash,password_salt,password_iterations,session_version,role,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [USER, 'u1@example.com', 'h', 's', 100000, 1, 'quoter', '2026-06-16T00:00:00Z', '2026-06-16T00:00:00Z'],
  });
  return db;
}

function sampleItem(over = {}) {
  return {
    variantId: 'gid://shopify/ProductVariant/1',
    productHandle: 'taza-clasica',
    title: 'Taza clásica',
    qty: 300,
    baseUnitPrice: 25,
    technique: 'SERIGRAFÍA',
    surface: 'TEXTIL',
    size: '4 x 4',
    decorationTotal: 1491.0447761194,
    effectiveUnitPrice: 29.97,
    ...over,
  };
}

describe('quotes/repo', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('getOrCreateDraftQuote is idempotent (one draft per user)', async () => {
    const a = await getOrCreateDraftQuote(db, USER);
    const b = await getOrCreateDraftQuote(db, USER);
    expect(a.id).toBe(b.id);
    expect(a.status).toBe('draft');
    expect(a.userId).toBe(USER);
    const rows = await db.execute({
      sql: `SELECT COUNT(*) AS c FROM quotes WHERE user_id=? AND status='draft'`,
      args: [USER],
    });
    expect(Number(rows.rows[0].c)).toBe(1);
  });

  it('upsert/remove/clear items and read them back', async () => {
    const q = await getOrCreateDraftQuote(db, USER);
    const item = {id: 'item-1', quoteId: q.id, ...sampleItem()};
    await upsertQuoteItem(db, q.id, item);
    let got = await getQuoteWithItems(db, q.id);
    expect(got.items).toHaveLength(1);
    expect(got.items[0].variantId).toBe('gid://shopify/ProductVariant/1');
    expect(got.items[0].effectiveUnitPrice).toBe(29.97);

    // upsert same id updates qty, does not duplicate
    await upsertQuoteItem(db, q.id, {...item, qty: 500});
    got = await getQuoteWithItems(db, q.id);
    expect(got.items).toHaveLength(1);
    expect(got.items[0].qty).toBe(500);

    await removeQuoteItem(db, q.id, 'item-1');
    got = await getQuoteWithItems(db, q.id);
    expect(got.items).toHaveLength(0);

    await upsertQuoteItem(db, q.id, {id: 'item-2', quoteId: q.id, ...sampleItem()});
    await clearQuote(db, q.id);
    got = await getQuoteWithItems(db, q.id);
    expect(got.items).toHaveLength(0);
  });

  it('listUserQuotes returns quotes for the user', async () => {
    const q = await getOrCreateDraftQuote(db, USER);
    const list = await listUserQuotes(db, USER);
    expect(list.map((x) => x.id)).toContain(q.id);
  });

  it('markSubmitted sets gid, invoiceUrl and status', async () => {
    const q = await getOrCreateDraftQuote(db, USER);
    await markSubmitted(db, q.id, {
      gid: 'gid://shopify/DraftOrder/9',
      invoiceUrl: 'https://shop.example/invoice/9',
    });
    const {quote} = await getQuoteWithItems(db, q.id);
    expect(quote.status).toBe('submitted');
    expect(quote.shopifyDraftOrderGid).toBe('gid://shopify/DraftOrder/9');
    expect(quote.shopifyInvoiceUrl).toBe('https://shop.example/invoice/9');
    // submitting frees the draft slot: a new getOrCreate makes a fresh draft
    const q2 = await getOrCreateDraftQuote(db, USER);
    expect(q2.id).not.toBe(q.id);
  });
});
```

- [ ] Run it expecting FAIL. Command: `npx vitest run app/lib/quotes/repo.test.js`
  Expected output: fails to resolve `./repo.js` (module not found) — e.g. `Error: Failed to load url ./repo.js` / `Cannot find module`.

- [ ] Minimal implementation. COMPLETE contents of `app/lib/quotes/repo.js`:

```js
// Server-only: persistence for quotes and quote items (Turso / libSQL).
// Quote shape: {id,userId,status,notes,deadline,shopifyDraftOrderGid,shopifyInvoiceUrl}
// Item shape:  {id,quoteId,variantId,productHandle,title,qty,baseUnitPrice,technique,surface,size,decorationTotal,effectiveUnitPrice}

function nowIso() {
  return new Date().toISOString();
}

function isUniqueViolation(err) {
  const msg = String(err && (err.message || err)) || '';
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(msg);
}

function mapQuoteRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    status: r.status,
    notes: r.notes ?? null,
    deadline: r.deadline ?? null,
    shopifyDraftOrderGid: r.shopify_draft_order_gid ?? null,
    shopifyInvoiceUrl: r.shopify_invoice_url ?? null,
  };
}

function mapItemRow(r) {
  return {
    id: r.id,
    quoteId: r.quote_id,
    variantId: r.variant_id,
    productHandle: r.product_handle ?? null,
    title: r.title ?? null,
    qty: Number(r.qty),
    baseUnitPrice: Number(r.base_unit_price),
    technique: r.technique ?? null,
    surface: r.surface ?? null,
    size: r.size ?? null,
    decorationTotal: Number(r.decoration_total),
    effectiveUnitPrice: Number(r.effective_unit_price),
  };
}

async function selectDraft(db, userId) {
  const res = await db.execute({
    sql: `SELECT * FROM quotes WHERE user_id=? AND status='draft' LIMIT 1`,
    args: [userId],
  });
  return mapQuoteRow(res.rows[0]);
}

export async function getOrCreateDraftQuote(db, userId) {
  const existing = await selectDraft(db, userId);
  if (existing) return existing;
  const id = crypto.randomUUID();
  const ts = nowIso();
  try {
    await db.execute({
      sql: `INSERT INTO quotes (id,user_id,status,created_at,updated_at) VALUES (?,?,'draft',?,?)`,
      args: [id, userId, ts, ts],
    });
    return {
      id,
      userId,
      status: 'draft',
      notes: null,
      deadline: null,
      shopifyDraftOrderGid: null,
      shopifyInvoiceUrl: null,
    };
  } catch (err) {
    // Lost the race against idx_one_draft_per_user: re-select the winning draft.
    if (isUniqueViolation(err)) {
      const winner = await selectDraft(db, userId);
      if (winner) return winner;
    }
    throw err;
  }
}

export async function upsertQuoteItem(db, quoteId, item) {
  const ts = nowIso();
  await db.execute({
    sql: `INSERT INTO quote_items
            (id,quote_id,variant_id,product_handle,title,qty,base_unit_price,technique,surface,size,decoration_total,effective_unit_price,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            variant_id=excluded.variant_id,
            product_handle=excluded.product_handle,
            title=excluded.title,
            qty=excluded.qty,
            base_unit_price=excluded.base_unit_price,
            technique=excluded.technique,
            surface=excluded.surface,
            size=excluded.size,
            decoration_total=excluded.decoration_total,
            effective_unit_price=excluded.effective_unit_price`,
    args: [
      item.id,
      quoteId,
      item.variantId,
      item.productHandle ?? null,
      item.title ?? null,
      item.qty,
      item.baseUnitPrice,
      item.technique ?? null,
      item.surface ?? null,
      item.size ?? null,
      item.decorationTotal ?? 0,
      item.effectiveUnitPrice,
      ts,
    ],
  });
  await db.execute({
    sql: `UPDATE quotes SET updated_at=? WHERE id=?`,
    args: [ts, quoteId],
  });
}

export async function removeQuoteItem(db, quoteId, itemId) {
  await db.execute({
    sql: `DELETE FROM quote_items WHERE quote_id=? AND id=?`,
    args: [quoteId, itemId],
  });
  await db.execute({
    sql: `UPDATE quotes SET updated_at=? WHERE id=?`,
    args: [nowIso(), quoteId],
  });
}

export async function clearQuote(db, quoteId) {
  await db.execute({
    sql: `DELETE FROM quote_items WHERE quote_id=?`,
    args: [quoteId],
  });
  await db.execute({
    sql: `UPDATE quotes SET updated_at=? WHERE id=?`,
    args: [nowIso(), quoteId],
  });
}

export async function getQuoteWithItems(db, quoteId) {
  const qRes = await db.execute({
    sql: `SELECT * FROM quotes WHERE id=? LIMIT 1`,
    args: [quoteId],
  });
  const quote = mapQuoteRow(qRes.rows[0]);
  if (!quote) return {quote: null, items: []};
  const iRes = await db.execute({
    sql: `SELECT * FROM quote_items WHERE quote_id=? ORDER BY created_at ASC`,
    args: [quoteId],
  });
  return {quote, items: iRes.rows.map(mapItemRow)};
}

export async function listUserQuotes(db, userId) {
  const res = await db.execute({
    sql: `SELECT * FROM quotes WHERE user_id=? ORDER BY created_at DESC`,
    args: [userId],
  });
  return res.rows.map(mapQuoteRow);
}

export async function markSubmitted(db, quoteId, {gid, invoiceUrl}) {
  await db.execute({
    sql: `UPDATE quotes
          SET status='submitted', shopify_draft_order_gid=?, shopify_invoice_url=?, updated_at=?
          WHERE id=?`,
    args: [gid ?? null, invoiceUrl ?? null, nowIso(), quoteId],
  });
}
```

- [ ] Run test expecting PASS. Command: `npx vitest run app/lib/quotes/repo.test.js`
  Expected output: `Test Files  1 passed (1)` with all 5 tests passing.

- [ ] Commit:
```
git add app/lib/quotes/repo.js app/lib/quotes/repo.test.js
git commit -m "feat(quotes): add quotes/repo with get-or-create draft idempotency

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `buildDraftOrderInput` helper + `api.quote.submit.jsx` action

Extract the pure mapping from quote items to `DraftOrderInput` into a testable helper so the "submit maps items to draft input correctly" test can run as a real unit test. The route action reads buyer `notes`/`deadline` from the submitted form body and PERSISTS them onto the draft (`quotes.notes` / `quotes.deadline`) BEFORE reading the quote back and building the `DraftOrderInput` — otherwise `quote.notes` is never written and the buyer's notes/deadline are dropped. It then wires the helper to `createDraftOrder` (mocked in tests), a lazy gid reconcile, and the libSQL `batch()` status write (`markSubmitted` semantics). The route itself is workerd-only, so it gets a MANUAL verification step.

### Files
- Create: `app/lib/quotes/draftInput.js`
- Create: `app/routes/api.quote.submit.jsx`
- Test: `app/lib/quotes/draftInput.test.js`

### Steps

- [ ] Write the failing test. COMPLETE contents of `app/lib/quotes/draftInput.test.js`:

```js
import {describe, it, expect} from 'vitest';
import {buildDraftOrderInput} from './draftInput.js';

const QUOTE = {
  id: 'q-1',
  userId: 'user-1',
  status: 'draft',
  notes: 'Para evento de junio',
  deadline: null,
  shopifyDraftOrderGid: null,
  shopifyInvoiceUrl: null,
};

const ITEMS = [
  {
    id: 'i-1',
    quoteId: 'q-1',
    variantId: 'gid://shopify/ProductVariant/111',
    productHandle: 'taza',
    title: 'Taza clásica',
    qty: 300,
    baseUnitPrice: 25,
    technique: 'SERIGRAFÍA',
    surface: 'TEXTIL',
    size: '4 x 4',
    decorationTotal: 1491.0447761194,
    effectiveUnitPrice: 29.97,
  },
  {
    id: 'i-2',
    quoteId: 'q-1',
    variantId: 'gid://shopify/ProductVariant/222',
    productHandle: 'pluma',
    title: 'Pluma metálica',
    qty: 50,
    baseUnitPrice: 12.5,
    technique: 'Sin decorado',
    surface: '',
    size: '',
    decorationTotal: 0,
    effectiveUnitPrice: 12.5,
  },
];

describe('buildDraftOrderInput', () => {
  it('maps quote + items + customer gid to a DraftOrderInput', () => {
    const input = buildDraftOrderInput({
      quote: QUOTE,
      items: ITEMS,
      customerGid: 'gid://shopify/Customer/999',
      email: 'u1@example.com',
    });

    expect(input.purchasingEntity).toEqual({customerId: 'gid://shopify/Customer/999'});
    expect(input.email).toBe('u1@example.com');
    expect(input.presentmentCurrencyCode).toBe('MXN');
    expect(input.note).toBe('Para evento de junio');
    expect(input.lineItems).toHaveLength(2);

    const l0 = input.lineItems[0];
    expect(l0.title).toBe('Taza clásica — SERIGRAFÍA 4 x 4');
    expect(l0.quantity).toBe(300);
    expect(l0.originalUnitPriceWithCurrency).toEqual({amount: '29.97', currencyCode: 'MXN'});
    expect(l0.variantId).toBeUndefined(); // custom line, no variant
    expect(l0.customAttributes).toEqual([
      {key: 'Decorado', value: 'SERIGRAFÍA - 4 x 4'},
      {key: 'VariantRef', value: 'gid://shopify/ProductVariant/111'},
    ]);

    const l1 = input.lineItems[1];
    expect(l1.title).toBe('Pluma metálica'); // no decoration suffix when "Sin decorado"
    expect(l1.originalUnitPriceWithCurrency).toEqual({amount: '12.50', currencyCode: 'MXN'});
    expect(l1.customAttributes).toEqual([
      {key: 'VariantRef', value: 'gid://shopify/ProductVariant/222'},
    ]);
  });

  it('formats amount with exactly 2 decimals', () => {
    const input = buildDraftOrderInput({
      quote: QUOTE,
      items: [{...ITEMS[0], effectiveUnitPrice: 5}],
      customerGid: 'gid://shopify/Customer/1',
      email: 'x@y.z',
    });
    expect(input.lineItems[0].originalUnitPriceWithCurrency.amount).toBe('5.00');
  });
});
```

- [ ] Run it expecting FAIL. Command: `npx vitest run app/lib/quotes/draftInput.test.js`
  Expected output: module-not-found for `./draftInput.js` — `Failed to load url ./draftInput.js`.

- [ ] Minimal implementation. COMPLETE contents of `app/lib/quotes/draftInput.js`:

```js
// Pure mapping: quote + items -> Shopify DraftOrderInput (Admin API 2026-04).
// Decoration price is integrated into originalUnitPriceWithCurrency, never as an attribute.

const CURRENCY = 'MXN';

function hasDecoration(item) {
  return Boolean(item.technique) && item.technique !== 'Sin decorado';
}

function lineTitle(item) {
  if (hasDecoration(item)) {
    const parts = [item.technique, item.size].filter(Boolean).join(' ');
    return `${item.title} — ${parts}`.trim();
  }
  return item.title;
}

function lineAttributes(item) {
  const attrs = [];
  if (hasDecoration(item)) {
    attrs.push({key: 'Decorado', value: `${item.technique} - ${item.size}`});
  }
  attrs.push({key: 'VariantRef', value: item.variantId});
  return attrs;
}

export function buildDraftOrderInput({quote, items, customerGid, email}) {
  return {
    purchasingEntity: {customerId: customerGid},
    email,
    presentmentCurrencyCode: CURRENCY,
    note: quote.notes ?? null,
    lineItems: items.map((item) => ({
      title: lineTitle(item),
      quantity: item.qty,
      originalUnitPriceWithCurrency: {
        amount: Number(item.effectiveUnitPrice).toFixed(2),
        currencyCode: CURRENCY,
      },
      customAttributes: lineAttributes(item),
    })),
  };
}
```

- [ ] Run test expecting PASS. Command: `npx vitest run app/lib/quotes/draftInput.test.js`
  Expected output: `Test Files  1 passed (1)`, 2 tests passing.

- [ ] Now create the route action. COMPLETE contents of `app/routes/api.quote.submit.jsx`:

```js
import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {findById, setShopifyGid} from '~/lib/auth/users';
import {isStubMode} from '~/lib/admin/client';
import {createCustomer, createDraftOrder} from '~/lib/admin/operations';
import {getOrCreateDraftQuote, getQuoteWithItems, markSubmitted} from '~/lib/quotes/repo';
import {buildDraftOrderInput} from '~/lib/quotes/draftInput';

export async function action({request, context}) {
  assertSameOrigin(request);
  const sessionUser = await requireUser(context);
  const {env} = context;
  const db = getDb(env);

  // Buyer-supplied notes/deadline come from the submit form body (cotizacion.jsx
  // posts {notes, deadline}). Read them so they are NOT dropped.
  const form = await request.formData();
  const notes = form.get('notes') != null ? String(form.get('notes')).trim() : '';
  const deadline = form.get('deadline') != null ? String(form.get('deadline')).trim() : '';

  const draft = await getOrCreateDraftQuote(db, sessionUser.userId);

  // Persist notes/deadline onto the draft BEFORE we read it back and build the
  // DraftOrderInput — otherwise quote.notes is never written and the buyer's
  // notes/deadline are silently dropped. Empty strings -> null.
  await db.execute({
    sql: `UPDATE quotes SET notes=?, deadline=?, updated_at=? WHERE id=?`,
    args: [notes || null, deadline || null, new Date().toISOString(), draft.id],
  });

  const {quote, items} = await getQuoteWithItems(db, draft.id);
  if (!quote || items.length === 0) {
    return Response.json({error: 'La cotización está vacía.'}, {status: 400});
  }

  const user = await findById(db, sessionUser.userId);

  // Lazy gid reconcile: never build purchasingEntity with a null/STUB customerId
  // when a real Admin token is available.
  let customerGid = user.shopifyCustomerGid;
  const needsReconcile = !customerGid || String(customerGid).includes('STUB-');
  if (needsReconcile && !isStubMode(env)) {
    const created = await createCustomer(env, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    customerGid = created.gid;
    await setShopifyGid(db, user.id, customerGid);
  }

  const input = buildDraftOrderInput({quote, items, customerGid, email: user.email});
  const {gid, invoiceUrl} = await createDraftOrder(env, input);

  // Collapse the status write + any bookkeeping into one libSQL round-trip.
  await db.batch(
    [
      {
        sql: `UPDATE quotes
              SET status='submitted', shopify_draft_order_gid=?, shopify_invoice_url=?, updated_at=?
              WHERE id=?`,
        args: [gid ?? null, invoiceUrl ?? null, new Date().toISOString(), quote.id],
      },
    ],
    'write',
  );

  // Never surface a stub invoice URL to the user.
  const safeInvoiceUrl = isStubMode(env) ? null : invoiceUrl;
  return Response.json({folio: quote.id, draftOrderGid: gid, invoiceUrl: safeInvoiceUrl});
}
```

> Note: `markSubmitted` (Task 1) and the `batch()` write above perform the same UPDATE. The route uses `batch()` directly to satisfy the subrequest budget (single round-trip); `markSubmitted` remains the contract export used by tests and non-batch callers.

- [ ] MANUAL verification (route is workerd-only, cannot unit-test):
  1. `npm run dev`
  2. Log in (Phase 1 auth). Add at least one item to the quote (Task 4 / `api.quote.add`).
  3. In a terminal, with the dev cookie, POST to submit (include notes/deadline) and confirm a folio is returned:
     `curl -i -X POST http://localhost:3000/api/quote/submit -H "Origin: http://localhost:3000" -H "Cookie: <session cookie>" -F notes="Para evento de junio" -F deadline="2026-06-30"`
     Expected: `200` JSON `{"folio":"<uuid>","draftOrderGid":"gid://shopify/DraftOrder/STUB-...","invoiceUrl":null}` (stub mode, no token). Then confirm the buyer notes/deadline were persisted (not dropped): the submitted quote row has `notes='Para evento de junio'` and `deadline='2026-06-30'` (visible in `/account/cotizaciones/<folio>` detail or a direct `SELECT notes,deadline FROM quotes WHERE id='<folio>'`), and `input.note` carried the same notes into the draft order.
  4. Re-POST submit: expect a fresh `folio` (the previous draft was marked `submitted`, a new draft is created and is empty -> `400 La cotización está vacía.`).
  5. Confirm with a Bash check that the quote row is `submitted`:
     `npx vitest run app/lib/quotes/repo.test.js` (regression — the markSubmitted test asserts the freed-slot behavior the route depends on).

- [ ] Commit:
```
git add app/lib/quotes/draftInput.js app/lib/quotes/draftInput.test.js app/routes/api.quote.submit.jsx
git commit -m "feat(quotes): submit action maps items to draft order input

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `api.quote.add.jsx`, `api.quote.update.jsx`, `api.quote.remove.jsx` actions

Server recompute: accept ONLY `{variantId, technique, surface, size, qty}`. Recompute `baseUnitPrice` from the Storefront, `decorationTotal`/`effectiveUnitPrice` from the decoration engine. Client prices are never persisted. Extract the recompute into a testable pure helper, then wire routes (workerd-only -> MANUAL verification).

### Files
- Create: `app/lib/quotes/recompute.js`
- Create: `app/routes/api.quote.add.jsx`
- Create: `app/routes/api.quote.update.jsx`
- Create: `app/routes/api.quote.remove.jsx`
- Test: `app/lib/quotes/recompute.test.js`

### Steps

- [ ] Write the failing test. COMPLETE contents of `app/lib/quotes/recompute.test.js`:

```js
import {describe, it, expect} from 'vitest';
import {recomputeItemPricing} from './recompute.js';

describe('recomputeItemPricing', () => {
  it('integrates decoration into effective unit price (qty >= min)', () => {
    const r = recomputeItemPricing({
      baseUnitPrice: 25,
      technique: 'SERIGRAFÍA',
      surface: 'TEXTIL',
      size: '4 x 4',
      qty: 300,
    });
    expect(r.error).toBeNull();
    // decorationTotal = (300 * 3.33) / 0.67 = 1491.0447...
    expect(r.decorationTotal).toBeCloseTo(1491.0447761194, 4);
    // effective = round2(25 + 1491.0447.../300)
    expect(r.effectiveUnitPrice).toBe(29.97);
  });

  it('"Sin decorado" -> no decoration cost, effective == base', () => {
    const r = recomputeItemPricing({
      baseUnitPrice: 12.5,
      technique: 'Sin decorado',
      surface: '',
      size: '',
      qty: 50,
    });
    expect(r.error).toBeNull();
    expect(r.decorationTotal).toBe(0);
    expect(r.effectiveUnitPrice).toBe(12.5);
  });

  it('propagates a structured error for unknown technique', () => {
    const r = recomputeItemPricing({
      baseUnitPrice: 10,
      technique: 'NOPE',
      surface: 'TEXTIL',
      size: '4 x 4',
      qty: 100,
    });
    expect(r.error).toMatch(/no encontrado/i);
    expect(r.decorationTotal).toBe(0);
  });
});
```

- [ ] Run it expecting FAIL. Command: `npx vitest run app/lib/quotes/recompute.test.js`
  Expected output: module-not-found for `./recompute.js`.

- [ ] Minimal implementation. COMPLETE contents of `app/lib/quotes/recompute.js`:

```js
// Pure server-side recompute. Client never supplies prices.
import {calcDecoration, effectiveUnitPrice, round2} from '~/lib/decoration/engine';

export function recomputeItemPricing({baseUnitPrice, technique, surface, size, qty}) {
  const base = Number(baseUnitPrice) || 0;
  const q = Math.max(1, Math.trunc(Number(qty) || 1));
  const dec = calcDecoration(technique, surface, q, size);
  if (dec.error) {
    return {error: dec.error, baseUnitPrice: base, decorationTotal: 0, effectiveUnitPrice: round2(base)};
  }
  const decorationTotal = dec.totalPrice;
  const effective = round2(effectiveUnitPrice(base, decorationTotal, q));
  return {
    error: null,
    baseUnitPrice: base,
    decorationTotal,
    effectiveUnitPrice: effective,
  };
}
```

- [ ] Run test expecting PASS. Command: `npx vitest run app/lib/quotes/recompute.test.js`
  Expected output: `Test Files  1 passed (1)`, 3 tests passing.

- [ ] Create `app/routes/api.quote.add.jsx`. COMPLETE contents:

```js
import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getOrCreateDraftQuote, upsertQuoteItem, getQuoteWithItems} from '~/lib/quotes/repo';
import {recomputeItemPricing} from '~/lib/quotes/recompute';

const PRODUCT_PRICE_QUERY = `#graphql
  query QuoteVariant($id: ID!) {
    node(id: $id) {
      ... on ProductVariant {
        id
        title
        price { amount }
        product { handle title }
      }
    }
  }
`;

export async function action({request, context}) {
  assertSameOrigin(request);
  const sessionUser = await requireUser(context);
  const {env, storefront} = context;
  const db = getDb(env);

  const form = await request.formData();
  const variantId = String(form.get('variantId') || '');
  const technique = String(form.get('technique') || '');
  const surface = String(form.get('surface') || '');
  const size = String(form.get('size') || '');
  const qty = Math.max(1, Math.trunc(Number(form.get('qty')) || 1));
  if (!variantId) return Response.json({error: 'Falta variantId.'}, {status: 400});

  // Authoritative base price from the Storefront.
  const {node} = await storefront.query(PRODUCT_PRICE_QUERY, {variables: {id: variantId}});
  if (!node) return Response.json({error: 'Variante no encontrada.'}, {status: 404});
  const baseUnitPrice = Number(node.price?.amount) || 0;

  const priced = recomputeItemPricing({baseUnitPrice, technique, surface, size, qty});
  if (priced.error) return Response.json({error: priced.error}, {status: 422});

  const quote = await getOrCreateDraftQuote(db, sessionUser.userId);
  await upsertQuoteItem(db, quote.id, {
    id: crypto.randomUUID(),
    quoteId: quote.id,
    variantId,
    productHandle: node.product?.handle ?? null,
    title: node.product?.title ?? node.title ?? null,
    qty,
    baseUnitPrice: priced.baseUnitPrice,
    technique: technique || null,
    surface: surface || null,
    size: size || null,
    decorationTotal: priced.decorationTotal,
    effectiveUnitPrice: priced.effectiveUnitPrice,
  });

  const {items} = await getQuoteWithItems(db, quote.id);
  return Response.json({ok: true, quoteId: quote.id, items});
}
```

- [ ] Create `app/routes/api.quote.update.jsx`. COMPLETE contents:

```js
import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getOrCreateDraftQuote, getQuoteWithItems, upsertQuoteItem} from '~/lib/quotes/repo';
import {recomputeItemPricing} from '~/lib/quotes/recompute';

export async function action({request, context}) {
  assertSameOrigin(request);
  const sessionUser = await requireUser(context);
  const {env} = context;
  const db = getDb(env);

  const form = await request.formData();
  const itemId = String(form.get('itemId') || '');
  const qty = Math.max(1, Math.trunc(Number(form.get('qty')) || 1));
  if (!itemId) return Response.json({error: 'Falta itemId.'}, {status: 400});

  const quote = await getOrCreateDraftQuote(db, sessionUser.userId);
  const {items} = await getQuoteWithItems(db, quote.id);
  const existing = items.find((i) => i.id === itemId);
  if (!existing) return Response.json({error: 'Ítem no encontrado.'}, {status: 404});

  // Recompute from the persisted base price (never trust client prices) + new qty.
  const priced = recomputeItemPricing({
    baseUnitPrice: existing.baseUnitPrice,
    technique: existing.technique,
    surface: existing.surface,
    size: existing.size,
    qty,
  });
  if (priced.error) return Response.json({error: priced.error}, {status: 422});

  await upsertQuoteItem(db, quote.id, {
    ...existing,
    qty,
    decorationTotal: priced.decorationTotal,
    effectiveUnitPrice: priced.effectiveUnitPrice,
  });

  const after = await getQuoteWithItems(db, quote.id);
  return Response.json({ok: true, quoteId: quote.id, items: after.items});
}
```

- [ ] Create `app/routes/api.quote.remove.jsx`. COMPLETE contents:

```js
import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getOrCreateDraftQuote, removeQuoteItem, clearQuote, getQuoteWithItems} from '~/lib/quotes/repo';

export async function action({request, context}) {
  assertSameOrigin(request);
  const sessionUser = await requireUser(context);
  const {env} = context;
  const db = getDb(env);

  const form = await request.formData();
  const itemId = String(form.get('itemId') || '');
  const clearAll = String(form.get('clear') || '') === 'true';

  const quote = await getOrCreateDraftQuote(db, sessionUser.userId);
  if (clearAll) {
    await clearQuote(db, quote.id);
  } else {
    if (!itemId) return Response.json({error: 'Falta itemId.'}, {status: 400});
    await removeQuoteItem(db, quote.id, itemId);
  }

  const {items} = await getQuoteWithItems(db, quote.id);
  return Response.json({ok: true, quoteId: quote.id, items});
}
```

- [ ] MANUAL verification (routes workerd-only):
  1. `npm run dev`, log in.
  2. Add: `curl -i -X POST http://localhost:3000/api/quote/add -H "Origin: http://localhost:3000" -H "Cookie: <session>" -F variantId=gid://shopify/ProductVariant/<real> -F technique="Sin decorado" -F surface= -F size= -F qty=10` -> expect `200 {"ok":true,...}` with one item; `effectiveUnitPrice` equals the Storefront price (no decoration). Send a bogus `effectiveUnitPrice=1` field too and confirm it is ignored (server recompute).
  3. Update qty to 1: `curl ... /api/quote/update -F itemId=<id> -F qty=1` -> qty=1, recomputed.
  4. CSRF: repeat add with `-H "Origin: https://evil.test"` -> expect `403 Forbidden`.
  5. Remove: `curl ... /api/quote/remove -F itemId=<id>` -> empty items. `clear=true` empties all.

- [ ] Commit:
```
git add app/lib/quotes/recompute.js app/lib/quotes/recompute.test.js app/routes/api.quote.add.jsx app/routes/api.quote.update.jsx app/routes/api.quote.remove.jsx
git commit -m "feat(quotes): add/update/remove actions with server-side price recompute

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `cotizacion.jsx` — real submit (folio + invoice link) and +/-1 qty

Replace the fake `setTimeout` submit with a `fetcher` POST to `/api/quote/submit` (posting `{notes, deadline}` as the form body so the server can persist them); on success show the folio (`quote.id`) and, when present and real, an invoice link. Change qty steppers from +/-25 to +/-1, minimum 1.

> Reconciliation note (Phase 7). This phase still drives the UI from the client `AppContext` quote (localStorage) while submit reads the SERVER draft. In **Phase 7** `AppContext.quote` becomes a server fetcher and this component hydrates from the server draft keyed by `item.id`, so submit reads the exact items the user sees. Do not attempt that reconciliation here.

### Files
- Modify: `app/routes/cotizacion.jsx`
  - imports (line 1-6): add `useFetcher`
  - submit handler (lines ~50-58: the `submit` function and `submitting`/`submitted` state)
  - success view (lines ~88-92: the "Ver mis cotizaciones" block — add folio + invoice link)
  - qty steppers (REAL lines: line 151 `item.qty - 25` and line 160 `item.qty + 25`) — this phase OWNS this change: ±25 -> ±1, min 1
- Test: MANUAL (route component, workerd + browser).

### Steps

- [ ] Modify imports. Change line 1-2 region:

OLD:
```jsx
import {useState} from 'react';
import {useNavigate} from 'react-router';
```
NEW:
```jsx
import {useState} from 'react';
import {useFetcher, useNavigate} from 'react-router';
```

- [ ] Add a fetcher + result state inside `Cotizacion()` (just after `const navigate = useNavigate();`):

OLD:
```jsx
  const navigate = useNavigate();
  const toast = useToast();
  const {hydrated, isLoggedIn, quote, updateQuoteQty, removeFromQuote, clearQuote} = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
```
NEW:
```jsx
  const navigate = useNavigate();
  const toast = useToast();
  const submitFetcher = useFetcher();
  const {hydrated, isLoggedIn, quote, updateQuoteQty, removeFromQuote, clearQuote} = useApp();
  const [result, setResult] = useState(null);
  const submitting = submitFetcher.state !== 'idle';
  const submitted = Boolean(result);
```

- [ ] Replace the fake `submit`:

OLD:
```jsx
  const submit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      toast('Cotización enviada · respuesta en menos de 24h', {icon: 'check', accent: true});
      clearQuote();
    }, 1400);
  };
```
NEW:
```jsx
  const submit = async () => {
    const res = await submitFetcher.submit(
      {notes, deadline},
      {method: 'POST', action: '/api/quote/submit', encType: 'application/x-www-form-urlencoded'},
    );
    // useFetcher resolves data on submitFetcher.data; read it after the await.
    const data = submitFetcher.data || res;
    if (data && data.error) {
      toast(data.error, {icon: 'alert'});
      return;
    }
    if (data && data.folio) {
      setResult(data);
      toast('Cotización enviada · respuesta en menos de 24h', {icon: 'check', accent: true});
      clearQuote();
    }
  };
```

> Implementation note: `useFetcher().submit` does not return the response in RR7. The robust pattern is to drive on `submitFetcher.data` via effect. Replace the body above with an effect-driven approach if `res` is undefined: add
> ```jsx
> import {useEffect} from 'react';
> useEffect(() => {
>   const data = submitFetcher.data;
>   if (submitFetcher.state === 'idle' && data) {
>     if (data.error) { toast(data.error, {icon: 'alert'}); return; }
>     if (data.folio && !result) {
>       setResult(data);
>       toast('Cotización enviada · respuesta en menos de 24h', {icon: 'check', accent: true});
>       clearQuote();
>     }
>   }
> }, [submitFetcher.state, submitFetcher.data]);
> ```
> and reduce `submit` to just `submitFetcher.submit({notes, deadline}, {method:'POST', action:'/api/quote/submit'})`.

- [ ] Add folio + invoice link to the success view. Inside the `if (submitted)` block, replace the paragraph + buttons:

OLD:
```jsx
          <h3 style={{fontSize: 32, fontFamily: 'var(--font-display)'}}>Cotización enviada</h3>
          <p style={{fontSize: 16}}>
            Tu solicitud fue enviada a nuestro equipo comercial.<br />
            Recibirás propuesta personalizada en menos de <strong>24 horas hábiles</strong>.
          </p>
          <div style={{display: 'flex', gap: 8, justifyContent: 'center'}}>
            <Button variant="primary" iconRight="arrow_right" onClick={() => navigate('/account/cotizaciones')}>
              Ver mis cotizaciones
            </Button>
            <Button variant="ghost" onClick={() => navigate('/catalogo')}>
              Seguir explorando
            </Button>
          </div>
```
NEW:
```jsx
          <h3 style={{fontSize: 32, fontFamily: 'var(--font-display)'}}>Cotización enviada</h3>
          <p style={{fontSize: 16}}>
            Tu solicitud fue enviada a nuestro equipo comercial.<br />
            Recibirás propuesta personalizada en menos de <strong>24 horas hábiles</strong>.
          </p>
          <p style={{fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)'}}>
            Folio · {result.folio}
          </p>
          {result.invoiceUrl && (
            <p>
              <a href={result.invoiceUrl} target="_blank" rel="noreferrer">
                Ver / pagar cotización
              </a>
            </p>
          )}
          <div style={{display: 'flex', gap: 8, justifyContent: 'center'}}>
            <Button variant="primary" iconRight="arrow_right" onClick={() => navigate('/account/cotizaciones')}>
              Ver mis cotizaciones
            </Button>
            <Button variant="ghost" onClick={() => navigate('/catalogo')}>
              Seguir explorando
            </Button>
          </div>
```

- [ ] Change the qty steppers from +/-25 to +/-1 (this phase OWNS this change). The edits are at the REAL line numbers in `app/routes/cotizacion.jsx`: the minus button at **line 151** (`item.qty - 25`) and the plus button at **line 160** (`item.qty + 25`). Minimum stays at 1 (preserved via `Math.max(1, ...)`).

OLD (line 151):
```jsx
                  <button onClick={() => updateQuoteQty(item.variantId, Math.max(1, item.qty - 25))}>
                    <Icon name="minus" size={12} />
                  </button>
```
NEW (line 151):
```jsx
                  <button onClick={() => updateQuoteQty(item.variantId, Math.max(1, item.qty - 1))}>
                    <Icon name="minus" size={12} />
                  </button>
```

OLD (line 160):
```jsx
                  <button onClick={() => updateQuoteQty(item.variantId, item.qty + 25)}>
                    <Icon name="plus" size={12} />
                  </button>
```
NEW (line 160):
```jsx
                  <button onClick={() => updateQuoteQty(item.variantId, item.qty + 1)}>
                    <Icon name="plus" size={12} />
                  </button>
```

- [ ] MANUAL verification (browser):
  1. `npm run dev`, log in, add items.
  2. On `/cotizacion`: click +/- on a line -> qty changes by exactly 1; cannot go below 1.
  3. Click "Enviar cotización" -> success screen shows "Folio · <uuid>". In stub mode no invoice link appears; with a real Admin token an invoice link is shown and opens the Shopify invoice.
  4. After submit, `/account/cotizaciones` lists the submitted quote (Task 5).

- [ ] Commit:
```
git add app/routes/cotizacion.jsx
git commit -m "feat(cotizacion): real submit with folio + invoice link and +/-1 qty

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `account.cotizaciones._index.jsx` + `account.cotizaciones.$id.jsx`

List the user's quotes and a single-quote detail, read from Turso via `listUserQuotes` and `getQuoteWithItems`. Both loaders are workerd-only -> MANUAL verification.

### Files
- Create: `app/routes/account.cotizaciones._index.jsx`
- Create: `app/routes/account.cotizaciones.$id.jsx`
- Test: MANUAL.

### Steps

- [ ] Create `app/routes/account.cotizaciones._index.jsx`. COMPLETE contents:

```js
import {useLoaderData, Link} from 'react-router';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {listUserQuotes} from '~/lib/quotes/repo';
import {formatPrice} from '~/lib/gi';

export const meta = () => [{title: 'Mis cotizaciones · Generando Ideas'}];

export async function loader({context}) {
  const sessionUser = await requireUser(context);
  const db = getDb(context.env);
  const quotes = await listUserQuotes(db, sessionUser.userId);
  return {quotes};
}

const STATUS_LABEL = {
  draft: 'Borrador',
  submitted: 'Enviada',
  converted: 'Convertida',
  cancelled: 'Cancelada',
};

export default function CotizacionesIndex() {
  const {quotes} = useLoaderData();
  return (
    <div className="container" style={{padding: '32px 0 80px'}} data-screen-label="Cotizaciones list">
      <div className="eyebrow">// Cuenta · /account/cotizaciones</div>
      <h1 style={{fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(28px,4vw,48px)', margin: '12px 0 24px'}}>
        Mis cotizaciones
      </h1>
      {quotes.length === 0 ? (
        <div className="empty">
          <h3>Aún no tienes cotizaciones</h3>
          <p>Cuando envíes una, aparecerá aquí con su folio.</p>
          <Link to="/catalogo">Explorar catálogo</Link>
        </div>
      ) : (
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr style={{textAlign: 'left', borderBottom: '1px solid var(--line)'}}>
              <th style={{padding: '8px 0'}}>Folio</th>
              <th style={{padding: '8px 0'}}>Estado</th>
              <th style={{padding: '8px 0'}}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} style={{borderBottom: '1px solid var(--line)'}}>
                <td style={{padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 13}}>{q.id}</td>
                <td style={{padding: '10px 0'}}>{STATUS_LABEL[q.status] || q.status}</td>
                <td style={{padding: '10px 0'}}>
                  <Link to={`/account/cotizaciones/${q.id}`}>Ver detalle</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// formatPrice imported to keep parity with detail view formatting; used in $id route.
export {formatPrice};
```

> Drop the trailing `export {formatPrice};` if your linter flags an unused import here — it exists only so the import isn't dead. Simpler: remove the `formatPrice` import from this file entirely (it is not used in the list view). Keep imports minimal.

- [ ] Create `app/routes/account.cotizaciones.$id.jsx`. COMPLETE contents:

```js
import {useLoaderData, Link, data} from 'react-router';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getQuoteWithItems} from '~/lib/quotes/repo';
import {formatPrice} from '~/lib/gi';

export const meta = () => [{title: 'Cotización · Generando Ideas'}];

export async function loader({params, context}) {
  const sessionUser = await requireUser(context);
  const db = getDb(context.env);
  const {quote, items} = await getQuoteWithItems(db, params.id);
  // Ownership check: never leak another user's quote.
  if (!quote || quote.userId !== sessionUser.userId) {
    throw data({error: 'No encontrada'}, {status: 404});
  }
  return {quote, items};
}

const STATUS_LABEL = {
  draft: 'Borrador',
  submitted: 'Enviada',
  converted: 'Convertida',
  cancelled: 'Cancelada',
};

export default function CotizacionDetail() {
  const {quote, items} = useLoaderData();
  const total = items.reduce((s, i) => s + i.effectiveUnitPrice * i.qty, 0);
  return (
    <div className="container" style={{padding: '32px 0 80px'}} data-screen-label="Cotizacion detail">
      <Link to="/account/cotizaciones">← Mis cotizaciones</Link>
      <h1 style={{fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(24px,3vw,40px)', margin: '12px 0 8px'}}>
        Folio {quote.id}
      </h1>
      <p style={{color: 'var(--ink-3)'}}>Estado · {STATUS_LABEL[quote.status] || quote.status}</p>
      {quote.shopifyInvoiceUrl && (
        <p>
          <a href={quote.shopifyInvoiceUrl} target="_blank" rel="noreferrer">
            Ver / pagar cotización
          </a>
        </p>
      )}
      <table style={{width: '100%', borderCollapse: 'collapse', marginTop: 16}}>
        <thead>
          <tr style={{textAlign: 'left', borderBottom: '1px solid var(--line)'}}>
            <th style={{padding: '8px 0'}}>Producto</th>
            <th style={{padding: '8px 0'}}>Decorado</th>
            <th style={{padding: '8px 0'}}>Cant.</th>
            <th style={{padding: '8px 0'}}>Unitario</th>
            <th style={{padding: '8px 0'}}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} style={{borderBottom: '1px solid var(--line)'}}>
              <td style={{padding: '10px 0'}}>{i.title}</td>
              <td style={{padding: '10px 0'}}>
                {i.technique && i.technique !== 'Sin decorado' ? `${i.technique} ${i.size || ''}` : '—'}
              </td>
              <td style={{padding: '10px 0'}}>{i.qty}</td>
              <td style={{padding: '10px 0'}}>{formatPrice(i.effectiveUnitPrice)}</td>
              <td style={{padding: '10px 0'}}>{formatPrice(i.effectiveUnitPrice * i.qty)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{padding: '12px 0', textAlign: 'right', fontWeight: 700}}>Total</td>
            <td style={{padding: '12px 0', fontWeight: 700}}>{formatPrice(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

- [ ] MANUAL verification (browser):
  1. `npm run dev`, log in, submit a quote (Task 4).
  2. Visit `/account/cotizaciones` -> the submitted quote is listed with its folio and "Enviada" status.
  3. Click "Ver detalle" -> line items show title, decoration, qty, unit price (= persisted `effectiveUnitPrice`, raw number formatted at render), and a correct total.
  4. Ownership: log in as a different user and request `/account/cotizaciones/<other-user-folio>` -> `404`.
  5. Not logged in: `/account/cotizaciones` redirects to `/login` (via `requireUser`).

- [ ] Commit:
```
git add app/routes/account.cotizaciones._index.jsx app/routes/account.cotizaciones.$id.jsx
git commit -m "feat(account): cotizaciones list and detail routes from Turso

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done criteria

- `npx vitest run app/lib/quotes/repo.test.js app/lib/quotes/draftInput.test.js app/lib/quotes/recompute.test.js` -> all pass.
- get-or-create draft idempotency proven (one `draft` per user; submit frees the slot).
- submit maps items to a correct `DraftOrderInput` (custom lines, integrated price, MXN, `purchasingEntity.customerId`).
- add/update recompute prices server-side; client prices never persisted.
- `cotizacion.jsx` submits for real (folio + optional invoice link); qty +/-1, min 1.
- `account.cotizaciones` list + detail render from Turso with ownership enforcement.
