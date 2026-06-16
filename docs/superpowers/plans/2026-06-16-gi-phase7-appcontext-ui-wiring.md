# Phase 7: AppContext state + PDP/quote UI wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the server-side auth, quote, and wishlist subsystems (built in Phases 1-6) into the existing storefront UI by reworking `AppContext` to hydrate from loader props with a read-only role, converting quote mutations into optimistic server fetchers keyed by server `item.id`, and wiring the PDP and `cotizacion.jsx` to the `/api/quote/*` routes so the server is the sole authority on prices.

**Architecture:** `root.jsx` (and the `account` loader) pass server-derived `{role, quote, favs}` into `AppProvider` as initial props. `AppProvider` seeds its state from those props instead of `localStorage`, drops `setRole` and the role localStorage gating, and routes `addToQuote/updateQuoteQty/removeFromQuote/clearQuote` through React Router `useFetcher` POSTs to the Phase 4 `/api/quote/add|update|remove` routes. A pure `mergeQuoteState` reducer (unit-tested with vitest) reconciles the optimistic client list against each fetcher response, which the server recomputes via the Phase 5 decoration engine. The PDP add-to-quote button posts exactly `{variantId, technique, surface, size, qty}` from `DecorationSelector`'s `decoDetail`; `cotizacion.jsx` line edits post `itemId` (server `quote_items.id`), never `variantId`.

**Tech Stack:** Shopify Hydrogen (React Router 7) on Oxygen/workerd, React `useFetcher`, Turso/libSQL repos (`app/lib/quotes/repo.js`), vitest for the pure reducer, manual browser verification for workerd-only route/component wiring.

---

## Dependencies and frozen contracts (read before starting)

This phase runs **LAST**. It **consumes** artifacts produced by earlier phases — do **not** recreate them:

- **Phase 1-2 (auth):** `requireUser(context)` in `app/lib/auth/guard.js`; `getUser(session)` snapshot in `app/lib/auth/session.js`; `getDb(context)` (libSQL `/web` client, per-request) in `app/lib/db/client.js`. The Turso `users` row carries the authoritative `role` (`'quoter'` default).
- **Phase 3 (wishlist):** `api.wishlist.jsx` (action toggle + loader list). The favs **server fetcher and the one-shot `localStorage.gi_favs` → server migration already exist in `AppContext` from Phase 3** — this phase must NOT duplicate them. This phase only ensures the favs **initial state** is seeded from the `favs` prop.
- **Phase 4 (quotes):** routes `app/routes/api.quote.add.jsx`, `api.quote.update.jsx`, `api.quote.remove.jsx`, `api.quote.submit.jsx`. Each calls `assertSameOrigin` + `requireUser`, recomputes prices server-side, and returns JSON `{ok, quote}` where `quote` is the full draft (see contract below).
- **Phase 4 repo — `app/lib/quotes/repo.js` (frozen signatures, do not change):**
  - `getOrCreateDraftQuote(db, userId) -> {id, user_id, status, notes, deadline, ...}`
  - `getQuoteWithItems(db, userId) -> {id, status, notes, deadline, items: QuoteItem[]} | null`
  - `upsertQuoteItem(db, quoteId, {variantId, productHandle, title, qty, baseUnitPrice, technique, surface, size, decorationTotal, effectiveUnitPrice}) -> QuoteItem`
  - `removeQuoteItem(db, quoteId, itemId) -> void`
- **Phase 5 (decoration):** `app/components/gi/DecorationSelector.jsx` calls `onChange(decoDetail)` where `decoDetail = {technique, surface, size, qty}` (inputs only, no prices). `app/lib/decoration/engine.js` is server-side.

**Frozen `QuoteItem` shape** (returned by repo and `/api/quote/*`, keyed by server `id`):

```js
// QuoteItem — one row of quote_items (Turso), serialized to the client
{
  id: 'uuid',                 // server quote_items.id — THE client key
  variantId: 'gid://...',     // variant_id (production reference)
  productHandle: 'tote-bag',
  title: 'Tote Bag',
  qty: 300,                   // INTEGER, >= 1
  baseUnitPrice: 25.0,        // base_unit_price (Storefront, authoritative)
  technique: 'SERIGRAFÍA',    // may be 'Sin decorado'
  surface: 'TEXTIL',
  size: '4 x 4',
  decorationTotal: 1491.04,   // decoration_total (raw number)
  effectiveUnitPrice: 29.97,  // round2(base + decoration_total/qty)
  image: 'https://...',       // optional, for cart render
  sku: 'TB-001',              // optional
  options: [{name, value}],   // optional, selectedOptions
}
```

**Frozen `/api/quote/*` JSON contract** (every route returns this on success):

```js
// POST /api/quote/add    body: {variantId, technique, surface, size, qty}
// POST /api/quote/update body: {itemId, qty}
// POST /api/quote/remove body: {itemId}
// -> 200 { ok: true, quote: { id, status, notes, deadline, items: QuoteItem[] } }
// -> 4xx { ok: false, error: 'message' }
```

The client never sends prices; the server recomputes them. The client reconciles its optimistic state from `quote.items` in the response.

