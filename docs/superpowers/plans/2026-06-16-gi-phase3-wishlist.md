# Phase 3: Wishlist persistente Implementation Plan

> For agentic workers: This plan follows the superpowers writing-plans format. Execute tasks strictly in order. Each task is a red-green-commit TDD cycle. Do NOT skip the "run test expecting FAIL" steps — they prove the test is real. Show no placeholders; type the code exactly as written. For workerd-only code (libSQL repo, routes, AppContext fetchers) where a Node unit test is impractical, follow the explicit MANUAL verification steps with the exact commands/browser checks given. REQUIRED SUB-SKILL: superpowers:test-driven-development.

## Goal

Persist the wishlist (favoritos) as the single source of truth in Turso, keyed by authenticated user. Replace the client-only `localStorage` wishlist with a server-backed flow: an `api.wishlist.jsx` route (action toggle + loader list), a `wishlist/repo.js` module (`toggleWishlist`/`listWishlist`/`mergeWishlist`), optimistic `toggleFav` in `AppContext` wired to a fetcher, initial favs hydrated from loader props, a one-shot `localStorage.gi_favs` -> server migration after the first authenticated load, and `account.favoritos.jsx` resolving products via Storefront `nodes(ids:)`.

This corresponds to Spec section 8 (Subsistema D — Wishlist persistente) and is phase 3 of section 14.

## Architecture

- `app/lib/wishlist/repo.js` — server-only repo over the `wishlist` table. Pure SQL against a libSQL client passed in (`db`). Never imported from client components.
- `app/routes/api.wishlist.jsx` — `action` (toggle, `assertSameOrigin` + `requireUser`) and `loader` (list for the current user). Resource route, no default export/component.
- `app/lib/AppContext.jsx` — `toggleFav` posts to `/api/wishlist` via a `useFetcher` (optimistic UI); initial `favs` come from a new `favs` prop (loader-fed). One-shot migration: after the first authenticated render, if `localStorage.gi_favs` has ids, POST them as a merge to the server then clear local. `localStorage` is only authoritative when logged out.
- `app/root.jsx` — root loader fetches the user's wishlist (when authenticated) and passes `favs` into `AppProvider`.
- `app/routes/account.favoritos.jsx` — loader reads server wishlist via `listWishlist`, resolves products with a Storefront `nodes(ids:)` query, renders product cards.

The `wishlist` table (created in Phase 1 `migrate.js`) is:

```sql
CREATE TABLE IF NOT EXISTS wishlist (
  user_id    TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, product_id)
);
```

`product_id` stores the Storefront product GID (e.g. `gid://shopify/Product/123`), which is exactly what `nodes(ids:)` expects and what the existing favorites code already toggles.

## Tech Stack

- JS + JSX (no TypeScript). React Router 7 file-based routes (`@react-router/fs-routes`). Hydrogen 2026.4.2 on Oxygen (workerd).
- Loaders/actions receive `{request, context}`; `context = {storefront, customerAccount, cart, session, env}`.
- libSQL via `import {createClient} from '@libsql/client/web'` (bare `@libsql/client` is forbidden).
- Test runner: VITEST (`vitest.config.js` added in Phase 1, task 0). Command: `npx vitest run <path>`.
- Branch: `feat/auth-decoration-quotes`. Conventional commits, ending every commit body with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

### Dependencies on earlier phases (frozen contract)

This phase USES (does not define) these symbols:

- `app/lib/db/client.js` → `getDb(env)`
- `app/lib/db/migrate.js` → `migrate(db)` (already creates the `wishlist` table)
- `app/lib/auth/guard.js` → `requireUser(context)` → `{userId, role, gid, sessionVersion}`
- `app/lib/auth/session.js` → `getSessionUser(session)` → `{userId, role, gid, sessionVersion} | null`
- `app/lib/http/csrf.js` → `assertSameOrigin(request)`

If any of these are missing, Phase 1 is incomplete — stop and finish Phase 1 first.

---

## Task 1: wishlist/repo.js — toggle / list / merge

