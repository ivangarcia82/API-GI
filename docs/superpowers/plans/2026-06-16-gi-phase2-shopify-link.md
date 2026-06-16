# Phase 2: Vínculo Shopify + Admin API (stub) Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL — invoke `superpowers:executing-plans` before starting, and `superpowers:test-driven-development` for every task. Follow the red→green→commit loop literally. Do not skip the "run test expecting FAIL" step.

## Goal

Stand up the Shopify Admin API integration layer in **stub mode** (no real token yet), wire the Phase 1 signup route to create a Shopify Customer and persist its gid on the user, and add a lazy reconciliation helper that backfills/upgrades `null` or `STUB-` gids once a real token exists. This delivers spec §6 (Admin client + operations) plus the signup gid linkage (§5.3) and lazy reconciliation (§7.2 step 3). The `createDraftOrder` operation is **defined** here (exact shape) but is consumed in Phase 4.

After this phase: signing up creates a (stub) Shopify customer and stores its gid; switching `PRIVATE_ADMIN_API_TOKEN` from absent→present flips the whole layer to real with zero refactor; production without a token throws loudly at first use.

## Architecture

- `app/lib/admin/client.js` — transport + mode detection. `isStubMode(env)` returns `true` when `env.PRIVATE_ADMIN_API_TOKEN` is falsy. `adminFetch(env, query, variables)` POSTs to the Admin GraphQL endpoint when real; in stub mode it logs (loud, non-prod) and returns deterministic canned responses keyed off the operation name parsed from `query`. If `env.ENVIRONMENT === 'production'` and no token, `isStubMode`/`adminFetch` throw at first use.
- `app/lib/admin/operations.js` — domain operations on top of `adminFetch`. `createCustomer` is idempotent (handles `TAKEN` userError by querying the existing customer by email and reusing its gid; stub returns `gid://shopify/Customer/STUB-<uuid>`). `createDraftOrder` is the exact DraftOrderInput-shaped mutation (used in Phase 4).
- `app/routes/auth.signup.jsx` (created in Phase 1) — extended: after `createUser`, call `createCustomer` and `setShopifyGid`. A failed Shopify call must NOT fail signup (gid stays whatever was returned; `null` is acceptable and reconciled later).
- `app/lib/auth/reconcile.js` — new server-only module. `reconcileShopifyCustomer(db, env, user)` backfills a real gid when `user.shopifyCustomerGid` is `null` or starts with `STUB-` and a real token is present; persists via `setShopifyGid`; returns the (possibly updated) gid.

All `app/lib/admin/*` and `app/lib/auth/reconcile.js` modules are **server-only**: never imported from client components. `env` is always passed explicitly (never `import.meta.env`).

## Tech Stack

- JS + JSX (no TypeScript). React Router 7 file-based routes, Hydrogen on Oxygen (workerd).
- Test runner: **VITEST** (devDependency + `vitest.config.js` added in Phase 1 task 0). Pure/Node-testable units run with `npx vitest run <path>`.
- Money raw; `round2(n) = Math.round(n*100)/100` (defined in decoration engine, Phase 5; not needed here).
- libSQL import is `import {createClient} from '@libsql/client/web'` (bare `@libsql/client` forbidden) — only relevant where db is touched (reconcile uses the `db` handle passed in; it never creates one).
- Branch `feat/auth-decoration-quotes` already exists. Conventional commits; every commit body ends with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 1 — `app/lib/admin/client.js`: `isStubMode` + `adminFetch` (stub transport)

Files:
- Create: `app/lib/admin/client.js`
- Test: `app/lib/admin/client.test.js`

The transport is unit-testable in Node: `isStubMode` is pure over `env`; the stub branch of `adminFetch` returns deterministic objects without any network. The real branch calls `globalThis.fetch`, which we exercise by injecting a mocked `globalThis.fetch` in a separate test.

Steps:

- [ ] **Write failing test.** Create `app/lib/admin/client.test.js`:

```js
import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest';
import {isStubMode, adminFetch} from './client.js';

describe('isStubMode', () => {
  it('returns true when no admin token', () => {
    expect(isStubMode({})).toBe(true);
    expect(isStubMode({PRIVATE_ADMIN_API_TOKEN: ''})).toBe(true);
  });

  it('returns false when admin token present', () => {
    expect(isStubMode({PRIVATE_ADMIN_API_TOKEN: 'shpat_x'})).toBe(false);
  });

  it('throws in production without a token', () => {
    expect(() => isStubMode({ENVIRONMENT: 'production'})).toThrow(
      /production/i,
    );
  });

  it('does not throw in production with a token', () => {
    expect(
      isStubMode({ENVIRONMENT: 'production', PRIVATE_ADMIN_API_TOKEN: 't'}),
    ).toBe(false);
  });
});

describe('adminFetch stub mode', () => {
  let logSpy;
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs loudly and returns deterministic customerCreate stub', async () => {
    const data = await adminFetch(
      {},
      'mutation customerCreate($input: CustomerInput!) { customerCreate(input: $input) { customer { id } userErrors { field message } } }',
      {input: {email: 'a@b.com'}},
    );
    expect(logSpy).toHaveBeenCalled();
    expect(data.customerCreate.userErrors).toEqual([]);
    expect(data.customerCreate.customer.id).toMatch(
      /^gid:\/\/shopify\/Customer\/STUB-/,
    );
  });

  it('returns deterministic customers query stub (empty)', async () => {
    const data = await adminFetch(
      {},
      'query customers($q: String!) { customers(first: 1, query: $q) { edges { node { id } } } }',
      {q: 'email:a@b.com'},
    );
    expect(data.customers.edges).toEqual([]);
  });

  it('returns deterministic draftOrderCreate stub', async () => {
    const data = await adminFetch(
      {},
      'mutation draftOrderCreate($input: DraftOrderInput!) { draftOrderCreate(input: $input) { draftOrder { id invoiceUrl } userErrors { field message } } }',
      {input: {}},
    );
    expect(data.draftOrderCreate.userErrors).toEqual([]);
    expect(data.draftOrderCreate.draftOrder.id).toMatch(
      /^gid:\/\/shopify\/DraftOrder\/STUB-/,
    );
    expect(data.draftOrderCreate.draftOrder.invoiceUrl).toMatch(/^stub:\/\//);
  });
});

describe('adminFetch real mode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the admin endpoint with the access-token header', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({data: {ok: true}}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const env = {
      PRIVATE_ADMIN_API_TOKEN: 'shpat_x',
      PUBLIC_STORE_DOMAIN: 'demo.myshopify.com',
    };
    const data = await adminFetch(env, 'query { shop { name } }', {});
    expect(data).toEqual({ok: true});
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://demo.myshopify.com/admin/api/2026-04/graphql.json',
    );
    expect(init.method).toBe('POST');
    expect(init.headers['X-Shopify-Access-Token']).toBe('shpat_x');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      query: 'query { shop { name } }',
      variables: {},
    });
  });

  it('uses the configured API version', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({data: {}}), {status: 200}),
    );
    vi.stubGlobal('fetch', fetchMock);
    await adminFetch(
      {
        PRIVATE_ADMIN_API_TOKEN: 't',
        PUBLIC_STORE_DOMAIN: 'demo.myshopify.com',
        SHOPIFY_ADMIN_API_VERSION: '2025-10',
      },
      'query { shop { id } }',
      {},
    );
    expect(fetchMock.mock.calls[0][0]).toContain('/admin/api/2025-10/');
  });

  it('throws on graphql errors', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({errors: [{message: 'boom'}]}),
        {status: 200},
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      adminFetch(
        {PRIVATE_ADMIN_API_TOKEN: 't', PUBLIC_STORE_DOMAIN: 'd.myshopify.com'},
        'query { shop { id } }',
        {},
      ),
    ).rejects.toThrow(/boom/);
  });
});
```

- [ ] **Run it expecting FAIL.** Command: `npx vitest run app/lib/admin/client.test.js`
  Expected output: fails to resolve / import error like `Failed to resolve import "./client.js"` or `isStubMode is not a function` (the module does not exist yet). Non-zero exit.

- [ ] **Minimal implementation.** Create `app/lib/admin/client.js`:

```js
const DEFAULT_API_VERSION = '2026-04';

/**
 * @param {Record<string, any>} env
 * @returns {boolean} true when running against the stub (no real Admin token)
 */
export function isStubMode(env) {
  const hasToken = Boolean(env && env.PRIVATE_ADMIN_API_TOKEN);
  if (!hasToken && env && env.ENVIRONMENT === 'production') {
    throw new Error(
      'Admin API is in stub mode but ENVIRONMENT=production. Set PRIVATE_ADMIN_API_TOKEN before deploying.',
    );
  }
  return !hasToken;
}

/**
 * Parse the operation name from a GraphQL document so the stub can branch.
 * @param {string} query
 * @returns {string}
 */
function operationName(query) {
  if (/customerCreate/.test(query)) return 'customerCreate';
  if (/draftOrderCreate/.test(query)) return 'draftOrderCreate';
  if (/\bcustomers\b/.test(query)) return 'customers';
  return 'unknown';
}

/**
 * Deterministic, side-effect-free stub responses (logs loudly).
 * @param {string} query
 * @returns {any}
 */
function stubResponse(query) {
  switch (operationName(query)) {
    case 'customerCreate':
      return {
        customerCreate: {
          customer: {
            id: `gid://shopify/Customer/STUB-${crypto.randomUUID()}`,
          },
          userErrors: [],
        },
      };
    case 'draftOrderCreate':
      return {
        draftOrderCreate: {
          draftOrder: {
            id: `gid://shopify/DraftOrder/STUB-${crypto.randomUUID()}`,
            invoiceUrl: `stub://draft-order/${crypto.randomUUID()}`,
          },
          userErrors: [],
        },
      };
    case 'customers':
      return {customers: {edges: []}};
    default:
      return {};
  }
}

/**
 * Execute an Admin GraphQL operation. Real when PRIVATE_ADMIN_API_TOKEN is set,
 * stub otherwise. Returns the `data` payload.
 * @param {Record<string, any>} env
 * @param {string} query
 * @param {Record<string, any>} [variables]
 * @returns {Promise<any>}
 */