---

## File structure

- **Modify** `app/lib/AppContext.jsx` — accept `{role, quote, favs}` initial props; read-only `role`; quote actions become `useFetcher` POSTs reconciled via `mergeQuoteState`; favs initial state from props (do not touch the existing Phase 3 favs fetcher/migration).
- **Create** `app/lib/quote-state.js` — pure `mergeQuoteState(prev, serverQuote)` reducer + `quotePieceCount(items)` helper. Server-agnostic, vitest-tested.
- **Create** `app/lib/quote-state.test.js` — vitest unit tests for the reducer/helper.
- **Modify** `app/root.jsx` — loader returns `{role, quote, favs}` from the session snapshot + `getQuoteWithItems` + wishlist; pass them to `AppProvider`.
- **Modify** `app/routes/products.$handle.jsx` — render `DecorationSelector`, capture `decoDetail`, post exactly `{variantId, technique, surface, size, qty}` via `addToQuote`, reconcile from response.
- **Modify** `app/routes/cotizacion.jsx` — hydrate line items from server `quote` (keyed by `item.id`); +/- and remove call `updateQuoteQty(item.id, qty)` / `removeFromQuote(item.id)`.

---

## Task 1: Pure quote-state reducer (TDD)

The only pure logic in this phase: reconciling the optimistic client quote against a server response, and counting pieces. Keyed by server `item.id`. This is the single vitest-tested unit; everything else is workerd-only wiring verified manually.

**Files:**
- Create: `app/lib/quote-state.js`
- Test: `app/lib/quote-state.test.js`

- [ ] **Step 1: Write the failing test**

```js
// app/lib/quote-state.test.js
import {describe, it, expect} from 'vitest';
import {mergeQuoteState, quotePieceCount} from './quote-state.js';

const item = (over = {}) => ({
  id: 'i1',
  variantId: 'gid://v1',
  productHandle: 'tote',
  title: 'Tote',
  qty: 10,
  baseUnitPrice: 25,
  technique: 'Sin decorado',
  surface: '',
  size: '',
  decorationTotal: 0,
  effectiveUnitPrice: 25,
  ...over,
});

describe('mergeQuoteState', () => {
  it('replaces client list with the authoritative server items', () => {
    const prev = [item({id: 'i1', qty: 5, effectiveUnitPrice: 999})];
    const server = {id: 'q1', status: 'draft', items: [item({id: 'i1', qty: 10, effectiveUnitPrice: 25})]};
    const next = mergeQuoteState(prev, server);
    expect(next).toHaveLength(1);
    expect(next[0].qty).toBe(10);
    expect(next[0].effectiveUnitPrice).toBe(25); // server price wins, never client
  });

  it('returns an empty array when the server draft has no items', () => {
    expect(mergeQuoteState([item()], {id: 'q1', status: 'draft', items: []})).toEqual([]);
  });

  it('returns an empty array when the server quote is null (no draft yet)', () => {
    expect(mergeQuoteState([item()], null)).toEqual([]);
  });

  it('ignores a malformed server response and keeps prev (defensive on optimistic failure)', () => {
    const prev = [item({id: 'i1'})];
    expect(mergeQuoteState(prev, undefined)).toBe(prev);
    expect(mergeQuoteState(prev, {id: 'q1'})).toBe(prev); // no items array
  });

  it('keys strictly by server id, dropping client-only optimistic rows', () => {
    const prev = [item({id: 'temp-optimistic'}), item({id: 'i1'})];
    const server = {id: 'q1', status: 'draft', items: [item({id: 'i1', qty: 7})]};
    const next = mergeQuoteState(prev, server);
    expect(next.map((i) => i.id)).toEqual(['i1']);
    expect(next[0].qty).toBe(7);
  });
});

describe('quotePieceCount', () => {
  it('sums qty across items', () => {
    expect(quotePieceCount([item({qty: 3}), item({id: 'i2', qty: 4})])).toBe(7);
  });
  it('returns 0 for empty', () => {
    expect(quotePieceCount([])).toBe(0);
  });
  it('treats missing/NaN qty as 0', () => {
    expect(quotePieceCount([item({qty: undefined}), item({id: 'i2', qty: 5})])).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/quote-state.test.js`
Expected: FAIL — `Failed to resolve import "./quote-state.js"` / `mergeQuoteState is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// app/lib/quote-state.js
/* ============================================================
   Pure quote-state reconciliation (no I/O, no React).
   The server (/api/quote/*) is authoritative for prices and item ids;
   the client list is reconciled from the server draft after every fetch.
   Items are keyed by the server quote_items.id.
   ============================================================ */

/**
 * Reconcile the optimistic client quote against the server draft.
 * @param {Array} prev - current client items (may contain optimistic temp rows)
 * @param {{items?: Array}|null|undefined} serverQuote - response from getQuoteWithItems / /api/quote/*
 * @returns {Array} authoritative item list (server wins), or `prev` when the response is malformed
 */
export function mergeQuoteState(prev, serverQuote) {
  if (serverQuote === null) return [];
  if (!serverQuote || !Array.isArray(serverQuote.items)) return prev;
  // Server is the single source of truth: take its items verbatim, keyed by id.
  return serverQuote.items.map((it) => ({...it}));
}

/** Total pieces across the quote (NaN/missing qty counts as 0). */
export function quotePieceCount(items) {
  return (items || []).reduce((n, i) => n + (Number.isFinite(i.qty) ? i.qty : 0), 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/quote-state.test.js`