Pure-ish repo functions over a libSQL client. The unit test exercises the SQL logic against an in-memory libSQL client (`createClient({url: ':memory:'})` from `@libsql/client/web`, which works under Node in vitest), proving toggle idempotency and merge semantics.

**Files:**
- Create: `app/lib/wishlist/repo.js`
- Test: `app/lib/wishlist/repo.test.js`

Steps:

- [ ] **(1) Write the failing test.** Create `app/lib/wishlist/repo.test.js` with the COMPLETE contents:

```js
import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client/web';
import {toggleWishlist, listWishlist, mergeWishlist} from './repo.js';

/**
 * In-memory libSQL client. The same `@libsql/client/web` entry used in
 * production resolves to a local in-memory DB under Node when url is ':memory:'.
 */
async function freshDb() {
  const db = createClient({url: ':memory:'});
  await db.execute(`CREATE TABLE wishlist (
    user_id    TEXT NOT NULL,
    product_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, product_id)
  )`);
  return db;
}

const U = 'user-1';
const P1 = 'gid://shopify/Product/1';
const P2 = 'gid://shopify/Product/2';

describe('wishlist/repo', () => {
  let db;
  beforeEach(async () => {
    db = await freshDb();
  });

  it('toggleWishlist adds when absent and returns true', async () => {
    const added = await toggleWishlist(db, U, P1);
    expect(added).toBe(true);
    expect(await listWishlist(db, U)).toEqual([P1]);
  });

  it('toggleWishlist removes when present and returns false', async () => {
    await toggleWishlist(db, U, P1);
    const stillThere = await toggleWishlist(db, U, P1);
    expect(stillThere).toBe(false);
    expect(await listWishlist(db, U)).toEqual([]);
  });

  it('toggleWishlist is idempotent across an even number of calls', async () => {
    await toggleWishlist(db, U, P1);
    await toggleWishlist(db, U, P1);
    await toggleWishlist(db, U, P1);
    await toggleWishlist(db, U, P1);
    expect(await listWishlist(db, U)).toEqual([]);
    const odd = await toggleWishlist(db, U, P1);
    expect(odd).toBe(true);
    expect(await listWishlist(db, U)).toEqual([P1]);
  });

  it('listWishlist is scoped per user', async () => {
    await toggleWishlist(db, U, P1);
    await toggleWishlist(db, 'user-2', P2);
    expect(await listWishlist(db, U)).toEqual([P1]);
    expect(await listWishlist(db, 'user-2')).toEqual([P2]);
  });

  it('mergeWishlist inserts new ids and ignores duplicates without throwing', async () => {
    await toggleWishlist(db, U, P1);
    await mergeWishlist(db, U, [P1, P2]);
    const list = await listWishlist(db, U);
    expect(list.slice().sort()).toEqual([P1, P2].slice().sort());
  });

  it('mergeWishlist with empty array is a no-op', async () => {
    await toggleWishlist(db, U, P1);
    await mergeWishlist(db, U, []);
    expect(await listWishlist(db, U)).toEqual([P1]);
  });

  it('mergeWishlist filters out empty/blank ids', async () => {
    await mergeWishlist(db, U, ['', '   ', P1]);
    expect(await listWishlist(db, U)).toEqual([P1]);
  });
});
```

- [ ] **(2) Run it expecting FAIL.** Run:

```
npx vitest run app/lib/wishlist/repo.test.js
```

Expected: failure because `app/lib/wishlist/repo.js` does not exist yet. Output contains a resolution error like `Failed to resolve import "./repo.js"` (or `Cannot find module`) and the suite reports `0 passed`.

- [ ] **(3) Minimal implementation.** Create `app/lib/wishlist/repo.js` with the COMPLETE contents:

```js
/* ============================================================
   Generando Ideas — Wishlist repository (server-only)
   Single source of truth for favorites, keyed by user.
   `db` is a libSQL client created per request via getDb(env).
   `productId` is the Storefront product GID.
   ============================================================ */

/**
 * Toggle a product in the user's wishlist.
 * @param {import('@libsql/client/web').Client} db
 * @param {string} userId
 * @param {string} productId
 * @returns {Promise<boolean>} true if now added, false if removed
 */
export async function toggleWishlist(db, userId, productId) {
  const existing = await db.execute({
    sql: 'SELECT 1 FROM wishlist WHERE user_id = ? AND product_id = ? LIMIT 1',
    args: [userId, productId],
  });
  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
      args: [userId, productId],
    });
    return false;
  }
  await db.execute({
    sql: 'INSERT INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, ?)',
    args: [userId, productId, new Date().toISOString()],
  });
  return true;
}

/**
 * List the product GIDs in the user's wishlist, newest first.
 * @param {import('@libsql/client/web').Client} db
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function listWishlist(db, userId) {
  const result = await db.execute({
    sql: 'SELECT product_id FROM wishlist WHERE user_id = ? ORDER BY created_at DESC',
    args: [userId],
  });
  return result.rows.map((row) => String(row.product_id));
}

/**
 * Merge a set of product GIDs into the user's wishlist (additive, idempotent).
 * Blank ids are ignored. Existing ids are left untouched.
 * @param {import('@libsql/client/web').Client} db
 * @param {string} userId
 * @param {string[]} productIds
 * @returns {Promise<void>}
 */
export async function mergeWishlist(db, userId, productIds) {
  const clean = (productIds || [])
    .map((id) => String(id).trim())
    .filter(Boolean);
  if (clean.length === 0) return;
  const now = new Date().toISOString();
  await db.batch(
    clean.map((productId) => ({
      sql: 'INSERT OR IGNORE INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, ?)',
      args: [userId, productId, now],
    })),
    'write',
  );
}
```

- [ ] **(4) Run the test expecting PASS.** Run:

```
npx vitest run app/lib/wishlist/repo.test.js
```

Expected: all 7 tests pass (`7 passed`).

- [ ] **(5) Commit.** Run:

```
git add app/lib/wishlist/repo.js app/lib/wishlist/repo.test.js
git commit -m "feat(wishlist): add toggle/list/merge repo with idempotency tests

toggleWishlist returns true on add / false on remove; mergeWishlist is
additive and idempotent via INSERT OR IGNORE. Unit tested against an
in-memory libSQL client.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: api.wishlist.jsx — action toggle + loader list

Resource route. `action` reads `productId` from the form body, calls `assertSameOrigin` then `requireUser`, then `toggleWishlist`. `loader` returns the current user's list (empty array when logged out). Because this is workerd-only (libSQL + sessions + React Router data API), there is no fake unit test; instead a vitest test asserts the route module's pure shape (exports an `action` and `loader`, no default export) and MANUAL verification covers runtime behavior.

**Files:**
- Create: `app/routes/api.wishlist.jsx`
- Test: `app/routes/api.wishlist.shape.test.js`

Steps:

- [ ] **(1) Write the failing test.** Create `app/routes/api.wishlist.shape.test.js` with the COMPLETE contents:

```js
import {describe, it, expect} from 'vitest';
import * as route from './api.wishlist.jsx';

describe('api.wishlist route module shape', () => {
  it('exports an action function', () => {
    expect(typeof route.action).toBe('function');
  });
  it('exports a loader function', () => {
    expect(typeof route.loader).toBe('function');
  });
  it('does not export a default component (resource route)', () => {
    expect(route.default).toBeUndefined();
  });
});
```

- [ ] **(2) Run it expecting FAIL.** Run:

```
npx vitest run app/routes/api.wishlist.shape.test.js
```

Expected: failure — import of `./api.wishlist.jsx` fails to resolve (`Failed to resolve import`), suite reports `0 passed`.

- [ ] **(3) Minimal implementation.** Create `app/routes/api.wishlist.jsx` with the COMPLETE contents:

```js
/* ============================================================
   Generando Ideas — Wishlist resource route
   POST  /api/wishlist  -> toggle (form field: productId)
   GET   /api/wishlist  -> list current user's product GIDs
   Server-only: assertSameOrigin + requireUser gate the action.
   ============================================================ */
import {data} from 'react-router';
import {getDb} from '~/lib/db/client';
import {requireUser} from '~/lib/auth/guard';
import {getSessionUser} from '~/lib/auth/session';
import {assertSameOrigin} from '~/lib/http/csrf';
import {toggleWishlist, listWishlist, mergeWishlist} from '~/lib/wishlist/repo';