export async function adminFetch(env, query, variables = {}) {
  if (isStubMode(env)) {
    console.warn(
      '[admin][STUB] Admin API stub invoked (no PRIVATE_ADMIN_API_TOKEN). ' +
        `op=${operationName(query)} — DO NOT use stub data in production.`,
    );
    return stubResponse(query);
  }

  const version = env.SHOPIFY_ADMIN_API_VERSION || DEFAULT_API_VERSION;
  const url = `https://${env.PUBLIC_STORE_DOMAIN}/admin/api/${version}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.PRIVATE_ADMIN_API_TOKEN,
    },
    body: JSON.stringify({query, variables}),
  });
  const json = await res.json();
  if (json.errors && json.errors.length) {
    throw new Error(
      `Admin API error: ${json.errors.map((e) => e.message).join('; ')}`,
    );
  }
  return json.data;
}
```

- [ ] **Run test expecting PASS.** Command: `npx vitest run app/lib/admin/client.test.js`
  Expected: all assertions pass, exit 0.

- [ ] **Commit.**

```
git add app/lib/admin/client.js app/lib/admin/client.test.js
git commit -m "feat(admin): add adminFetch client with stub/real mode detection

isStubMode flips on PRIVATE_ADMIN_API_TOKEN and throws loudly in
production without a token. adminFetch POSTs to the pinned Admin
GraphQL endpoint when real and returns deterministic STUB- responses
otherwise.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 — `app/lib/admin/operations.js`: `createCustomer` (idempotent, TAKEN reuse) + `createDraftOrder` (shape)

Files:
- Create: `app/lib/admin/operations.js`
- Test: `app/lib/admin/operations.test.js`

`createCustomer` and `createDraftOrder` are tested by injecting a **mocked `adminFetch`** via `vi.mock` so we can assert idempotency (TAKEN → query existing → reuse gid) and the exact mutation shape without touching the network.

Steps:

- [ ] **Write failing test.** Create `app/lib/admin/operations.test.js`:

```js
import {describe, it, expect, vi, beforeEach} from 'vitest';

const adminFetch = vi.fn();
vi.mock('./client.js', () => ({
  adminFetch: (...args) => adminFetch(...args),
  isStubMode: () => true,
}));

import {createCustomer, createDraftOrder} from './operations.js';

beforeEach(() => {
  adminFetch.mockReset();
});

describe('createCustomer', () => {
  it('returns the created gid on success', async () => {
    adminFetch.mockResolvedValueOnce({
      customerCreate: {
        customer: {id: 'gid://shopify/Customer/123'},
        userErrors: [],
      },
    });
    const out = await createCustomer(
      {PRIVATE_ADMIN_API_TOKEN: 't'},
      {email: 'a@b.com', firstName: 'A', lastName: 'B'},
    );
    expect(out).toEqual({gid: 'gid://shopify/Customer/123'});
    expect(adminFetch).toHaveBeenCalledTimes(1);
    const [, , vars] = adminFetch.mock.calls[0];
    expect(vars.input.email).toBe('a@b.com');
    expect(vars.input.firstName).toBe('A');
    expect(vars.input.lastName).toBe('B');
  });

  it('reuses the existing gid on TAKEN userError (idempotent)', async () => {
    adminFetch
      .mockResolvedValueOnce({
        customerCreate: {
          customer: null,
          userErrors: [
            {field: ['email'], message: 'Email has already been taken'},
          ],
        },
      })
      .mockResolvedValueOnce({
        customers: {
          edges: [{node: {id: 'gid://shopify/Customer/999'}}],
        },
      });
    const out = await createCustomer(
      {PRIVATE_ADMIN_API_TOKEN: 't'},
      {email: 'dup@b.com'},
    );
    expect(out).toEqual({gid: 'gid://shopify/Customer/999'});
    expect(adminFetch).toHaveBeenCalledTimes(2);
    const [, , lookupVars] = adminFetch.mock.calls[1];
    expect(lookupVars.q).toBe('email:dup@b.com');
  });

  it('throws on a non-TAKEN userError', async () => {
    adminFetch.mockResolvedValueOnce({
      customerCreate: {
        customer: null,
        userErrors: [{field: ['email'], message: 'Email is invalid'}],
      },
    });
    await expect(
      createCustomer({PRIVATE_ADMIN_API_TOKEN: 't'}, {email: 'bad'}),
    ).rejects.toThrow(/invalid/i);
  });

  it('omits null name fields from the input', async () => {
    adminFetch.mockResolvedValueOnce({
      customerCreate: {
        customer: {id: 'gid://shopify/Customer/1'},
        userErrors: [],
      },
    });
    await createCustomer({PRIVATE_ADMIN_API_TOKEN: 't'}, {email: 'x@y.com'});
    const [, , vars] = adminFetch.mock.calls[0];
    expect(vars.input).toEqual({email: 'x@y.com'});
  });
});

describe('createDraftOrder', () => {
  it('passes the shaped input through and returns gid + invoiceUrl', async () => {
    adminFetch.mockResolvedValueOnce({
      draftOrderCreate: {
        draftOrder: {
          id: 'gid://shopify/DraftOrder/77',
          invoiceUrl: 'https://shop/invoice/77',
        },
        userErrors: [],
      },
    });
    const input = {
      purchasingEntity: {customerId: 'gid://shopify/Customer/123'},
      email: 'a@b.com',
      presentmentCurrencyCode: 'MXN',
      note: 'hi',
      lineItems: [
        {
          title: 'Mug — SERIGRAFIA 4 x 4',
          quantity: 300,
          originalUnitPriceWithCurrency: {amount: '4.97', currencyCode: 'MXN'},
          customAttributes: [{key: 'Decorado', value: 'SERIGRAFIA - 4 x 4'}],
        },
      ],
    };
    const out = await createDraftOrder({PRIVATE_ADMIN_API_TOKEN: 't'}, input);
    expect(out).toEqual({
      gid: 'gid://shopify/DraftOrder/77',
      invoiceUrl: 'https://shop/invoice/77',
    });
    const [, query, vars] = adminFetch.mock.calls[0];
    expect(query).toContain('draftOrderCreate');
    expect(query).toContain('invoiceUrl');
    expect(vars.input).toBe(input);
  });

  it('throws on draft order userErrors', async () => {
    adminFetch.mockResolvedValueOnce({
      draftOrderCreate: {
        draftOrder: null,
        userErrors: [{field: ['email'], message: 'bad email'}],
      },
    });
    await expect(
      createDraftOrder({PRIVATE_ADMIN_API_TOKEN: 't'}, {lineItems: []}),
    ).rejects.toThrow(/bad email/);
  });
});
```

- [ ] **Run it expecting FAIL.** Command: `npx vitest run app/lib/admin/operations.test.js`
  Expected: import resolution error `Failed to resolve import "./operations.js"` (module missing). Non-zero exit.

- [ ] **Minimal implementation.** Create `app/lib/admin/operations.js`:

```js
import {adminFetch} from './client.js';

const CUSTOMER_CREATE = `
  mutation customerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

const CUSTOMERS_BY_EMAIL = `
  query customers($q: String!) {
    customers(first: 1, query: $q) {
      edges { node { id } }
    }
  }
`;

const DRAFT_ORDER_CREATE = `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id invoiceUrl }
      userErrors { field message }
    }
  }