Expected: PASS — 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/lib/quote-state.js app/lib/quote-state.test.js
git commit -m "$(cat <<'EOF'
feat(quote): pure quote-state reducer keyed by server item id

mergeQuoteState reconciles the optimistic client list against the
authoritative server draft; quotePieceCount sums qty. Unit-tested.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Rework AppProvider — initial props + read-only role

Make `AppProvider` accept `{role, quote, favs}` from the loader and seed state from them. Make `role` **read-only**: remove `setRole`, the `STORE.role` localStorage entry, and the role hydrate/persist effects. Do **not** touch the existing Phase 3 favs server fetcher or the one-shot migration; only change how `favs` is **initialized** (from props). Quote action wiring happens in Task 3 — this task only changes initialization and the role removal.

**Files:**
- Modify: `app/lib/AppContext.jsx`

- [ ] **Step 1: Change the `AppProvider` signature and seed state from props**

Replace the function signature and the four `useState` initializers (currently lines 42-49) so role/quote/favs default to the loader props:

```jsx
export function AppProvider({
  children,
  isLoggedIn = false,
  role: roleProp = 'quoter',
  quote: quoteProp = [],
  favs: favsProp = [],
}) {
  // hydrated=false during SSR + first client paint to avoid mismatch
  const [hydrated, setHydrated] = useState(false);
  // role is READ-ONLY: it comes from the Turso user via the loader, never from the client.
  const role = roleProp;
  const [quote, setQuote] = useState(quoteProp);
  const [favs, setFavs] = useState(favsProp);
  const [tweaks, setTweaks] = useState(DEFAULT_TWEAKS);
  const [toasts, setToasts] = useState([]);
```

- [ ] **Step 2: Remove the role from the localStorage `STORE` map**

Edit the `STORE` const (currently lines 16-21) to drop the `role` key:

```jsx
const STORE = {
  quote: 'gi_quote',
  favs: 'gi_favs',
  tweaks: 'gi_tweaks',
};
```

- [ ] **Step 3: Remove role from the hydrate effect and drop quote/favs localStorage seeding when logged in**

Replace the hydrate effect (currently lines 51-58). Role is gone entirely. Quote and favs are now seeded from props (server), so localStorage is only a fallback for anonymous visitors — when `isLoggedIn`, the props are authoritative and we must not overwrite them from stale localStorage:

```jsx
  // Hydrate UI-only prefs from localStorage on mount.
  // quote/favs come from loader props when authenticated; localStorage is the
  // anonymous-only fallback (server is authoritative once logged in).
  useEffect(() => {
    if (!isLoggedIn) {
      setQuote(read(STORE.quote, []));
      setFavs(read(STORE.favs, []));
    }
    setTweaks({...DEFAULT_TWEAKS, ...read(STORE.tweaks, {})});
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 4: Remove the role persist effect; gate quote/favs persistence to anonymous**

Replace the four persist effects (currently lines 60-72) with three, dropping the role one and writing quote/favs to localStorage only for anonymous visitors (authenticated state lives on the server):

```jsx
  // Persist UI prefs. quote/favs only mirror to localStorage when anonymous.
  useEffect(() => {
    if (hydrated && !isLoggedIn)
      window.localStorage.setItem(STORE.quote, JSON.stringify(quote));
  }, [quote, hydrated, isLoggedIn]);
  useEffect(() => {
    if (hydrated && !isLoggedIn)
      window.localStorage.setItem(STORE.favs, JSON.stringify(favs));
  }, [favs, hydrated, isLoggedIn]);
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORE.tweaks, JSON.stringify(tweaks));
  }, [tweaks, hydrated]);
```

- [ ] **Step 5: Remove `setRole` from the context value**

Edit the `value` object (currently lines 127-143) to drop `setRole`. Keep `role` and `canBuy` (informational per spec §2.1). Quote actions stay as-is for now (rewired in Task 3):

```jsx
  const value = {
    hydrated,
    isLoggedIn,
    role,
    canBuy: role === 'buyer',
    quote,
    quoteCount,
    addToQuote,
    updateQuoteQty,
    removeFromQuote,
    clearQuote,
    favs,
    toggleFav,
    tweaks,
    setTweak,
  };
```

- [ ] **Step 6: Verify no remaining references to `setRole`**

Run: `grep -rn "setRole" app/`
Expected: no matches (RoleBanner's switcher was removed in Phase 1 per spec §5.4; if any match remains, it is a stale call and must be removed — the switcher is gone because role is read-only).

- [ ] **Step 7: Lint and typecheck the file**

Run: `npm run lint -- app/lib/AppContext.jsx && npm run codegen >/dev/null 2>&1; npx tsc --noEmit -p . 2>/dev/null | grep AppContext || echo "no AppContext type errors"`
Expected: lint passes; no AppContext type errors.

- [ ] **Step 8: Commit**

```bash
git add app/lib/AppContext.jsx
git commit -m "$(cat <<'EOF'
refactor(appcontext): seed state from loader props, make role read-only