/**
 * @param {import('react-router').ActionFunctionArgs & {context: any}} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);
  const {userId} = await requireUser(context);
  const form = await request.formData();
  const intent = String(form.get('intent') || 'toggle');
  const db = getDb(context.env);

  if (intent === 'merge') {
    const raw = String(form.get('productIds') || '[]');
    let ids = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) ids = parsed.map((x) => String(x));
    } catch {
      ids = [];
    }
    await mergeWishlist(db, userId, ids);
    const favs = await listWishlist(db, userId);
    return data({favs});
  }

  const productId = String(form.get('productId') || '').trim();
  if (!productId) {
    return data({error: 'productId required'}, {status: 400});
  }
  const added = await toggleWishlist(db, userId, productId);
  const favs = await listWishlist(db, userId);
  return data({added, favs});
}

/**
 * @param {import('react-router').LoaderFunctionArgs & {context: any}} args
 */
export async function loader({context}) {
  const sessionUser = getSessionUser(context.session);
  if (!sessionUser) return data({favs: []});
  const db = getDb(context.env);
  const favs = await listWishlist(db, sessionUser.userId);
  return data({favs});
}
```

- [ ] **(4) Run the test expecting PASS.** Run:

```
npx vitest run app/routes/api.wishlist.shape.test.js
```

Expected: `3 passed`.

- [ ] **(5) MANUAL verification.** Run the dev server and verify runtime behavior (the shape test cannot exercise libSQL/sessions):

```
npm run dev
```

Then, logged in as a real user (signup/login from Phase 1) in the browser:
  1. Open DevTools → Network. Navigate to a PDP and click the heart on a product. Confirm a `POST /api/wishlist` with form field `productId=gid://shopify/Product/...` returns `200` with JSON `{"added":true,"favs":[...]}`.
  2. Click the heart again on the same product; confirm the response is `{"added":false,...}` and the product GID is gone from `favs`.
  3. In the browser console run `await fetch('/api/wishlist').then(r=>r.json())` and confirm it returns `{"favs":[...]}` matching the toggles above.
  4. Cross-origin guard: in console run
     `fetch('/api/wishlist',{method:'POST',headers:{Origin:'https://evil.example'},body:new URLSearchParams({productId:'gid://shopify/Product/1'})})`
     and confirm it returns `403 Forbidden` (assertSameOrigin default-deny).
  5. Logged out: confirm `GET /api/wishlist` returns `{"favs":[]}` and a `POST` redirects to `/login` (requireUser).

- [ ] **(6) Commit.** Run:

```
git add app/routes/api.wishlist.jsx app/routes/api.wishlist.shape.test.js
git commit -m "feat(wishlist): add api.wishlist resource route (toggle/merge action + list loader)

assertSameOrigin + requireUser gate the action; loader returns [] when
logged out. Includes merge intent for the one-shot localStorage migration.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: root loader feeds initial favs into AppProvider

Hydrate the wishlist from the server on first load so the UI is correct before any client fetch. The root loader fetches `listWishlist` when authenticated and passes `favs` to `AppProvider`. Workerd-only; verified manually plus a small shape test on the loader return contract is impractical (the loader calls Hydrogen context), so this task is MANUAL-verified with a build check.

**Files:**
- Modify: `app/root.jsx` (the `loadCriticalData({context})` function around lines 99-114; `<AppProvider>` usage around line 185)

> IMPORTANT: The edit in this task targets the `loadCriticalData({context})` function (around lines 99-114), NOT a top-level `loader(args)`. That function destructures `{context}` directly, so use `context.session` / `context.env` (there is no `args.context` in scope here).
>
> NOTE — sequencing on top of Phase 1: Phase 1 has ALREADY edited `loadCriticalData` to replace `customerAccount.isLoggedIn()` with a session snapshot (via `getSessionUser(context.session)` / `context.session`). So in the working tree the BEFORE strings differ from a stock Hydrogen scaffold: `isLoggedIn` is now derived from the session, not from `customerAccount.isLoggedIn()`. Phase 3's edits here sequence on top of Phase 1's edited version — favs is added alongside the existing values and the function returns the object `{header, isLoggedIn, favs}`. Read the actual current `loadCriticalData` body before editing and match its real text.

Steps:

- [ ] **(1) Read the current loadCriticalData and AppProvider usage.** Open `app/root.jsx` and locate:
  - the `loadCriticalData({context})` function body (around lines 99-114). After Phase 1 it derives `isLoggedIn` from the session snapshot (e.g. `getSessionUser(context.session)`) rather than `customerAccount.isLoggedIn()`, and ends with `return {header, isLoggedIn};`.
  - the JSX `<AppProvider isLoggedIn={data.isLoggedIn}>` (line ~185).

- [ ] **(2) Add the imports.** At the top of `app/root.jsx`, alongside the existing imports, add:

```js
import {getDb} from '~/lib/db/client';
import {getSessionUser} from '~/lib/auth/session';
import {listWishlist} from '~/lib/wishlist/repo';
```

- [ ] **(3) Fetch favs in `loadCriticalData`.** This targets the `loadCriticalData({context})` function (around lines 99-114), which destructures `{context}` directly — so reference `context.session` / `context.env` (NOT `args.context`). After the existing `Promise.all([...])` resolves, compute `favs` and include it in the returned object. Concretely, replace the existing `return {header, isLoggedIn};` line with:

```js
  let favs = [];
  const sessionUser = getSessionUser(context.session);
  if (sessionUser) {
    try {
      const db = getDb(context.env);
      favs = await listWishlist(db, sessionUser.userId);
    } catch {
      favs = [];
    }
  }

  return {header, isLoggedIn, favs};
```

(Phase 1 already replaced `customerAccount.isLoggedIn()` with the session snapshot in this same function, so `isLoggedIn` is already derived from the session and `getSessionUser(context.session)` reuses that same source. This edit sequences on top of Phase 1's edited version: `favs` is added alongside the existing `header`/`isLoggedIn` so the function returns `{header, isLoggedIn, favs}`.)

- [ ] **(4) Pass favs to AppProvider.** Change:

```jsx
      <AppProvider isLoggedIn={data.isLoggedIn}>
```

to:

```jsx
      <AppProvider isLoggedIn={data.isLoggedIn} favs={data.favs}>
```

- [ ] **(5) MANUAL verification.** Run:

```
npm run build
```

Expected: build succeeds with no resolution errors. Then `npm run dev`, log in, toggle a couple of favorites on PDPs, hard-refresh the page, and confirm via the heart icons (filled state) that the previously-favorited products are still marked — proving favs are hydrated from the server loader, not localStorage.

- [ ] **(6) Commit.** Run:

```
git add app/root.jsx
git commit -m "feat(wishlist): hydrate initial favs from server in root loader

root loader fetches listWishlist for the authenticated user and passes
favs into AppProvider so the UI is correct before any client fetch.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: AppContext toggleFav -> fetcher (optimistic) + one-shot migration

`AppProvider` accepts a `favs` prop. When logged in, `favs` is initialized from props (not localStorage) and `toggleFav` optimistically updates state then POSTs to `/api/wishlist` via a fetcher, reconciling with the server response. After the first authenticated render, a one-shot effect reads `localStorage.gi_favs`, and if non-empty, POSTs a `merge` to the server then clears the local key. When logged out, behavior is unchanged (localStorage).

The pure reconciliation helper (`reconcileFavs`) is unit-tested; the fetcher/effect wiring is verified manually.

**Files:**
- Modify: `app/lib/AppContext.jsx`
- Test: `app/lib/AppContext.favs.test.js`

Steps:

- [ ] **(1) Write the failing test.** Create `app/lib/AppContext.favs.test.js` with the COMPLETE contents:

```js
import {describe, it, expect} from 'vitest';
import {reconcileFavs} from './AppContext.jsx';

describe('reconcileFavs', () => {
  it('returns the server list verbatim when provided an array', () => {
    expect(reconcileFavs(['a', 'b'], ['a'])).toEqual(['a', 'b']);
  });

  it('falls back to the optimistic list when server list is missing', () => {
    expect(reconcileFavs(undefined, ['a', 'b'])).toEqual(['a', 'b']);
    expect(reconcileFavs(null, ['x'])).toEqual(['x']);
  });

  it('falls back to the optimistic list when server value is not an array', () => {
    expect(reconcileFavs('nope', ['a'])).toEqual(['a']);
  });

  it('returns an empty array when the server clears the list', () => {
    expect(reconcileFavs([], ['a', 'b'])).toEqual([]);
  });
});
```

- [ ] **(2) Run it expecting FAIL.** Run:

```
npx vitest run app/lib/AppContext.favs.test.js
```

Expected: failure — `reconcileFavs` is not exported (`reconcileFavs is not a function` / import is `undefined`), suite reports failing assertions.

- [ ] **(3) Minimal implementation.** Edit `app/lib/AppContext.jsx`:

3a. Add `useFetcher` to the `react-router` import (the file currently imports React hooks only). Add this import near the top, after the React import block:

```js
import {useFetcher} from 'react-router';
```

3b. Export the pure helper. Add this function near the bottom of the file, next to the color helpers:

```js
/**
 * Pick the authoritative favorites list after a wishlist mutation.
 * The server response wins when it is an array; otherwise keep the
 * optimistic local list.
 * @param {unknown} serverFavs
 * @param {string[]} optimisticFavs
 * @returns {string[]}
 */
export function reconcileFavs(serverFavs, optimisticFavs) {
  return Array.isArray(serverFavs) ? serverFavs : optimisticFavs;
}
```

3c. Change the `AppProvider` signature to accept `favs`:

```js
export function AppProvider({children, isLoggedIn = false, favs: initialFavs = []}) {
```

3d. Initialize the `favs` state from props instead of `[]`:

Change:

```js
  const [favs, setFavs] = useState([]);
```

to:

```js
  const [favs, setFavs] = useState(initialFavs);
  const wishlistFetcher = useFetcher();
```

3e. In the hydrate-from-localStorage effect, do NOT overwrite favs when logged in. Change:

```js
  useEffect(() => {
    setRole(read(STORE.role, 'buyer'));
    setQuote(read(STORE.quote, []));
    setFavs(read(STORE.favs, []));
    setTweaks({...DEFAULT_TWEAKS, ...read(STORE.tweaks, {})});
    setHydrated(true);
  }, []);
```

to:

```js
  useEffect(() => {
    setRole(read(STORE.role, 'buyer'));
    setQuote(read(STORE.quote, []));
    if (!isLoggedIn) setFavs(read(STORE.favs, []));
    setTweaks({...DEFAULT_TWEAKS, ...read(STORE.tweaks, {})});
    setHydrated(true);
  }, [isLoggedIn]);
```

3f. Only persist favs to localStorage when logged out. Change:

```js
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORE.favs, JSON.stringify(favs));
  }, [favs, hydrated]);
```

to:

```js
  useEffect(() => {
    if (hydrated && !isLoggedIn)
      window.localStorage.setItem(STORE.favs, JSON.stringify(favs));
  }, [favs, hydrated, isLoggedIn]);
```

3g. Add the one-shot migration effect. Insert it right after the persist effects:

```js
  // One-shot localStorage -> server migration after first authenticated load.
  const [migratedFavs, setMigratedFavs] = useState(false);
  useEffect(() => {
    if (!hydrated || !isLoggedIn || migratedFavs) return;
    setMigratedFavs(true);
    const local = read(STORE.favs, []);
    if (Array.isArray(local) && local.length > 0) {
      const body = new FormData();
      body.set('intent', 'merge');
      body.set('productIds', JSON.stringify(local));
      wishlistFetcher.submit(body, {method: 'POST', action: '/api/wishlist'});
    }
    window.localStorage.removeItem(STORE.favs);
  }, [hydrated, isLoggedIn, migratedFavs, wishlistFetcher]);
```

3h. Rewrite `toggleFav` to be optimistic + server-backed when logged in, local-only when logged out. Change:

```js
  const toggleFav = useCallback((id) => {
    setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  }, []);
```

to:

```js
  const toggleFav = useCallback(
    (id) => {
      setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
      if (isLoggedIn) {
        const body = new FormData();
        body.set('intent', 'toggle');
        body.set('productId', id);
        wishlistFetcher.submit(body, {method: 'POST', action: '/api/wishlist'});
      }
    },
    [isLoggedIn, wishlistFetcher],
  );
```

3i. Reconcile favs with the server response when the fetcher returns. Insert this effect after the migration effect:

```js
  // Reconcile optimistic favs with the authoritative server response.
  useEffect(() => {
    if (wishlistFetcher.data && Array.isArray(wishlistFetcher.data.favs)) {
      setFavs((current) => reconcileFavs(wishlistFetcher.data.favs, current));
    }
  }, [wishlistFetcher.data]);
```

- [ ] **(4) Run the test expecting PASS.** Run:

```
npx vitest run app/lib/AppContext.favs.test.js
```

Expected: `4 passed`.

- [ ] **(5) MANUAL verification.** Run `npm run dev`.
  1. Logged out: toggle favorites on PDPs; confirm `localStorage.gi_favs` updates and no `/api/wishlist` request fires (Network tab).
  2. While still holding those localStorage favs, log in. On the first authenticated load confirm a single `POST /api/wishlist` with `intent=merge` fires and that `localStorage.gi_favs` is then removed (Application → Local Storage). Refresh: the migrated favorites persist (loaded from server).
  3. Logged in: toggle a heart; confirm the UI updates instantly (optimistic) and a `POST /api/wishlist intent=toggle` fires; the heart's filled state matches the server `favs` after the response.

- [ ] **(6) Commit.** Run:

```
git add app/lib/AppContext.jsx app/lib/AppContext.favs.test.js
git commit -m "feat(wishlist): optimistic toggleFav via fetcher + one-shot localStorage migration

When logged in, favs init from loader props, toggleFav posts to
/api/wishlist optimistically and reconciles with the server response, and
a one-shot effect merges localStorage.gi_favs then clears it. Logged out
keeps the localStorage behavior. reconcileFavs is unit tested.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: account.favoritos.jsx reads server + resolves products via Storefront nodes(ids:)

The favoritos page loader reads the server wishlist (`listWishlist` for the authenticated user) and resolves the product details with a Storefront `nodes(ids:)` query, then renders product cards. The pure GID-filter helper is unit-tested; the loader/Storefront wiring is verified manually.

**Files:**
- Modify: `app/routes/account.favoritos.jsx`
- Test: `app/routes/account.favoritos.helper.test.js`

Steps:

- [ ] **(1) Write the failing test.** Create `app/routes/account.favoritos.helper.test.js` with the COMPLETE contents:

```js
import {describe, it, expect} from 'vitest';
import {keepProducts} from './account.favoritos.jsx';