`;

/**
 * @param {Array<{message: string}>} userErrors
 * @returns {boolean}
 */
function isTakenError(userErrors) {
  return userErrors.some((e) => /has already been taken/i.test(e.message));
}

/**
 * Create (or reuse) a Shopify customer. Idempotent: on a TAKEN userError it
 * looks up the existing customer by email and returns its gid.
 * @param {Record<string, any>} env
 * @param {{email: string, firstName?: string, lastName?: string}} args
 * @returns {Promise<{gid: string}>}
 */
export async function createCustomer(env, {email, firstName, lastName}) {
  const input = {email};
  if (firstName != null) input.firstName = firstName;
  if (lastName != null) input.lastName = lastName;

  const data = await adminFetch(env, CUSTOMER_CREATE, {input});
  const result = data.customerCreate;

  if (result.userErrors && result.userErrors.length) {
    if (isTakenError(result.userErrors)) {
      const lookup = await adminFetch(env, CUSTOMERS_BY_EMAIL, {
        q: `email:${email}`,
      });
      const node = lookup.customers.edges[0] && lookup.customers.edges[0].node;
      if (node && node.id) return {gid: node.id};
      throw new Error(
        `createCustomer: email taken but lookup found no customer for ${email}`,
      );
    }
    throw new Error(
      `createCustomer userErrors: ${result.userErrors
        .map((e) => e.message)
        .join('; ')}`,
    );
  }

  return {gid: result.customer.id};
}

/**
 * Create a Shopify draft order. `input` must already be a shaped DraftOrderInput
 * (purchasingEntity.customerId, presentmentCurrencyCode: MXN, lineItems with
 * originalUnitPriceWithCurrency {amount, currencyCode: "MXN"}). Used in Phase 4.
 * @param {Record<string, any>} env
 * @param {Record<string, any>} input
 * @returns {Promise<{gid: string, invoiceUrl: string}>}
 */
export async function createDraftOrder(env, input) {
  const data = await adminFetch(env, DRAFT_ORDER_CREATE, {input});
  const result = data.draftOrderCreate;
  if (result.userErrors && result.userErrors.length) {
    throw new Error(
      `createDraftOrder userErrors: ${result.userErrors
        .map((e) => e.message)
        .join('; ')}`,
    );
  }
  return {gid: result.draftOrder.id, invoiceUrl: result.draftOrder.invoiceUrl};
}
```

- [ ] **Run test expecting PASS.** Command: `npx vitest run app/lib/admin/operations.test.js`
  Expected: all assertions pass, exit 0.

- [ ] **Commit.**

```
git add app/lib/admin/operations.js app/lib/admin/operations.test.js
git commit -m "feat(admin): add createCustomer (idempotent) and createDraftOrder ops

createCustomer reuses an existing gid on a TAKEN userError by querying
customers by email. createDraftOrder defines the exact DraftOrderInput
mutation (purchasingEntity.customerId + originalUnitPriceWithCurrency)
consumed in Phase 4.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 — `app/lib/auth/reconcile.js`: lazy gid reconciliation

Files:
- Create: `app/lib/auth/reconcile.js`
- Test: `app/lib/auth/reconcile.test.js`

`reconcileShopifyCustomer(db, env, user)` is tested with a mocked `createCustomer` (via `vi.mock` of `../admin/operations.js`) and a mocked `setShopifyGid` (via `vi.mock` of `./users.js`). The `db` handle is opaque and just passed through to `setShopifyGid`.

Steps:

- [ ] **Write failing test.** Create `app/lib/auth/reconcile.test.js`:

```js
import {describe, it, expect, vi, beforeEach} from 'vitest';