AppProvider now accepts {role, quote, favs} initial props. role is
read-only (from the Turso user); setRole and the role localStorage
gating are removed. quote/favs hydrate from props when authenticated
and only mirror to localStorage for anonymous visitors. The Phase 3
favs server fetcher/migration are left untouched.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Convert quote actions to optimistic server fetchers

Rewire `addToQuote/updateQuoteQty/removeFromQuote/clearQuote` to POST to the Phase 4 routes and reconcile from the response via `mergeQuoteState`. Items are keyed by server `item.id`. `updateQuoteQty` and `removeFromQuote` now take an **`itemId`** (server id), not a `variantId`. Anonymous fallback (no session) keeps the old client-only behavior so the cotizacion gate still works.

**Files:**
- Modify: `app/lib/AppContext.jsx`

- [ ] **Step 1: Import the reducer, the count helper, and `useFetcher`**

At the top of `app/lib/AppContext.jsx`, add to the React Router import and a new import line:

```jsx
import {useFetcher} from 'react-router';
import {mergeQuoteState, quotePieceCount} from '~/lib/quote-state';
```

- [ ] **Step 2: Add a fetcher and a generic POST helper inside `AppProvider`**

Place this just after the `toasts` state declaration (after the line `const [toasts, setToasts] = useState([]);`):

```jsx
  const quoteFetcher = useFetcher();

  // POST to an /api/quote/* route as form-encoded fields and reconcile the
  // returned authoritative draft into client state. Server recomputes prices.
  const postQuote = useCallback(
    async (action, fields) => {
      const body = new URLSearchParams();
      Object.entries(fields).forEach(([k, v]) => body.set(k, v == null ? '' : String(v)));
      const res = await fetch(`/api/quote/${action}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body,
      });
      const data = await res.json().catch(() => null);
      if (!data || data.ok === false) {
        throw new Error((data && data.error) || 'No se pudo actualizar la cotización');
      }
      setQuote((prev) => mergeQuoteState(prev, data.quote));
      return data.quote;
    },
    [],
  );
```

> `quoteFetcher` is declared so the provider participates in React Router's pending-UI tracking and revalidation; `postQuote` uses raw `fetch` for an explicit JSON contract. Keeping both is intentional — the fetcher revalidates loaders (root `quote` prop) after navigation while `postQuote` gives immediate reconciled state.

- [ ] **Step 3: Rewrite `addToQuote` — anonymous fallback + server post**

Replace the existing `addToQuote` (currently lines 85-94). Authenticated path posts exactly `{variantId, technique, surface, size, qty}`; anonymous path keeps the old client-only merge so the UI works pre-login:

```jsx
  // ---- Quote list (server-backed when authenticated) ----
  const addToQuote = useCallback(
    (item) => {
      if (!isLoggedIn) {
        setQuote((q) => {
          const key = (i) => i.variantId === item.variantId;
          const found = q.find(key);
          if (found) return q.map((i) => (key(i) ? {...i, qty: i.qty + item.qty} : i));
          return [...q, {...item, addedAt: Date.now()}];
        });
        return Promise.resolve();
      }
      return postQuote('add', {
        variantId: item.variantId,
        technique: item.technique ?? 'Sin decorado',
        surface: item.surface ?? '',
        size: item.size ?? '',
        qty: item.qty,
      });
    },
    [isLoggedIn, postQuote],
  );
```

- [ ] **Step 4: Rewrite `updateQuoteQty` to key by `itemId`**

Replace `updateQuoteQty` (currently lines 95-99). The first arg is now the server `item.id`. Optimistically patch by id, then reconcile:

```jsx
  const updateQuoteQty = useCallback(
    (itemId, qty) => {
      const nextQty = Math.max(1, qty);
      if (!isLoggedIn) {
        setQuote((q) => q.map((i) => (i.id === itemId ? {...i, qty: nextQty} : i)));
        return Promise.resolve();
      }
      // optimistic: patch qty locally, server reconciles effectiveUnitPrice
      setQuote((q) => q.map((i) => (i.id === itemId ? {...i, qty: nextQty} : i)));
      return postQuote('update', {itemId, qty: nextQty});
    },
    [isLoggedIn, postQuote],
  );
```

- [ ] **Step 5: Rewrite `removeFromQuote` to key by `itemId`**

Replace `removeFromQuote` (currently lines 100-102):

```jsx
  const removeFromQuote = useCallback(
    (itemId) => {
      if (!isLoggedIn) {
        setQuote((q) => q.filter((i) => i.id !== itemId));
        return Promise.resolve();
      }
      setQuote((q) => q.filter((i) => i.id !== itemId)); // optimistic
      return postQuote('remove', {itemId});
    },
    [isLoggedIn, postQuote],
  );