describe('keepProducts', () => {
  it('keeps only non-null Product nodes', () => {
    const nodes = [
      {__typename: 'Product', id: 'gid://shopify/Product/1', handle: 'a'},
      null,
      {__typename: 'Collection', id: 'gid://shopify/Collection/9'},
      {__typename: 'Product', id: 'gid://shopify/Product/2', handle: 'b'},
    ];
    const out = keepProducts(nodes);
    expect(out.map((p) => p.id)).toEqual([
      'gid://shopify/Product/1',
      'gid://shopify/Product/2',
    ]);
  });

  it('returns an empty array for null/undefined input', () => {
    expect(keepProducts(null)).toEqual([]);
    expect(keepProducts(undefined)).toEqual([]);
  });
});
```

- [ ] **(2) Run it expecting FAIL.** Run:

```
npx vitest run app/routes/account.favoritos.helper.test.js
```

Expected: failure — `keepProducts` is not exported from `account.favoritos.jsx` (currently it only has a default component). Assertion/import fails, `0 passed`.

- [ ] **(3) Minimal implementation.** Replace the COMPLETE contents of `app/routes/account.favoritos.jsx` with:

```js
import {useLoaderData, useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';
import {ProductCard} from '~/components/gi/ProductCard';
import {getDb} from '~/lib/db/client';
import {requireUser} from '~/lib/auth/guard';
import {listWishlist} from '~/lib/wishlist/repo';
import {normalizeProduct} from '~/lib/gi';

const FAVORITOS_QUERY = `#graphql
  query FavoritosNodes($ids: [ID!]!, $country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    nodes(ids: $ids) {
      __typename
      ... on Product {
        id
        handle
        title
        featuredImage { url altText width height }
        priceRange { minVariantPrice { amount currencyCode } }
        variants(first: 1) { nodes { id } }
      }
    }
  }
`;

/**
 * Keep only the non-null Product nodes returned by `nodes(ids:)`.
 * @param {Array<{__typename?: string} | null> | null | undefined} nodes
 * @returns {Array<object>}
 */
export function keepProducts(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.filter((n) => n && n.__typename === 'Product');
}

/**
 * @param {import('react-router').LoaderFunctionArgs & {context: any}} args
 */
export async function loader({context}) {
  const {userId} = await requireUser(context);
  const db = getDb(context.env);
  const ids = await listWishlist(db, userId);
  if (ids.length === 0) return {products: []};
  const {nodes} = await context.storefront.query(FAVORITOS_QUERY, {
    variables: {ids},
  });
  const products = keepProducts(nodes).map((node) => normalizeProduct(node));
  return {products};
}

export default function AccountFavoritos() {
  const navigate = useNavigate();
  const {products} = useLoaderData();

  return (
    <>
      <h1>Favoritos</h1>
      <p style={{color: 'var(--ink-3)', margin: '-8px 0 0'}}>
        Productos que guardaste para revisar o cotizar más tarde.
      </p>

      {products.length === 0 ? (
        <div className="empty">
          <Icon name="heart_outline" size={32} className="muted-2" />
          <h3>Aún no tienes favoritos</h3>
          <p>Marca el corazón en cualquier producto para guardarlo aquí.</p>
          <Button
            variant="accent"
            iconRight="arrow_right"
            onClick={() => navigate('/catalogo')}
          >
            Explorar catálogo
          </Button>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}
```

> Note: `normalizeProduct` and `ProductCard` already exist (`app/lib/gi.js`, `app/components/gi/ProductCard.jsx`). If `normalizeProduct` requires fields not selected above (verify by reading `app/lib/gi.js` before this step), extend the `... on Product` selection to include them — do NOT change `normalizeProduct`'s contract. The `.product-grid` class is the same one used by the catalog routes; reuse it.

- [ ] **(4) Run the test expecting PASS.** Run:

```
npx vitest run app/routes/account.favoritos.helper.test.js
```

Expected: `2 passed`.

- [ ] **(5) MANUAL verification.** Run `npm run dev`, log in, favorite 2-3 real products from the catalog, then navigate to `/account/favoritos`. Confirm:
  1. The page renders a product grid with exactly the favorited products (titles/images correct), resolved via Storefront `nodes(ids:)` (check Network for the `FavoritosNodes` GraphQL call carrying the product GIDs).
  2. Un-favoriting a product (heart toggle) and reloading `/account/favoritos` removes it from the grid.
  3. With zero favorites, the empty state ("Aún no tienes favoritos") renders.

- [ ] **(6) Commit.** Run:

```
git add app/routes/account.favoritos.jsx app/routes/account.favoritos.helper.test.js
git commit -m "feat(wishlist): account.favoritos reads server wishlist + resolves via nodes(ids:)

Loader reads listWishlist for the authenticated user and resolves product
details through the Storefront nodes(ids:) query, rendering ProductCards.
keepProducts filter is unit tested.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Done criteria

- `npx vitest run app/lib/wishlist app/routes/api.wishlist.shape.test.js app/lib/AppContext.favs.test.js app/routes/account.favoritos.helper.test.js` all pass.
- `npm run build` succeeds.
- All MANUAL verification steps in tasks 2-5 pass in the browser.
- The wishlist is the single source of truth in Turso for authenticated users; localStorage is only used when logged out and is migrated once on first authenticated load.