const createCustomer = vi.fn();
const setShopifyGid = vi.fn();

vi.mock('../admin/operations.js', () => ({
  createCustomer: (...a) => createCustomer(...a),
}));
vi.mock('./users.js', () => ({
  setShopifyGid: (...a) => setShopifyGid(...a),
}));

import {reconcileShopifyCustomer} from './reconcile.js';

const REAL_ENV = {PRIVATE_ADMIN_API_TOKEN: 't'};
const STUB_ENV = {};
const db = {__db: true};

beforeEach(() => {
  createCustomer.mockReset();
  setShopifyGid.mockReset();
});

describe('reconcileShopifyCustomer', () => {
  it('does nothing when gid is already real', async () => {
    const gid = await reconcileShopifyCustomer(db, REAL_ENV, {
      id: 'u1',
      email: 'a@b.com',
      shopifyCustomerGid: 'gid://shopify/Customer/123',
    });
    expect(gid).toBe('gid://shopify/Customer/123');
    expect(createCustomer).not.toHaveBeenCalled();
    expect(setShopifyGid).not.toHaveBeenCalled();
  });

  it('backfills a null gid when a real token is present', async () => {
    createCustomer.mockResolvedValueOnce({gid: 'gid://shopify/Customer/55'});
    const gid = await reconcileShopifyCustomer(db, REAL_ENV, {
      id: 'u2',
      email: 'n@b.com',
      firstName: 'N',
      lastName: 'B',
      shopifyCustomerGid: null,
    });
    expect(gid).toBe('gid://shopify/Customer/55');
    expect(createCustomer).toHaveBeenCalledWith(REAL_ENV, {
      email: 'n@b.com',
      firstName: 'N',
      lastName: 'B',
    });
    expect(setShopifyGid).toHaveBeenCalledWith(db, 'u2', 'gid://shopify/Customer/55');
  });

  it('upgrades a STUB- gid when a real token is present', async () => {
    createCustomer.mockResolvedValueOnce({gid: 'gid://shopify/Customer/66'});
    const gid = await reconcileShopifyCustomer(db, REAL_ENV, {
      id: 'u3',
      email: 's@b.com',
      shopifyCustomerGid: 'gid://shopify/Customer/STUB-abc',
    });
    expect(gid).toBe('gid://shopify/Customer/66');
    expect(setShopifyGid).toHaveBeenCalledWith(db, 'u3', 'gid://shopify/Customer/66');
  });

  it('does not reconcile in stub mode (no real token)', async () => {
    const gid = await reconcileShopifyCustomer(db, STUB_ENV, {
      id: 'u4',
      email: 'z@b.com',
      shopifyCustomerGid: null,
    });
    expect(gid).toBe(null);
    expect(createCustomer).not.toHaveBeenCalled();
    expect(setShopifyGid).not.toHaveBeenCalled();
  });
});
```

- [ ] **Run it expecting FAIL.** Command: `npx vitest run app/lib/auth/reconcile.test.js`
  Expected: import resolution error `Failed to resolve import "./reconcile.js"`. Non-zero exit.

- [ ] **Minimal implementation.** Create `app/lib/auth/reconcile.js`:

```js
import {isStubMode} from '../admin/client.js';
import {createCustomer} from '../admin/operations.js';
import {setShopifyGid} from './users.js';

/**
 * @param {string|null|undefined} gid
 * @returns {boolean}
 */
function needsReconcile(gid) {
  return !gid || gid.includes('STUB-');
}

/**
 * Lazily backfill/upgrade a user's Shopify customer gid. When the user's gid is
 * null or a STUB- placeholder AND a real Admin token is present, create (or
 * reuse) the real customer and persist it. Returns the effective gid.
 * @param {import('@libsql/client/web').Client} db
 * @param {Record<string, any>} env
 * @param {{id: string, email: string, firstName?: string, lastName?: string, shopifyCustomerGid: string|null}} user
 * @returns {Promise<string|null>}
 */