```

- [ ] **Step 6: Rewrite `clearQuote` to remove each server item**

Replace `clearQuote` (currently line 103). There is no `/api/quote/clear` route in the Phase 4 contract, so clearing = removing each item via `remove` (the last response leaves an empty draft):

```jsx
  const clearQuote = useCallback(() => {
    if (!isLoggedIn) {
      setQuote([]);
      return Promise.resolve();
    }
    const ids = quote.map((i) => i.id);
    setQuote([]); // optimistic
    return Promise.all(ids.map((itemId) => postQuote('remove', {itemId}))).then(
      () => undefined,
    );
  }, [isLoggedIn, quote, postQuote]);
```

- [ ] **Step 7: Replace the `quoteCount` derivation with the pure helper**

Replace the existing `const quoteCount = quote.reduce(...)` line (currently line 125):

```jsx
  const quoteCount = quotePieceCount(quote);
```

- [ ] **Step 8: Verify no caller passes a `variantId` to update/remove**

Run: `grep -rn "updateQuoteQty(\|removeFromQuote(" app/`
Expected: callers in `cotizacion.jsx` only (fixed in Task 5). Note any other caller for follow-up — update/remove now require a server `item.id`.

- [ ] **Step 9: Lint the file**

Run: `npm run lint -- app/lib/AppContext.jsx`
Expected: PASS (no `react-hooks/exhaustive-deps` warnings; the deps arrays above are complete).

- [ ] **Step 10: Commit**

```bash
git add app/lib/AppContext.jsx
git commit -m "$(cat <<'EOF'
feat(appcontext): quote actions post to /api/quote/* with optimistic state

addToQuote posts {variantId, technique, surface, size, qty}; update and
remove key by server item.id; clearQuote removes each item. Every action
reconciles client state from the authoritative server draft via
mergeQuoteState. Anonymous visitors keep the client-only fallback.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Hydrate AppProvider props from the root loader

Make `root.jsx` provide `{role, quote, favs}` to `AppProvider`. `role` comes from the session snapshot (`getUser`), `quote` from `getQuoteWithItems`, and `favs` from the wishlist loader (Phase 3). All are server-only reads gated on a logged-in session; anonymous visitors get defaults.

**Files:**
- Modify: `app/root.jsx` (loader around lines 66-113; `AppProvider` render around line 185)

- [ ] **Step 1: Import the server helpers in `root.jsx`**

Add near the other server imports at the top of `app/root.jsx`:

```jsx
import {getUser} from '~/lib/auth/session';
import {getDb} from '~/lib/db/client';
import {getQuoteWithItems} from '~/lib/quotes/repo';
import {listWishlist} from '~/lib/wishlist/repo'; // Phase 3 repo: listWishlist(db, userId) -> string[]
```

> If Phase 3 exposed wishlist reads through `api.wishlist.jsx`'s loader instead of a `listWishlist` repo, call that repo helper here instead — match the actual Phase 3 export. The contract this task depends on is: "given a `userId`, return the array of favorited `product_id` strings."

- [ ] **Step 2: Replace the loader body to derive role/quote/favs**

In the `loader(args)` function, replace the `Promise.all([...])` block and the `return {header, isLoggedIn}` (currently around lines 102-113) with session-derived state:

```jsx
  const {storefront, customerAccount, env} = args.context;

  const [header] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {headerMenuHandle: 'main-menu'},
    }),
  ]);

  // Session snapshot (no Turso round-trip): {userId, role, gid, sessionVersion} | null
  const sessionUser = getUser(args.context.session);
  const isLoggedIn = Boolean(sessionUser);

  let role = 'quoter';
  let quote = [];
  let favs = [];
  if (sessionUser) {
    role = sessionUser.role || 'quoter';
    const db = getDb(args.context);
    const [draft, favIds] = await Promise.all([
      getQuoteWithItems(db, sessionUser.userId),
      listWishlist(db, sessionUser.userId),
    ]);
    quote = draft?.items ?? [];
    favs = favIds ?? [];
  }

  return {header, isLoggedIn, role, quote, favs};
```

> `customerAccount.isLoggedIn()` is removed as the auth source per spec §5.4 — `isLoggedIn` now derives from the session snapshot. Keep `customerAccount` destructured only if other root code still uses it for the Storefront context; otherwise drop it.

- [ ] **Step 3: Pass the new props to `AppProvider`**

Replace the `AppProvider` element (currently around line 185):

```jsx
      <AppProvider
        isLoggedIn={data.isLoggedIn}
        role={data.role}
        quote={data.quote}
        favs={data.favs}
      >
        {/* existing children unchanged */}
      </AppProvider>
```

- [ ] **Step 4: Typecheck / build the worker bundle**

Run: `npm run build 2>&1 | tail -20`
Expected: build succeeds. If it fails on a missing export from `~/lib/wishlist/repo` or `~/lib/quotes/repo`, the import name does not match the Phase 3/4 export — fix the import to the real symbol (do not add a new repo).

- [ ] **Step 5: MANUAL verification — logged-in hydration**

This is workerd-only route wiring; verify in the real app, not a fake render test.

```
1. npm run dev
2. Log in as a seeded user (email+password) at /login.
3. Open the React DevTools (or add a temporary `console.log` in AppProvider) and confirm:
   - role === the user's Turso role (e.g. 'quoter'), NOT 'buyer'.
   - quote is seeded from the server draft on first paint (no flash of empty then full).
   - favs reflect the server wishlist on first paint.
4. Log out, reload: role falls back to 'quoter', quote/favs come from localStorage (anonymous).
```
Expected: all four confirmations hold. Record the observed `role`/`quote.length`/`favs.length` in the task notes.

- [ ] **Step 6: Commit**

```bash
git add app/root.jsx
git commit -m "$(cat <<'EOF'
feat(root): hydrate AppProvider with server role/quote/favs

The root loader derives isLoggedIn + role from the session snapshot and
reads the user's draft quote (getQuoteWithItems) and wishlist, passing
{role, quote, favs} into AppProvider. customerAccount is no longer the
auth source.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire cotizacion.jsx to the server draft (keyed by item.id)

Hydrate line items from the server-backed `quote` (already in context from Task 4). Change +/- and remove to call `updateQuoteQty(item.id, qty)` / `removeFromQuote(item.id)`. Per spec §10/§7.3, increment/decrement by **1**, minimum **1** (no `±25`). Use `effectiveUnitPrice` (server price) for line totals, not the legacy `price`.

**Files:**
- Modify: `app/routes/cotizacion.jsx`

- [ ] **Step 1: Use `effectiveUnitPrice` for subtotal**

Replace the subtotal/total derivations (currently lines 44-46):

```jsx
  const subtotal = quote.reduce((s, i) => s + (i.effectiveUnitPrice || 0) * i.qty, 0);
  const estTotal = subtotal * 1.16;
  const totalPieces = quote.reduce((n, i) => n + i.qty, 0);
```

- [ ] **Step 2: Key the list rows by `item.id` and read decoration meta**

Replace the line-item `.map` opening + key (currently lines 133-148) so the row is keyed by the server id and shows the decoration technique/size instead of `options`-only:

```jsx
          {quote.map((item) => (
            <div key={item.id} className="cart-item">
              <PH src={item.image} alt={item.title} />
              <div className="cart-item-info">
                <div className="cart-item-meta">{item.sku}</div>
                <div className="cart-item-name">{item.title}</div>
                <div style={{display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap'}}>
                  {item.technique && item.technique !== 'Sin decorado' && (
                    <span className="tag">
                      {item.technique}
                      {item.size ? ` · ${item.size}` : ''}
                    </span>
                  )}
                  {item.options?.map((o) => (
                    <span key={o.name} className="tag">
                      {o.name}: {o.value}
                    </span>
                  ))}
                </div>
              </div>
```

- [ ] **Step 3: Change the qty controls to ±1 keyed by `item.id`**

Replace the `.pdp-qty` block (currently lines 150-163):

```jsx
                <div className="pdp-qty" style={{borderRadius: 999}}>
                  <button
                    onClick={() => updateQuoteQty(item.id, Math.max(1, item.qty - 1))}
                    aria-label="Disminuir cantidad"
                  >
                    <Icon name="minus" size={12} />
                  </button>
                  <input
                    value={item.qty}
                    onChange={(e) =>
                      updateQuoteQty(item.id, Math.max(1, +e.target.value || 1))
                    }
                  />
                  <button
                    onClick={() => updateQuoteQty(item.id, item.qty + 1)}
                    aria-label="Aumentar cantidad"
                  >
                    <Icon name="plus" size={12} />
                  </button>
                </div>
```

- [ ] **Step 4: Use `effectiveUnitPrice` for the line estimate and `item.id` for remove**

Replace the estimate line and the remove button (currently lines 164-192):

```jsx
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Estimado · {formatPrice((item.effectiveUnitPrice || 0) * item.qty)}
                </div>
                <button
                  onClick={() => {
                    removeFromQuote(item.id);
                    toast('Producto removido');
                  }}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Icon name="trash" size={12} /> Quitar
                </button>
```

- [ ] **Step 5: Lint the file**

Run: `npm run lint -- app/routes/cotizacion.jsx`
Expected: PASS.

- [ ] **Step 6: MANUAL verification — line edits hit the server**

Workerd-only route wiring; verify in the real app.

```
1. npm run dev; log in; add a product to the quote from a PDP.
2. Go to /cotizacion. Open the Network tab.
3. Click + on a line: confirm a POST /api/quote/update fires with form fields
   itemId=<server id> and qty=<n+1> (NOT a variantId), and the displayed
   effectiveUnitPrice updates from the response.
4. Click - to qty 1, then - again: stays at 1 (no 0/negative POST).
5. Click Quitar: POST /api/quote/remove with itemId=<server id>; row disappears.
6. Reload the page: the server draft is re-hydrated and matches what you left.
```
Expected: all POSTs carry `itemId` (never `variantId`); prices come from responses; reload is consistent.

- [ ] **Step 7: Commit**