export async function reconcileShopifyCustomer(db, env, user) {
  if (!needsReconcile(user.shopifyCustomerGid)) {
    return user.shopifyCustomerGid;
  }
  if (isStubMode(env)) {
    return user.shopifyCustomerGid ?? null;
  }
  const {gid} = await createCustomer(env, {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  });
  await setShopifyGid(db, user.id, gid);
  return gid;
}
```

- [ ] **Run test expecting PASS.** Command: `npx vitest run app/lib/auth/reconcile.test.js`
  Expected: all assertions pass, exit 0.

- [ ] **Commit.**

```
git add app/lib/auth/reconcile.js app/lib/auth/reconcile.test.js
git commit -m "feat(auth): add reconcileShopifyCustomer lazy gid backfill

When a user's shopifyCustomerGid is null or STUB- and a real Admin
token is present, create/reuse the real customer and persist it via
setShopifyGid. No-op in stub mode.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 — Wire `auth.signup.jsx` to create the Shopify customer and persist its gid

Files:
- Modify: `app/routes/auth.signup.jsx` (the signup `action` created in Phase 1) — extend the success path after `createUser` to call `createCustomer` and `setShopifyGid`. Insert the linkage between the existing `createUser(...)` call and the existing session-rotation/`loginSession(...)`/`redirect('/account')` block.

This route runs only in workerd (libSQL + sessions), so a fake unit test is impractical. We add a focused unit test for an **extracted pure helper** that decides what gid to persist, plus an explicit MANUAL verification step for the route wiring.

Steps:

- [ ] **Write failing test (pure helper).** Create `app/lib/auth/signup-link.js` import target by first writing its test `app/lib/auth/signup-link.test.js`:

```js
import {describe, it, expect, vi, beforeEach} from 'vitest';

const createCustomer = vi.fn();
const setShopifyGid = vi.fn();

vi.mock('../admin/operations.js', () => ({
  createCustomer: (...a) => createCustomer(...a),
}));
vi.mock('./users.js', () => ({
  setShopifyGid: (...a) => setShopifyGid(...a),
}));

import {linkSignupCustomer} from './signup-link.js';

const db = {__db: true};
const env = {PRIVATE_ADMIN_API_TOKEN: 't'};

beforeEach(() => {
  createCustomer.mockReset();
  setShopifyGid.mockReset();
});

describe('linkSignupCustomer', () => {
  it('creates the customer and persists the gid, returning it', async () => {
    createCustomer.mockResolvedValueOnce({gid: 'gid://shopify/Customer/7'});
    const gid = await linkSignupCustomer(db, env, {
      id: 'u1',
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
    });
    expect(gid).toBe('gid://shopify/Customer/7');
    expect(createCustomer).toHaveBeenCalledWith(env, {
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
    });
    expect(setShopifyGid).toHaveBeenCalledWith(db, 'u1', 'gid://shopify/Customer/7');
  });

  it('never throws if the Shopify call fails (signup must survive)', async () => {
    createCustomer.mockRejectedValueOnce(new Error('admin down'));
    const gid = await linkSignupCustomer(db, env, {
      id: 'u2',
      email: 'x@y.com',
    });
    expect(gid).toBe(null);
    expect(setShopifyGid).not.toHaveBeenCalled();
  });
});
```

- [ ] **Run it expecting FAIL.** Command: `npx vitest run app/lib/auth/signup-link.test.js`
  Expected: `Failed to resolve import "./signup-link.js"`. Non-zero exit.

- [ ] **Minimal implementation (helper).** Create `app/lib/auth/signup-link.js`:

```js
import {createCustomer} from '../admin/operations.js';
import {setShopifyGid} from './users.js';

/**
 * Create the Shopify customer for a freshly-signed-up user and persist its gid.
 * Best-effort: a Shopify failure must NOT fail signup; returns null on failure
 * (the gid is reconciled later by reconcileShopifyCustomer).
 * @param {import('@libsql/client/web').Client} db
 * @param {Record<string, any>} env
 * @param {{id: string, email: string, firstName?: string, lastName?: string}} user
 * @returns {Promise<string|null>}
 */
export async function linkSignupCustomer(db, env, user) {
  try {
    const {gid} = await createCustomer(env, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    await setShopifyGid(db, user.id, gid);
    return gid;
  } catch (err) {
    console.warn(
      `[signup] Shopify customer link failed for user ${user.id}: ${
        err && err.message
      } — will reconcile later.`,
    );
    return null;
  }
}
```