```bash
git add app/routes/cotizacion.jsx
git commit -m "$(cat <<'EOF'
feat(cotizacion): hydrate from server draft, edit lines by item.id

Line items render from the server-backed quote keyed by item.id. +/- and
remove call updateQuoteQty/removeFromQuote with the server itemId. Steps
are ±1 with a minimum of 1 (no MOQ), and line totals use the server
effectiveUnitPrice.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire the PDP add-to-quote to DecorationSelector + /api/quote/add

Render the Phase 5 `DecorationSelector` on the PDP, capture its `decoDetail = {technique, surface, size, qty}`, and make the add-to-quote button post exactly `{variantId, technique, surface, size, qty}` so the server recomputes prices (spec §7.2). Reconcile AppContext quote from the response (handled by `addToQuote` from Task 3). Per spec §10, qty starts at **1** with ±1 steps (MOQ-driven `setQty(moq)` and tier buttons are removed in Phase 6 — this task assumes that and only wires the deco/quote path; if Phase 6 has not yet removed them, the `decoDetail.qty` still flows from whatever `qty` is).

**Files:**
- Modify: `app/routes/products.$handle.jsx` (state around lines 69-74; `handleQuote` around lines 83-97; render the selector near the qty/price block)

- [ ] **Step 1: Import `DecorationSelector` and add `decoDetail` state**

Add the import near the other `~/components/gi` imports at the top:

```jsx
import {DecorationSelector} from '~/components/gi/DecorationSelector';
```

Add state alongside the existing `useState` declarations (near line 69-74):

```jsx
  // decoDetail = {technique, surface, size, qty} — inputs only, server prices it
  const [decoDetail, setDecoDetail] = useState({
    technique: 'Sin decorado',
    surface: '',
    size: '',
    qty,
  });
  const [decoError, setDecoError] = useState(null);
```

> `decoError` lets us disable the add button when the selector reports an invalid technique/surface/size combination (spec §9.2: "si calcDecoration devuelve error … se deshabilita agregar").

- [ ] **Step 2: Rewrite `handleQuote` to post the frozen payload**

Replace `handleQuote` (currently lines 84-97). It now sends exactly the five fields the server expects; `addToQuote` (Task 3) posts and reconciles:

```jsx
  const {addToQuote} = useApp();
  const handleQuote = async () => {
    try {
      await addToQuote({
        variantId: selectedVariant.id,
        // metadata used only by the anonymous client-side fallback render:
        productId: product.id,
        handle: product.handle,
        title: product.title,
        sku: selectedVariant.sku,
        image: mainImage,
        options: selectedVariant.selectedOptions,
        // the five fields the server reads (spec §7.2):
        technique: decoDetail.technique,
        surface: decoDetail.surface,
        size: decoDetail.size,
        qty: decoDetail.qty,
      });
      toast(`${product.title} en tu lista de cotización`, {icon: 'quote', accent: true});
    } catch (err) {
      toast(err.message || 'No se pudo agregar a la cotización');
    }
  };
```

> Per spec §7.2 the server reads only `{variantId, technique, surface, size, qty}`; the extra metadata fields are ignored server-side and exist solely for the anonymous client-only fallback list (Task 3). Keeping them is harmless and keeps the anonymous UX intact.

- [ ] **Step 3: Render `DecorationSelector` and keep `decoDetail.qty` in sync**

Place the selector inside the buy box, immediately before the qty stepper / add-to-quote button (near the existing `.pdp-qty` block around line 283). It only renders when the product exposes techniques (graceful degradation, spec §9.2 — `DecorationSelector` handles that internally):

```jsx
              <DecorationSelector
                product={product}
                basePrice={unit}
                qty={qty}
                onChange={(detail) => {
                  setDecoDetail(detail);
                  setDecoError(detail.error ?? null);
                }}
              />
```

> `DecorationSelector` already emits `detail = {technique, surface, size, qty}` (Phase 5). If its contract also surfaces a derived `error` flag, we capture it; if not, `detail.error` is `undefined` and `decoError` stays `null` (button never wrongly disabled). The `qty` prop keeps the selector's amortized "cargo fijo" message in sync with the stepper.

- [ ] **Step 4: Disable the add-to-quote button on decoration error**

Find the add-to-quote `Button` that calls `onClick={handleQuote}` (in the logged-in branch around lines 365-381) and add the disabled gate:

```jsx
              <Button
                variant="accent"
                size="lg"
                iconRight="arrow_right"
                disabled={Boolean(decoError) || !selectedVariant?.id}
                onClick={handleQuote}
              >
                Agregar a cotización
              </Button>
```

> Keep whatever label/props the existing button already uses; the load-bearing change is `disabled={Boolean(decoError) || !selectedVariant?.id}` and `onClick={handleQuote}`. Do not alter the anonymous (`!isLoggedIn`) branch's CTA.

- [ ] **Step 5: Lint the file**

Run: `npm run lint -- app/routes/products.$handle.jsx`
Expected: PASS.

- [ ] **Step 6: MANUAL verification — PDP posts the frozen payload and reconciles**

Workerd-only route/component wiring; verify in the real app with the Network tab.

```
1. npm run dev; log in; open a PDP for a product WITH techniques metafield.
2. Pick a technique + size in DecorationSelector; set qty (e.g. 300).
3. Click "Agregar a cotización". In the Network tab confirm the POST /api/quote/add
   request body has EXACTLY: variantId, technique, surface, size, qty
   (the server ignores any extra fields; verify these five are present).
4. Confirm the response is {ok:true, quote:{items:[...]}} and the header quote
   count updates to the server's pieces (quotePieceCount).
5. Open a product WITHOUT the techniques metafield: the selector does not render,
   and add-to-quote still works with technique 'Sin decorado'.
6. Force an invalid combo (if the selector allows): the add button is disabled and
   nothing is posted (spec §9.2).
7. Go to /cotizacion: the item shows the server-computed effectiveUnitPrice.
```
Expected: the POST carries the five fields; price comes only from the server response; degradation and error-disable both hold.

- [ ] **Step 7: Commit**

```bash
git add app/routes/products.$handle.jsx
git commit -m "$(cat <<'EOF'
feat(pdp): wire DecorationSelector add-to-quote to /api/quote/add

The PDP renders DecorationSelector and posts exactly
{variantId, technique, surface, size, qty} so the server recomputes
prices; AppContext reconciles the quote from the response. The add
button is disabled on a decoration error.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Full-flow manual verification

End-to-end check that the integrated subsystems work together in the real worker. No fake render tests — this is the integration gate for the phase.

**Files:** none (verification only).

- [ ] **Step 1: Re-run the pure unit tests**

Run: `npx vitest run app/lib/quote-state.test.js`
Expected: PASS — 8 tests.

- [ ] **Step 2: Build the worker bundle**

Run: `npm run build 2>&1 | tail -20`
Expected: build succeeds with no unresolved imports.

- [ ] **Step 3: MANUAL — full quote lifecycle**

```
1. npm run dev.
2. Anonymous: add a product to the quote → it lives in localStorage; the
   /cotizacion gate shows "Inicia sesión para cotizar".
3. Log in. Confirm role is read-only (no role switcher anywhere; spec §5.4).
4. Add a decorated product from a PDP (qty 300, a real technique/size):
   POST /api/quote/add with the five fields; header count = server pieces.
5. /cotizacion: line shows server effectiveUnitPrice; +/- posts /api/quote/update
   with itemId; Quitar posts /api/quote/remove with itemId; min qty 1, step 1.
6. Reload /cotizacion: state re-hydrates from getQuoteWithItems and matches.
7. Vaciar lista: each item is removed via /api/quote/remove; draft ends empty.
8. Confirm no /api/quote/* request body ever contains a price field.
```
Expected: every step holds; the client never sends prices and never sends a `variantId` to update/remove.

- [ ] **Step 4: MANUAL — confirm role is not client-mutable**

```
1. While logged in, in the browser console attempt: window.localStorage.setItem('gi_role', '"buyer"'); location.reload();
2. Confirm role is STILL the Turso role after reload (localStorage role gating was removed).
```
Expected: role is unaffected by `gi_role` localStorage; it comes only from the loader.

- [ ] **Step 5: Final commit (if any verification fix was needed)**

If steps 1-4 surfaced a wiring bug, fix it in the relevant task's file and commit:

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(quote-ui): correct integration wiring found in full-flow verification

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

If no fix was needed, record the verification results in the task notes and proceed — no empty commit.

---

## Self-review notes

- **Spec §5.4 (AppContext from props, role read-only):** Tasks 2 + 4. `setRole` and role localStorage gating removed; role from Turso user via loader.
- **Spec §5.4 (favs not duplicated):** Task 2 Step 1/3/4 only change favs *initialization* from props; the Phase 3 server fetcher + one-shot migration are explicitly left untouched.
- **Spec §7.2 (client sends only {variantId, technique, surface, size, qty}; server recomputes):** Task 6 Step 2; Task 3 Step 3.
- **Spec §7.2 / §7.1 (items keyed by server item.id):** Tasks 3, 5; reducer keyed by `id` in Task 1.
- **Spec §7.3 (cotizacion hydrates from server draft, ±1, min 1, edit by itemId):** Task 5.
- **Spec §7.3 / §214 (AppContext quote actions = optimistic fetchers, initial from loader):** Tasks 3 + 4.
- **Frozen contracts (getOrCreateDraftQuote/getQuoteWithItems/upsertQuoteItem/removeQuoteItem, requireUser, getDb):** consumed in Task 4 loader and the Phase 4 `/api/quote/*` routes; not redefined here.
- **Testing strategy (spec §15):** only the pure reducer gets a real vitest test (Task 1); all workerd-only route/component wiring uses MANUAL verification (Tasks 4, 5, 6, 7) — no fake render tests.
- **Note for executor:** if Phase 6 (MOQ removal) has not landed when this phase runs, the PDP's `useState(moq)` and tier buttons may still exist; Task 6 only wires the deco/quote path and does not depend on their removal — `decoDetail.qty` flows from the current `qty` regardless.