- [ ] **Run test expecting PASS.** Command: `npx vitest run app/lib/auth/signup-link.test.js`
  Expected: both tests pass, exit 0.

- [ ] **Wire the route (no new test; covered by MANUAL step).** Open `app/routes/auth.signup.jsx`. Add the import at the top of the file alongside the other auth imports:

```js
import {linkSignupCustomer} from '~/lib/auth/signup-link';
```

Then, in the `action`, locate the Phase 1 direct Shopify block that sits immediately after the existing `const user = await createUser(db, env, {...});` call and BEFORE the session rotation / `loginSession(...)` block. You must **REPLACE** that direct block with a single `linkSignupCustomer` call. Do NOT leave both — keeping the Phase 1 inline `createCustomer(...)`/`setShopifyGid(...)` alongside the new helper would issue a duplicate `customerCreate` on every signup.

BEFORE (the Phase 1 direct block to delete):

```js
  // Phase 1 direct linkage — REMOVE THIS.
  const {gid} = await createCustomer(env, {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  });
  await setShopifyGid(db, user.id, gid);
```

AFTER (the single helper call that replaces it, placed after `createUser` and before the session rotation / `loginSession(...)` block):

```js
  // Link to Shopify (best-effort; reconciled later if it fails). Sets the
  // gid on the user row; the session snapshot reads it just below.
  const shopifyGid = await linkSignupCustomer(db, env, user);
  user.shopifyCustomerGid = shopifyGid;
```

Since the Phase 1 block is gone, also remove its now-unused `createCustomer` / `setShopifyGid` imports from `auth.signup.jsx` if nothing else in the file uses them. Then ensure the existing `loginSession(session, {...})` call passes `gid: user.shopifyCustomerGid` (it should already read from `user`; if it currently hardcodes `gid: null`, change that argument to `gid: user.shopifyCustomerGid`).

- [ ] **MANUAL verification.** With the dev server (stub mode, no `PRIVATE_ADMIN_API_TOKEN`):
  1. Run: `npm run dev`
  2. In a browser, go to `/registro`, complete the multi-step form with a fresh email + password, submit (which POSTs to `/auth/signup`).
  3. Confirm you are redirected to `/account` and the dev server console shows the loud `[admin][STUB] Admin API stub invoked ... op=customerCreate` warning.
  4. Inspect the user row in Turso (e.g. `turso db shell <db> "select email, shopify_customer_gid from users order by created_at desc limit 1;"`) and confirm `shopify_customer_gid` is `gid://shopify/Customer/STUB-<uuid>` (not null).
  5. Sign up a second time with the **same** email: confirm signup fails with the "email ya registrado" error (EmailTakenError path from Phase 1) and NO second customer warning fires after the UNIQUE violation.

- [ ] **Commit.**

```
git add app/lib/auth/signup-link.js app/lib/auth/signup-link.test.js app/routes/auth.signup.jsx
git commit -m "feat(auth): link signup to Shopify customer and persist gid

Signup now calls createCustomer and setShopifyGid via linkSignupCustomer
(best-effort: a Shopify failure does not fail signup; reconciled later).
The session snapshot carries the resulting gid.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5 — Full Phase 2 test sweep

Files: none (verification only).

- [ ] **Run all Phase 2 unit tests.** Command:
  `npx vitest run app/lib/admin/client.test.js app/lib/admin/operations.test.js app/lib/auth/reconcile.test.js app/lib/auth/signup-link.test.js`
  Expected: all suites pass, exit 0.

- [ ] **Run the full suite to confirm no regressions.** Command: `npx vitest run`
  Expected: green (Phase 1 + Phase 2 tests pass), exit 0.

- [ ] **No commit needed** (verification only). If the sweep is green, Phase 2 is complete.
