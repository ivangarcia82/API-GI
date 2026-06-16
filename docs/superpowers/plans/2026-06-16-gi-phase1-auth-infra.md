# Phase 1: Infra de datos + Autenticación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Turso/libSQL data layer and a self-hosted email+password authentication system (PBKDF2+pepper, signed-session snapshots, CSRF default-deny, login throttling) that replaces Shopify OAuth as the source of auth, on Shopify Hydrogen over Oxygen (workerd).

**Architecture:** A per-request libSQL HTTP client (`@libsql/client/web`) backs all server-only modules under `app/lib/{db,auth,http}`. Passwords are HMAC-peppered then PBKDF2-SHA256 hashed (100k iterations, the workerd cap) with constant-time verification. The signed AppSession cookie stores a minimal user snapshot to avoid a Turso round-trip per protected navigation; sessions rotate on login/signup and can be revoked via `session_version`. Every state-changing action calls `assertSameOrigin(request)` first. The Shopify Admin link (`createCustomer`) is consumed here but its implementation is stubbed in Phase 2.

**Tech Stack:** JS + JSX (no TypeScript), React Router 7 file-based routes, Hydrogen 2026.4.2 on Oxygen/workerd, libSQL/Turso over HTTPS, WebCrypto (PBKDF2 + HMAC-SHA256), Vitest (Node 20+ `globalThis.crypto.subtle`) for pure-function unit tests, ESLint flat config.

**Branch:** `feat/auth-decoration-quotes` (already exists). All commit message bodies end with the trailer:
```
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

**Frozen-interface note:** This plan also CONSUMES `createCustomer(env, {email, firstName, lastName}) -> { gid }` from `app/lib/admin/operations.js` (Phase 2). In Phase 1 we create that file as a real-signature STUB so signup compiles and runs end-to-end. Phase 2 replaces its body with the real/stub-mode Admin client; the signature is frozen and does not change.

---

## File Structure (decomposition)

**Create (this phase):**
- `vitest.config.js` — Vitest config (Node environment, pure-module tests).
- `app/lib/db/client.js` — `getDb(env)` per-request libSQL/web client.
- `app/lib/db/migrate.js` — `migrate(db)` idempotent DDL for ALL spec tables (so later phases just use them).
- `app/lib/auth/password.js` — `hashPassword` / `verifyPassword` (pure-ish; WebCrypto only).
- `app/lib/auth/users.js` — user repo + `EmailTakenError` + email normalization.
- `app/lib/auth/session.js` — `loginSession` / `getSessionUser` snapshot helpers.
- `app/lib/auth/guard.js` — `requireUser(context)`.
- `app/lib/http/csrf.js` — `assertSameOrigin(request)`.
- `app/lib/admin/operations.js` — `createCustomer` STUB (real signature; Phase 2 fills body).
- `app/routes/auth.signup.jsx`, `app/routes/auth.login.jsx`, `app/routes/auth.logout.jsx`.
- `app/routes/admin.reset-password.jsx` — interim server-only admin password-recovery action (guarded by `env.ADMIN_RESET_SECRET`).
- `app/lib/auth/password.test.js` — pure unit tests (round-trip / reject / upgrade / constant-time length).

> **Env vars (workerd `context.env`):** `SESSION_SECRET`, `AUTH_PEPPER`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `ADMIN_RESET_SECRET` (new — the interim admin reset shared secret; compared in constant time, never logged).

**Modify:**
- `package.json` — add `vitest` devDependency + `test` script; pin `@libsql/client`.
- `eslint.config.js` — `no-restricted-imports` (ban bare `@libsql/client`) + ban `Math.random` in `app/lib`.
- `app/lib/session.js` — add `secure: true` cookie (gated for dev).
- `app/routes/login.jsx` — rewrite to email+password form → `/auth/login`.
- `app/routes/registro.jsx` — add password field; submit → `/auth/signup`.
- `app/routes/account.$.jsx` — replace `handleAuthStatus()` with `requireUser(context)`.
- `app/routes/account.jsx` — loader reads the Turso user (drop `customerAccount.query(CUSTOMER_DETAILS_QUERY)`); nav drops the addresses/orders links (deferred per §5.4).
- `app/routes/account._index.jsx` — render the overview from the Turso user snapshot (drop the Shopify `customer`).
- `app/routes/account.profile.jsx` — loader uses `requireUser`; action calls `updateProfile(db, userId, {...})` (drop `customerAccount.mutate`/`handleAuthStatus`).
- `app/root.jsx` — `isLoggedIn` from session snapshot; inject `role`.
- `app/components/gi/RoleBanner.jsx` — remove role switcher (both banner + TweaksPanel).

**Delete:**
- `app/routes/account_.login.jsx`, `app/routes/account_.authorize.jsx`, `app/routes/account_.logout.jsx`.

---

## Task 0: Test runner + ESLint guardrails

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Create: `vitest.config.js`
- Modify: `eslint.config.js`

- [ ] **Step 1: Add vitest devDependency and pin libSQL**

Run:
```bash
npm install --save-dev vitest@^3.2.4
npm install @libsql/client@^0.15.0
```
Then add a `test` script. Edit `package.json` `scripts` so it reads exactly:
```json
  "scripts": {
    "build": "shopify hydrogen build --codegen",
    "dev": "shopify hydrogen dev --codegen",
    "preview": "shopify hydrogen preview --build",
    "lint": "eslint --no-error-on-unmatched-pattern .",
    "codegen": "shopify hydrogen codegen && react-router typegen",
    "test": "vitest run"
  },
```
Expected: `package.json` now lists `"@libsql/client"` under `dependencies` and `"vitest"` under `devDependencies`.

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.js`:
```js
import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // Pure-function modules (password, decoration engine) run under Node.
    // Node 20+ exposes globalThis.crypto.subtle, so PBKDF2/HMAC work here.
    environment: 'node',
    include: ['app/**/*.test.{js,jsx}'],
    globals: false,
  },
});
```

- [ ] **Step 3: Add ESLint guardrails**

In `eslint.config.js`, add a new flat-config block at the END of the exported array (after the existing `'**/*.server.*'` block). Append, before the closing `];`:
```js
  {
    // Ban the bare libSQL import everywhere: only '@libsql/client/web'
    // resolves the workerd condition. The bare entry breaks the Oxygen bundle.
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@libsql/client',
              message: "Use '@libsql/client/web' (workerd-safe) instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // Security values must use crypto.getRandomValues / crypto.randomUUID.
    // Math.random is forbidden in server-only helper modules.
    files: ['app/lib/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random is banned in app/lib; use crypto.getRandomValues / crypto.randomUUID.',
        },
      ],
    },
  },
```

- [ ] **Step 4: Verify lint guardrails and test runner wiring**

Run: `npm run lint`
Expected: PASS (no existing file imports bare `@libsql/client` or uses `Math.random` in `app/lib` yet).

Run: `npx vitest run`
Expected: "No test files found" (no `*.test.js` exist yet) — exits cleanly; this confirms vitest is installed and configured.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.js eslint.config.js
git commit -m "chore(auth): add vitest and ESLint guardrails for libSQL/Math.random

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 1: Password hashing (PBKDF2 + pepper, constant-time)

**Files:**
- Create: `app/lib/auth/password.js`
- Test: `app/lib/auth/password.test.js`

- [ ] **Step 1: Write the failing test**

Create `app/lib/auth/password.test.js`:
```js
import {describe, it, expect} from 'vitest';
import {hashPassword, verifyPassword} from './password.js';

const env = {AUTH_PEPPER: 'unit-test-pepper-value'};

describe('password', () => {
  it('round-trips: a hashed password verifies true', async () => {
    const rec = await hashPassword('Sup3r-Secret!', env);
    expect(rec.iterations).toBe(100000);
    expect(typeof rec.hash).toBe('string');
    expect(typeof rec.salt).toBe('string');
    // base64 of 32 bytes -> 44 chars; base64 of 16 bytes -> 24 chars
    expect(rec.hash.length).toBe(44);
    expect(rec.salt.length).toBe(24);
    const ok = await verifyPassword('Sup3r-Secret!', rec, env);
    expect(ok).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const rec = await hashPassword('Sup3r-Secret!', env);
    const ok = await verifyPassword('wrong-password', rec, env);
    expect(ok).toBe(false);
  });

  it('rejects when the pepper differs (HMAC pepper is applied)', async () => {
    const rec = await hashPassword('Sup3r-Secret!', env);
    const ok = await verifyPassword('Sup3r-Secret!', rec, {AUTH_PEPPER: 'other'});
    expect(ok).toBe(false);
  });

  it('verifies using the stored iteration count, not the default (upgrade path)', async () => {
    const rec = await hashPassword('Sup3r-Secret!', env);
    // Simulate a legacy record stored with fewer iterations.
    const legacy = await hashPasswordWithIterations('Sup3r-Secret!', env, 50000);
    expect(legacy.iterations).toBe(50000);
    const ok = await verifyPassword('Sup3r-Secret!', legacy, env);
    expect(ok).toBe(true);
    // And the modern record still verifies.
    expect(await verifyPassword('Sup3r-Secret!', rec, env)).toBe(true);
  });

  it('returns false (never throws) on malformed records', async () => {
    expect(await verifyPassword('x', null, env)).toBe(false);
    expect(await verifyPassword('x', {}, env)).toBe(false);
    expect(await verifyPassword('x', {hash: '', salt: '', iterations: 0}, env)).toBe(false);
    expect(await verifyPassword('x', {hash: '!!!', salt: '!!!', iterations: 100000}, env)).toBe(false);
  });
});

// Test-only helper exported by password.js to exercise the upgrade path.
import {hashPasswordWithIterations} from './password.js';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/auth/password.test.js`
Expected: FAIL — `Failed to resolve import "./password.js"` / "hashPassword is not a function".

- [ ] **Step 3: Write minimal implementation**

Create `app/lib/auth/password.js`:
```js
// Server-only. Password hashing with WebCrypto: HMAC-SHA256 pepper -> PBKDF2-SHA256.
// 100000 iterations is the hard cap in workerd (>100k throws NotSupportedError).
// Never import from client components.

const DEFAULT_ITERATIONS = 100000;
const SALT_BYTES = 16;
const DERIVED_BITS = 256; // 32 bytes

function toBase64(bytes) {
  let binary = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// HMAC-SHA256(password, pepper) -> Uint8Array(32). Pepper is the HMAC key.
async function pepper(plain, env) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(env.AUTH_PEPPER ?? '')),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(plain)));
  return new Uint8Array(sig);
}

async function deriveBits(pepperedBytes, salt, iterations) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    pepperedBytes,
    {name: 'PBKDF2'},
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {name: 'PBKDF2', hash: 'SHA-256', salt, iterations},
    baseKey,
    DERIVED_BITS,
  );
  return new Uint8Array(bits);
}

// Internal: hash with an explicit iteration count (used by hashPassword and tests).
export async function hashPasswordWithIterations(plain, env, iterations) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const peppered = await pepper(plain, env);
  const derived = await deriveBits(peppered, salt, iterations);
  return {hash: toBase64(derived), salt: toBase64(salt), iterations};
}

export async function hashPassword(plain, env) {
  return hashPasswordWithIterations(plain, env, DEFAULT_ITERATIONS);
}

// Constant-time compare: fixed-length XOR accumulator; the length mismatch
// itself feeds the accumulator (no early return), so timing does not leak.
function constantTimeEqual(a, b) {
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export async function verifyPassword(plain, rec, env) {
  try {
    if (!rec || typeof rec.hash !== 'string' || typeof rec.salt !== 'string') {
      return false;
    }
    const iterations = Number(rec.iterations);
    if (!Number.isInteger(iterations) || iterations <= 0) return false;
    if (rec.hash.length === 0 || rec.salt.length === 0) return false;
    const expected = fromBase64(rec.hash);
    const salt = fromBase64(rec.salt);
    const peppered = await pepper(plain, env);
    const derived = await deriveBits(peppered, salt, iterations);
    return constantTimeEqual(derived, expected);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/auth/password.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/auth/password.js app/lib/auth/password.test.js
git commit -m "feat(auth): PBKDF2+pepper password hashing with constant-time verify

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: libSQL client + migrations (all tables)

**Files:**
- Create: `app/lib/db/client.js`
- Create: `app/lib/db/migrate.js`

> **Why no unit test here:** `getDb` builds a workerd-only HTTP client and `migrate` issues network DDL against Turso. Both are impractical to unit-test under Node. We use a MANUAL verification step against a real/dev Turso URL instead of a fake test.

- [ ] **Step 1: Write the client**

Create `app/lib/db/client.js`:
```js
// Server-only. Per-request libSQL/web HTTP client.
// MUST import from '@libsql/client/web' (bare '@libsql/client' breaks the workerd bundle).
// Never create at module scope: workerd I/O objects do not cross requests.
import {createClient} from '@libsql/client/web';

export function getDb(env) {
  const url = env.TURSO_DATABASE_URL;
  if (!url || !/^https:\/\//.test(url)) {
    throw new Error('TURSO_DATABASE_URL must be set and use https:// (Hrana-over-HTTP).');
  }
  return createClient({
    url,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}
```

- [ ] **Step 2: Write the migration (ALL spec tables, idempotent)**

Create `app/lib/db/migrate.js`:
```js
// Server-only. Idempotent CREATE TABLE/INDEX IF NOT EXISTS for every table in
// the spec, so later phases (wishlist, quotes) can use them without new migrations.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id                   TEXT PRIMARY KEY,
    email                TEXT NOT NULL,
    password_hash        TEXT NOT NULL,
    password_salt        TEXT NOT NULL,
    password_iterations  INTEGER NOT NULL,
    session_version      INTEGER NOT NULL DEFAULT 1,
    first_name           TEXT,
    last_name            TEXT,
    company              TEXT,
    rfc                  TEXT,
    role                 TEXT NOT NULL DEFAULT 'quoter',
    shopify_customer_gid TEXT,
    email_verified_at    TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`,

  `CREATE TABLE IF NOT EXISTS login_attempts (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    ip          TEXT NOT NULL,
    success     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip, created_at)`,

  `CREATE TABLE IF NOT EXISTS quotes (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users(id),
    status                  TEXT NOT NULL DEFAULT 'draft',
    notes                   TEXT,
    deadline                TEXT,
    shopify_draft_order_gid TEXT,
    shopify_invoice_url     TEXT,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_one_draft_per_user ON quotes(user_id) WHERE status='draft'`,
  `CREATE TABLE IF NOT EXISTS quote_items (
    id                   TEXT PRIMARY KEY,
    quote_id             TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    variant_id           TEXT NOT NULL,
    product_handle       TEXT,
    title                TEXT,
    qty                  INTEGER NOT NULL CHECK (qty >= 1),
    base_unit_price      REAL NOT NULL,
    technique            TEXT,
    surface              TEXT,
    size                 TEXT,
    decoration_total     REAL NOT NULL DEFAULT 0,
    effective_unit_price REAL NOT NULL,
    created_at           TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id)`,

  `CREATE TABLE IF NOT EXISTS wishlist (
    user_id    TEXT NOT NULL REFERENCES users(id),
    product_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, product_id)
  )`,
];

export async function migrate(db) {
  for (const sql of STATEMENTS) {
    await db.execute(sql);
  }
}
```

- [ ] **Step 3: MANUAL verification (real Turso, dev)**

Create a throwaway script `scripts/migrate-once.mjs` locally (do NOT commit):
```js
import {getDb} from '../app/lib/db/client.js';
import {migrate} from '../app/lib/db/migrate.js';

const env = {
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
};
const db = getDb(env);
await migrate(db);
const res = await db.execute(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
);
console.log(res.rows.map((r) => r.name));
```
Run:
```bash
TURSO_DATABASE_URL="https://<your-db>.turso.io" TURSO_AUTH_TOKEN="<token>" node scripts/migrate-once.mjs
```
Expected output (table list): `[ 'login_attempts', 'quote_items', 'quotes', 'users', 'wishlist' ]`.
Run the script a SECOND time — expected: identical output, no errors (proves idempotency). Then delete the script: `rm scripts/migrate-once.mjs`.

- [ ] **Step 4: Verify lint accepts the import form**

Run: `npm run lint`
Expected: PASS (uses `@libsql/client/web`; the banned bare form is absent).

- [ ] **Step 5: Commit**

```bash
git add app/lib/db/client.js app/lib/db/migrate.js
git commit -m "feat(db): per-request libSQL/web client and idempotent migrations

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: User repository + EmailTakenError

**Files:**
- Create: `app/lib/auth/users.js`

> **Why no unit test here:** every function issues libSQL queries (network I/O), impractical under Node. The email-normalization and UNIQUE-violation behavior are verified manually in Step 2 and again end-to-end by the signup route (Task 8).

- [ ] **Step 1: Write the implementation**

Create `app/lib/auth/users.js`:
```js
// Server-only. User repository over libSQL. User shape:
// {id,email,firstName,lastName,company,rfc,role,shopifyCustomerGid,
//  sessionVersion,emailVerifiedAt,createdAt,updatedAt}
import {hashPassword} from './password.js';

export class EmailTakenError extends Error {
  constructor(message = 'Email already registered') {
    super(message);
    this.name = 'EmailTakenError';
  }
}

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase().normalize('NFKC');
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    company: row.company ?? null,
    rfc: row.rfc ?? null,
    role: row.role,
    shopifyCustomerGid: row.shopify_customer_gid ?? null,
    sessionVersion: Number(row.session_version),
    emailVerifiedAt: row.email_verified_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS = `id, email, first_name, last_name, company, rfc, role,
  shopify_customer_gid, session_version, email_verified_at, created_at, updated_at`;

// Detects the libSQL UNIQUE-constraint violation surfaced by Turso.
function isUniqueViolation(err) {
  const msg = String(err?.message ?? '').toUpperCase();
  return msg.includes('UNIQUE') || msg.includes('CONSTRAINT');
}

export async function createUser(db, env, {email, password, firstName, lastName, company, rfc, role}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(email);
  const rec = await hashPassword(password, env);
  try {
    await db.execute({
      sql: `INSERT INTO users
        (id, email, password_hash, password_salt, password_iterations,
         session_version, first_name, last_name, company, rfc, role,
         shopify_customer_gid, email_verified_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      args: [
        id,
        normalizedEmail,
        rec.hash,
        rec.salt,
        rec.iterations,
        firstName ?? null,
        lastName ?? null,
        company ?? null,
        rfc ?? null,
        role ?? 'quoter',
        now,
        now,
      ],
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new EmailTakenError();
    throw err;
  }
  return {
    id,
    email: normalizedEmail,
    firstName: firstName ?? null,
    lastName: lastName ?? null,
    company: company ?? null,
    rfc: rfc ?? null,
    role: role ?? 'quoter',
    shopifyCustomerGid: null,
    sessionVersion: 1,
    emailVerifiedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function findByEmail(db, email) {
  const res = await db.execute({
    sql: `SELECT ${SELECT_COLS} FROM users WHERE email = ?`,
    args: [normalizeEmail(email)],
  });
  return rowToUser(res.rows[0]);
}

export async function findById(db, id) {
  const res = await db.execute({
    sql: `SELECT ${SELECT_COLS} FROM users WHERE id = ?`,
    args: [id],
  });
  return rowToUser(res.rows[0]);
}

export async function updateProfile(db, id, {firstName, lastName, company, rfc}) {
  await db.execute({
    sql: `UPDATE users SET first_name = ?, last_name = ?, company = ?, rfc = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      firstName ?? null,
      lastName ?? null,
      company ?? null,
      rfc ?? null,
      new Date().toISOString(),
      id,
    ],
  });
}

export async function setShopifyGid(db, id, gid) {
  await db.execute({
    sql: `UPDATE users SET shopify_customer_gid = ?, updated_at = ? WHERE id = ?`,
    args: [gid, new Date().toISOString(), id],
  });
}

export async function bumpSessionVersion(db, id) {
  await db.execute({
    sql: `UPDATE users SET session_version = session_version + 1, updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), id],
  });
  const res = await db.execute({
    sql: `SELECT session_version FROM users WHERE id = ?`,
    args: [id],
  });
  return Number(res.rows[0]?.session_version);
}
```

- [ ] **Step 2: MANUAL verification (normalization + UNIQUE)**

This is verified end-to-end by the signup route in Task 8 (browser check: signing up twice with the same email — including a differently-cased / whitespace-padded variant — returns "email ya registrado"). No standalone test here.

- [ ] **Step 3: Verify lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/lib/auth/users.js
git commit -m "feat(auth): user repository with email normalization and EmailTakenError

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Session snapshot helpers

**Files:**
- Create: `app/lib/auth/session.js`

> **Why no unit test here:** these operate on the workerd-backed `AppSession` (cookie I/O). Behavior is verified by the login integration check in Task 8 (302 carries `Set-Cookie`, follow-up request authenticated).

- [ ] **Step 1: Write the implementation**

Create `app/lib/auth/session.js`:
```js
// Server-only. Reads/writes a minimal user snapshot in the signed AppSession cookie
// to avoid a Turso round-trip on every protected navigation.
// loginSession sets state (which flips AppSession.isPending=true so server.js emits Set-Cookie).
// Logout uses session.destroy() directly in the route.

const KEY = 'gi_user';

export function loginSession(session, {userId, role, gid, sessionVersion}) {
  // session.set is a getter on AppSession that also sets isPending=true.
  session.set(KEY, {
    userId,
    role,
    gid: gid ?? null,
    sessionVersion: Number(sessionVersion),
  });
}

export function getSessionUser(session) {
  const snap = session.get(KEY);
  if (!snap || typeof snap.userId !== 'string') return null;
  return {
    userId: snap.userId,
    role: snap.role,
    gid: snap.gid ?? null,
    sessionVersion: Number(snap.sessionVersion),
  };
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/lib/auth/session.js
git commit -m "feat(auth): session snapshot helpers (loginSession/getSessionUser)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: requireUser guard

**Files:**
- Create: `app/lib/auth/guard.js`

> **Why no unit test here:** depends on `context.session` (workerd) and `redirect` from React Router. Verified by Task 9 (visiting `/account/...` while logged out redirects to `/login`).

- [ ] **Step 1: Write the implementation**

Create `app/lib/auth/guard.js`:
```js
// Server-only. Reads the session snapshot; throws redirect('/login') if absent.
import {redirect} from 'react-router';
import {getSessionUser} from './session.js';

export async function requireUser(context) {
  const user = getSessionUser(context.session);
  if (!user) {
    throw redirect('/login');
  }
  return user;
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/lib/auth/guard.js
git commit -m "feat(auth): requireUser guard reading the session snapshot

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: CSRF assertSameOrigin (default-deny)

**Files:**
- Create: `app/lib/http/csrf.js`
- Test: `app/lib/http/csrf.test.js`

> **Why a real test here:** `assertSameOrigin` is pure (takes a `Request`, throws a `Response`). It is fully testable under Node with the global `Request`/`URL`.

- [ ] **Step 1: Write the failing test**

Create `app/lib/http/csrf.test.js`:
```js
import {describe, it, expect} from 'vitest';
import {assertSameOrigin} from './csrf.js';

function makeRequest({origin, referer} = {}) {
  const headers = {};
  if (origin !== undefined) headers.Origin = origin;
  if (referer !== undefined) headers.Referer = referer;
  return new Request('https://shop.example.com/auth/login', {
    method: 'POST',
    headers,
  });
}

describe('assertSameOrigin', () => {
  it('passes when Origin matches the request origin', () => {
    expect(() => assertSameOrigin(makeRequest({origin: 'https://shop.example.com'}))).not.toThrow();
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(() =>
      assertSameOrigin(makeRequest({referer: 'https://shop.example.com/login'})),
    ).not.toThrow();
  });

  it('throws 403 when Origin is cross-site', async () => {
    let thrown;
    try {
      assertSameOrigin(makeRequest({origin: 'https://evil.example.com'}));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(403);
  });

  it('default-denies when neither Origin nor Referer is present', () => {
    let thrown;
    try {
      assertSameOrigin(makeRequest({}));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/http/csrf.test.js`
Expected: FAIL — `Failed to resolve import "./csrf.js"`.

- [ ] **Step 3: Write minimal implementation**

Create `app/lib/http/csrf.js`:
```js
// Server-only. CSRF default-deny: reject any request whose Origin (or Referer
// fallback) is not exactly the site origin, and reject when both are absent.
export function assertSameOrigin(request) {
  const target = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  if (origin) {
    if (origin === target) return;
    throw new Response('Forbidden', {status: 403});
  }
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      if (new URL(referer).origin === target) return;
    } catch {
      // malformed Referer -> fall through to deny
    }
  }
  throw new Response('Forbidden', {status: 403});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/http/csrf.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/http/csrf.js app/lib/http/csrf.test.js
git commit -m "feat(http): assertSameOrigin CSRF default-deny guard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: createCustomer stub (frozen Phase 2 signature)

**Files:**
- Create: `app/lib/admin/operations.js`

> **Why a stub:** signup (Task 8) calls `createCustomer` to obtain a Shopify gid. Phase 2 replaces this file's body with the real/stub-mode Admin client. The signature `createCustomer(env, {email, firstName, lastName}) -> { gid }` is frozen and must not change.

- [ ] **Step 1: Write the stub**

Create `app/lib/admin/operations.js`:
```js
// Server-only. PHASE 1 STUB. Real implementation lands in Phase 2 (Admin GraphQL).
// Frozen signature: createCustomer(env, {email, firstName, lastName}) -> { gid }.
// Stub returns a deterministic-format STUB gid. createDraftOrder is declared here
// (frozen signature) but Phase 1 never calls it.

export async function createCustomer(env, {email, firstName, lastName}) {
  // Phase 1 always runs in stub mode (no PRIVATE_ADMIN_API_TOKEN handling yet).
  void email;
  void firstName;
  void lastName;
  return {gid: 'gid://shopify/Customer/STUB-' + crypto.randomUUID()};
}

export async function createDraftOrder(env, input) {
  void env;
  void input;
  throw new Error('createDraftOrder is not implemented until Phase 4.');
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: PASS (uses `crypto.randomUUID`, not `Math.random`).

- [ ] **Step 3: Commit**

```bash
git add app/lib/admin/operations.js
git commit -m "feat(admin): stub createCustomer with frozen Phase 2 signature

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Cookie secure flag + auth routes (signup/login/logout)

**Files:**
- Modify: `app/lib/session.js:32-41` (cookie options)
- Create: `app/routes/auth.signup.jsx`
- Create: `app/routes/auth.login.jsx`
- Create: `app/routes/auth.logout.jsx`

> **Why a MANUAL integration check:** routes run in mini-oxygen/workerd and touch real Turso + cookies. The contract's required test ("login 302 carries `Set-Cookie`; follow-up request authenticated") is performed as an explicit manual `curl` sequence in Step 7.

- [ ] **Step 1: Add `secure: true` to the session cookie (gated for dev)**

In `app/lib/session.js`, the `init` static currently builds the cookie without `secure`. Replace the `createCookieSessionStorage` call (lines 33-41) so it reads:
```js
    const storage = createCookieSessionStorage({
      cookie: {
        name: 'session',
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        // Secure in every environment except local http dev.
        secure: process.env.NODE_ENV !== 'development',
        secrets,
      },
    });
```

- [ ] **Step 2: Write the signup action**

Create `app/routes/auth.signup.jsx`:
```js
import {redirect, data} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {createUser, setShopifyGid, EmailTakenError} from '~/lib/auth/users';
import {loginSession} from '~/lib/auth/session';
import {createCustomer} from '~/lib/admin/operations';

/**
 * @param {import('./+types/auth.signup').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);

  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  const firstName = String(form.get('firstName') ?? '') || null;
  const lastName = String(form.get('lastName') ?? '') || null;
  const company = String(form.get('company') ?? '') || null;
  const rfc = String(form.get('rfc') ?? '') || null;

  if (!email || password.length < 8) {
    return data({error: 'Correo y contraseña (mínimo 8 caracteres) son obligatorios.'}, {status: 400});
  }

  const db = getDb(context.env);

  let user;
  try {
    user = await createUser(db, context.env, {
      email,
      password,
      firstName,
      lastName,
      company,
      rfc,
      role: 'quoter',
    });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return data({error: 'Ese correo ya está registrado.'}, {status: 409});
    }
    throw err;
  }

  // Idempotent Shopify link (stub in Phase 1).
  const {gid} = await createCustomer(context.env, {email: user.email, firstName, lastName});
  await setShopifyGid(db, user.id, gid);

  // Rotate to a brand-new session before setting identity (anti-fixation).
  await context.session.destroy();
  loginSession(context.session, {
    userId: user.id,
    role: user.role,
    gid,
    sessionVersion: user.sessionVersion,
  });

  // server.js (isPending) attaches Set-Cookie to the redirect response.
  return redirect('/account');
}
```

- [ ] **Step 3: Write the login action (with throttling)**

Create `app/routes/auth.login.jsx`:
```js
import {redirect, data} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {findByEmail, normalizeEmail} from '~/lib/auth/users';
import {verifyPassword} from '~/lib/auth/password';
import {loginSession} from '~/lib/auth/session';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 8; // per email OR per IP within the window

function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
    'unknown'
  );
}

async function recentFailures(db, email, ip) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const res = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM login_attempts
          WHERE success = 0 AND created_at >= ? AND (email = ? OR ip = ?)`,
    args: [since, email, ip],
  });
  return Number(res.rows[0]?.n ?? 0);
}

async function recordAttempt(db, email, ip, success) {
  await db.execute({
    sql: `INSERT INTO login_attempts (id, email, ip, success, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), email, ip, success ? 1 : 0, new Date().toISOString()],
  });
}

/**
 * @param {import('./+types/auth.login').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);

  const form = await request.formData();
  const email = normalizeEmail(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');

  const db = getDb(context.env);
  const ip = clientIp(request);

  // Generic message + timing for all failure modes (no user enumeration).
  const genericFail = () =>
    data({error: 'Correo o contraseña incorrectos.'}, {status: 401});

  if (!email || !password) return genericFail();

  if ((await recentFailures(db, email, ip)) >= MAX_ATTEMPTS) {
    return data(
      {error: 'Demasiados intentos. Intenta de nuevo en unos minutos.'},
      {status: 429},
    );
  }

  const user = await findByEmail(db, email);
  // findByEmail does not return hash columns; re-read them only when a user exists.
  // For the no-user branch we still run verifyPassword against a dummy rec so the
  // timing is uniform (no user enumeration via response latency).
  let ok = false;
  if (user) {
    const secret = await db.execute({
      sql: `SELECT password_hash, password_salt, password_iterations FROM users WHERE id = ?`,
      args: [user.id],
    });
    const row = secret.rows[0];
    ok = await verifyPassword(password, {
      hash: row?.password_hash ?? '',
      salt: row?.password_salt ?? '',
      iterations: Number(row?.password_iterations ?? 100000),
    }, context.env);
  } else {
    // Dummy rec: keeps the verify path warm so timing matches the user-exists case.
    const dummyRec = {hash: '', salt: '', iterations: 100000};
    await verifyPassword(password, dummyRec, context.env);
  }

  if (!user || !ok) {
    await recordAttempt(db, email, ip, false);
    return genericFail();
  }

  await recordAttempt(db, email, ip, true);

  // Rotate the session before setting identity (anti-fixation).
  await context.session.destroy();
  loginSession(context.session, {
    userId: user.id,
    role: user.role,
    gid: user.shopifyCustomerGid,
    sessionVersion: user.sessionVersion,
  });

  return redirect('/account');
}
```

- [ ] **Step 4: Write the logout action**

Create `app/routes/auth.logout.jsx`:
```js
import {redirect} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';

/**
 * @param {import('./+types/auth.logout').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);
  // destroy() (not unset) emits a Set-Cookie that expires the cookie.
  await context.session.destroy();
  return redirect('/');
}

// GET /auth/logout should not act; bounce to home.
export async function loader() {
  return redirect('/');
}
```

- [ ] **Step 5: Verify lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 6: Verify codegen/types resolve the new routes**

Run: `npm run codegen`
Expected: completes without error; `.react-router/types/...` now includes `auth.signup`, `auth.login`, `auth.logout`.

- [ ] **Step 7: MANUAL integration check (login Set-Cookie + authenticated follow-up)**

Start dev with real Turso + a pepper:
```bash
SESSION_SECRET="dev-secret-please-change" \
AUTH_PEPPER="dev-pepper" \
TURSO_DATABASE_URL="https://<db>.turso.io" \
TURSO_AUTH_TOKEN="<token>" \
npm run dev
```
In a browser, register at `/registro` (with a password), then verify these exact behaviors with `curl` against the dev origin (replace host/port with the printed dev URL, e.g. `http://localhost:3000`):
```bash
# 1) Login returns 302 + Set-Cookie
curl -i -X POST http://localhost:3000/auth/login \
  -H "Origin: http://localhost:3000" \
  --data-urlencode "email=you@example.com" \
  --data-urlencode "password=YourPassw0rd" \
  -c cookies.txt
# Expected: HTTP/1.1 302 Found ; Location: /account ; Set-Cookie: session=...

# 2) Follow-up request is authenticated (no redirect to /login)
curl -i http://localhost:3000/account -b cookies.txt
# Expected: 200 (account page), NOT a 302 to /login

# 3) CSRF: a cross-origin POST is rejected
curl -i -X POST http://localhost:3000/auth/login -H "Origin: https://evil.example.com" \
  --data "email=x&password=y"
# Expected: HTTP/1.1 403 Forbidden

# 4) Logout expires the cookie
curl -i -X POST http://localhost:3000/auth/logout -H "Origin: http://localhost:3000" -b cookies.txt
# Expected: 302 to / ; Set-Cookie with an expired/empty session
```
All four expectations must hold before proceeding.

- [ ] **Step 8: Commit**

```bash
git add app/lib/session.js app/routes/auth.signup.jsx app/routes/auth.login.jsx app/routes/auth.logout.jsx
git commit -m "feat(auth): signup/login/logout routes with throttling, rotation, secure cookie

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Wire existing routes/components to the new auth

**Files:**
- Modify: `app/routes/login.jsx` (rewrite)
- Modify: `app/routes/registro.jsx:9,11-35,60-281` (add password field, submit to `/auth/signup`)
- Modify: `app/routes/account.$.jsx:1-11` (swap guard)
- Modify: `app/root.jsx:100-113,185` (snapshot isLoggedIn + role)
- Modify: `app/components/gi/RoleBanner.jsx` (remove switcher)
- Delete: `app/routes/account_.login.jsx`, `app/routes/account_.authorize.jsx`, `app/routes/account_.logout.jsx`

- [ ] **Step 1: Rewrite `login.jsx` as an email+password form posting to `/auth/login`**

Replace the entire contents of `app/routes/login.jsx` with:
```jsx
import {Form, useActionData, useNavigation} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';

export {action} from './auth.login.jsx';

export const meta = () => [{title: 'Iniciar sesión · Generando Ideas'}];

export default function Login() {
  const actionData = useActionData();
  const nav = useNavigation();
  const busy = nav.state !== 'idle';

  return (
    <div className="auth-wrap" data-screen-label="02 Login">
      <div className="auth-form-col">
        <div className="eyebrow">// Acceso · /login</div>
        <h1>Inicia sesión.</h1>
        <p>Accede a tu lista de cotización y al historial de cotizaciones.</p>

        <Form className="auth-form" method="post">
          <div className="field">
            <label htmlFor="login-email">Correo corporativo</label>
            <input
              id="login-email"
              className="input"
              type="email"
              name="email"
              required
              placeholder="mariana@empresa.mx"
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              className="input"
              type="password"
              name="password"
              required
              placeholder="••••••••"
            />
          </div>

          {actionData?.error && (
            <span className="help-msg" role="alert" style={{color: 'var(--danger, #c0392b)'}}>
              {actionData.error}
            </span>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            iconRight="arrow_right"
            disabled={busy}
            style={{width: '100%', justifyContent: 'center', marginTop: 8}}
          >
            {busy ? 'Entrando…' : 'Iniciar sesión'}
          </Button>
        </Form>

        <div
          style={{
            marginTop: 32,
            padding: 16,
            background: 'var(--bg-soft)',
            borderRadius: 12,
            fontSize: 13,
            color: 'var(--ink-3)',
            display: 'flex',
            gap: 12,
            alignItems: 'start',
          }}
        >
          <Icon name="bolt" size={16} className="muted" />
          <span>
            <strong style={{color: 'var(--ink)'}}>¿No tienes cuenta?</strong>{' '}
            <a href="/registro" style={{color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline'}}>
              Regístrate aquí
            </a>{' '}
            · Aprobación en menos de 24 horas hábiles.
          </span>
        </div>
      </div>

      <aside className="auth-side">
        <div style={{position: 'relative'}}>
          <div className="eyebrow" style={{color: 'var(--accent)'}}>
            // Acceso autorizado
          </div>
          <h2>
            Tu cuenta<br />
            <em>desbloquea</em><br />
            precios reales.
          </h2>
        </div>
        <div className="auth-perks">
          {[
            'Precios netos por proyecto',
            'Lista de cotización ilimitada',
            'Historial completo de cotizaciones',
            'Asesor de cuenta dedicado',
            'Re-cotizaciones con un solo clic',
          ].map((p) => (
            <div key={p} className="p">
              <Icon name="check" size={16} />
              {p}
            </div>
          ))}
        </div>
        <div className="auth-quote">
          “Pedimos 1,200 kits de bienvenida personalizados. Llegaron en 11 días, impecables.”
          <div style={{marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)'}}>
            MARIANA RUIZ · HR LEAD · BANORTE
          </div>
        </div>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Add a password field to `registro.jsx` and submit to `/auth/signup`**

In `app/routes/registro.jsx`:

(a) Re-export the signup action and switch the form to a real POST. Replace the import line `import {useApp} from '~/lib/AppContext';` usage of `setRole` — remove `const {setRole} = useApp();` (line 9). Add near the top imports:
```jsx
import {Form, useActionData} from 'react-router';

export {action} from './auth.signup.jsx';
```

(b) Replace the fake submit handler (lines 31-35, the body that does `setRole(...)` and `window.location.href = ...`) so the final step submits the form to the action. Change the final-step submit button to `type="submit"` inside a `<Form method="post">` instead of `<form onSubmit={next}>`. Concretely, change the form open tag (line 60) from:
```jsx
        <form className="auth-form" onSubmit={next}>
```
to:
```jsx
        <Form className="auth-form" method="post">
```
and its matching `</form>` (line 281) to `</Form>`.

(c) Ensure these inputs carry the exact `name` attributes the action reads. The existing fields bind to `form.name`/`form.lastName`/`form.email`/`form.company`/`form.rfc`; add `name="..."` attributes so they post: `name="firstName"` (first-name input, line ~68), `name="lastName"` (line ~78), `name="email"` (line ~90), `name="company"` (line ~118), `name="rfc"` (line ~145).

(d) Add a NEW password field immediately after the email field block (after line ~90's field closes). Insert:
```jsx
                <div className="field">
                  <label htmlFor="reg-password">Contraseña</label>
                  <input
                    id="reg-password"
                    className="input"
                    type="password"
                    name="password"
                    minLength={8}
                    required
                    value={form.password}
                    onChange={(e) => setForm({...form, password: e.target.value})}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
```
And add `password: ''` to the initial `useState` form object (line ~11).

(e) Render the action error near the submit button:
```jsx
        {useActionData()?.error && (
          <span className="help-msg" role="alert" style={{color: 'var(--danger, #c0392b)'}}>
            {useActionData().error}
          </span>
        )}
```

> Multi-step UI is preserved (the JS step navigation stays); only the FINAL step's button becomes `type="submit"` inside the `<Form>`, and intermediate "next" buttons stay `type="button"`.

- [ ] **Step 3: Swap the guard in `account.$.jsx`**

Replace the entire contents of `app/routes/account.$.jsx` with:
```jsx
import {redirect} from 'react-router';
import {requireUser} from '~/lib/auth/guard';

// fallback wild card for all unauthenticated routes in the account section
/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  await requireUser(context);
  return redirect('/account');
}

/** @typedef {import('./+types/account.$').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
```

- [ ] **Step 4: Snapshot-based `isLoggedIn` + role in `root.jsx`**

In `app/root.jsx`, add the import near the other `~/lib` imports:
```jsx
import {getSessionUser} from '~/lib/auth/session';
```
Replace the loader block that calls `customerAccount.isLoggedIn()` (lines 100-113). Change:
```jsx
  const {storefront, customerAccount} = context;

  const [header, isLoggedIn] = await Promise.all([
    // ...header query...
    customerAccount.isLoggedIn().catch(() => false),
  ]);

  return {header, isLoggedIn};
```
to read from the session snapshot instead of Shopify OAuth:
```jsx
  const {storefront, session} = context;
  const sessionUser = getSessionUser(session);

  const [header] = await Promise.all([
    // ...header query (KEEP the existing header query call here)...
  ]);

  return {
    header,
    isLoggedIn: Boolean(sessionUser),
    role: sessionUser?.role ?? null,
  };
```
> Keep the existing header storefront query exactly as it was (it is the first element of the original `Promise.all`); only the `customerAccount.isLoggedIn()` element is removed and `session` is destructured in place of `customerAccount`.

Then pass `role` into the provider. Change line 185 from:
```jsx
      <AppProvider isLoggedIn={data.isLoggedIn}>
```
to:
```jsx
      <AppProvider isLoggedIn={data.isLoggedIn} role={data.role}>
```
> Note: `AppProvider` is reworked in Phase 7 to CONSUME `role` as a read-only value (replacing the simulated role switcher), so this prop is not dead — do not change the prop here.

- [ ] **Step 5: Remove the role switcher from `RoleBanner.jsx`**

In `app/components/gi/RoleBanner.jsx`:

(a) In `RoleBanner`, drop `setRole` from the destructure (line 9 becomes `const {role, isLoggedIn} = useApp();`) and DELETE the "Cambiar rol" `<div>` block (lines 20-45) — the second flex `<div>` containing the role buttons. Keep the "sesión iniciada como" label block. Update the leading label text from `Modo simulación · sesión iniciada como` to `Sesión iniciada como`.

(b) In `TweaksPanel`, change the destructure (line 55) from `const {tweaks, setTweak, role, setRole, isLoggedIn} = useApp();` to `const {tweaks, setTweak} = useApp();` and DELETE the entire `{isLoggedIn && ( <TweakGroup label="Rol simulado"> ... </TweakGroup> )}` block (lines 110-121). Also remove the now-unused `showRoleBanner` group only if it references role — it does not, so KEEP the accent/density/banner groups intact.

- [ ] **Step 6: Delete the Shopify OAuth routes**

```bash
git rm app/routes/account_.login.jsx app/routes/account_.authorize.jsx app/routes/account_.logout.jsx
```

- [ ] **Step 7: Verify lint + codegen**

Run: `npm run lint`
Expected: PASS.

Run: `npm run codegen`
Expected: completes; the deleted OAuth routes no longer appear in generated types.

- [ ] **Step 8: MANUAL browser check**

With `npm run dev` (env from Task 8 Step 7):
1. Visit `/account` while logged out → redirected to `/login`.
2. Register at `/registro` with a password → lands on `/account` (logged in).
3. Header/RoleBanner shows "Sesión iniciada como" with NO role-switch buttons; the TweaksPanel has NO "Rol simulado" group.
4. Sign up again with the SAME email (try a padded/upper-case variant, e.g. ` YOU@Example.com `) → "Ese correo ya está registrado." (proves normalization + UNIQUE).
5. Visiting `/account/login`, `/account/authorize`, `/account/logout` → 404 (routes deleted).

- [ ] **Step 9: Commit**

```bash
git add app/routes/login.jsx app/routes/registro.jsx app/routes/account.$.jsx app/root.jsx app/components/gi/RoleBanner.jsx
git commit -m "feat(auth): wire login/registro/account/root to self-hosted auth; drop OAuth routes and role switcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Migrate surviving account routes off Shopify customerAccount

> **Why now:** once the Shopify OAuth routes are deleted (Task 9), `context.customerAccount` is no longer the source of auth. The three surviving account screens still call `customerAccount.query(CUSTOMER_DETAILS_QUERY)` / `customerAccount.mutate` / `handleAuthStatus()`, so they break at runtime. This task repoints them at the Turso user via `requireUser` + the `users` repo. The `account.addresses` and `account.orders` screens are NOT migrated here — their nav links are removed (deferred per spec §5.4).

> **Why a MANUAL verification (no unit test):** these are loaders/actions that run in mini-oxygen/workerd and touch real Turso + the session cookie. They are verified by an explicit logged-in route check in Step 4, consistent with Tasks 8-9.

**Files:**
- Modify: `app/routes/account.jsx` (loader + nav)
- Modify: `app/routes/account._index.jsx` (render from Turso user)
- Modify: `app/routes/account.profile.jsx` (loader + action)

- [ ] **Step 1: Repoint `account.jsx` loader at the Turso user and prune the nav**

Replace the entire contents of `app/routes/account.jsx` with:
```jsx
import {data as remixData, NavLink, Outlet, useLoaderData} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {findById} from '~/lib/auth/users';

export function shouldRevalidate() {
  return true;
}

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const {userId} = await requireUser(context);
  const db = getDb(context.env);
  const user = await findById(db, userId);
  if (!user) {
    // Snapshot is stale (user deleted); force re-auth.
    throw redirect('/login');
  }

  return remixData(
    {user},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

// Addresses and Orders are deferred per spec §5.4 — their nav links are removed.
const NAV = [
  {to: '/account', label: 'Resumen', icon: 'user', end: true},
  {to: '/cotizacion', label: 'Cotizaciones', icon: 'quote'},
  {to: '/account/favoritos', label: 'Favoritos', icon: 'heart_outline'},
  {to: '/account/profile', label: 'Mi perfil', icon: 'settings'},
];

export default function AccountLayout() {
  /** @type {LoaderReturnData} */
  const {user} = useLoaderData();
  const initials =
    `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}` || 'GI';

  return (
    <div className="container acct-page" data-screen-label="09 Account">
      <aside className="acct-sidebar">
        <div className="acct-user">
          <div className="acct-avatar">{initials}</div>
          <div className="acct-user-info">
            <div className="nm">
              {user?.firstName
                ? `${user.firstName} ${user.lastName ?? ''}`
                : 'Mi cuenta'}
            </div>
            <div className="em">{user?.email || ''}</div>
          </div>
        </div>
        <nav className="acct-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {({isActive}) => (
                <span
                  className={isActive ? 'active' : ''}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--r-md)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: isActive ? 'var(--bg-elev)' : 'var(--ink-2)',
                    background: isActive ? 'var(--ink)' : 'transparent',
                  }}
                >
                  <Icon name={n.icon} size={15} />
                  {n.label}
                </span>
              )}
            </NavLink>
          ))}
          <Form method="POST" action="/auth/logout">
            <button
              type="submit"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--r-md)',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--ink-3)',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <Icon name="log_out" size={15} />
              Cerrar sesión
            </button>
          </Form>
        </nav>
      </aside>

      <div className="acct-content">
        <Outlet context={{user}} />
      </div>
    </div>
  );
}

/** @typedef {import('./+types/account').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
```
> Notes: the import line must also include `Form` and `redirect` from `react-router` (the snippet uses both). Use exactly:
> ```jsx
> import {data as remixData, Form, NavLink, Outlet, redirect, useLoaderData} from 'react-router';
> ```
> The `CUSTOMER_DETAILS_QUERY` import is dropped. The logout `action` is repointed from `/account/logout` (deleted OAuth route) to `/auth/logout` (Task 8). The Outlet context key changes from `customer` to `user`.

- [ ] **Step 2: Render `account._index.jsx` from the Turso user**

Replace the entire contents of `app/routes/account._index.jsx` with:
```jsx
import {useOutletContext, useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';
import {useApp} from '~/lib/AppContext';

export default function AccountOverview() {
  const {user} = useOutletContext();
  const navigate = useNavigate();
  const {role, quoteCount, favs} = useApp();

  const stats = [
    {l: 'En cotización', v: quoteCount, d: 'piezas pendientes'},
    {l: 'Favoritos', v: favs.length, d: 'productos guardados'},
    {
      l: 'Tipo de cuenta',
      v: role === 'buyer' ? 'Comprador' : 'Cotizador',
      d: 'rol activo',
    },
  ];

  return (
    <>
      <h1>Hola{user?.firstName ? `, ${user.firstName}` : ''}.</h1>
      <p style={{color: 'var(--ink-3)', margin: '-8px 0 0'}}>
        Este es el resumen de tu cuenta corporativa en Generando Ideas.
      </p>

      <div className="acct-stats">
        {stats.map((s) => (
          <div key={s.l} className="acct-stat">
            <div className="l">{s.l}</div>
            <div className="v">{s.v}</div>
            <div className="d">{s.d}</div>
          </div>
        ))}
      </div>

      <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
        <Button variant="primary" iconRight="arrow_right" onClick={() => navigate('/catalogo')}>
          Explorar catálogo
        </Button>
        <Button variant="ghost" icon="quote" onClick={() => navigate('/cotizacion')}>
          Mi cotización
        </Button>
      </div>

      <div
        style={{
          padding: 20,
          background: 'var(--bg-elev)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
          display: 'flex',
          gap: 14,
          alignItems: 'start',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--accent-soft)',
            color: 'var(--warn)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="bolt" size={18} />
        </div>
        <div>
          <div style={{fontWeight: 600, marginBottom: 4}}>Tu asesor: Carlos Méndez</div>
          <p style={{margin: 0, fontSize: 14, color: 'var(--ink-3)'}}>
            Responde en menos de 2 horas hábiles. WhatsApp +52 (55) 7098 8100 ·
            marketing@generandoideas.com
          </p>
        </div>
      </div>
    </>
  );
}
```
> Notes: the outlet context key is now `user` (was `customer`). The Shopify-orders stat and the "Ver órdenes" button are removed (orders are deferred per §5.4); the remaining stats/CTAs read from `useApp()` and the Turso user only.

- [ ] **Step 3: Repoint `account.profile.jsx` loader + action at the `users` repo**

Replace the entire contents of `app/routes/account.profile.jsx` with:
```jsx
import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {updateProfile, findById} from '~/lib/auth/users';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Mi perfil · Generando Ideas'}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  await requireUser(context);
  return {};
}

/**
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  assertSameOrigin(request);

  if (request.method !== 'PUT') {
    return data({error: 'Method not allowed'}, {status: 405});
  }

  const {userId} = await requireUser(context);
  const db = getDb(context.env);
  const form = await request.formData();

  const firstName = String(form.get('firstName') ?? '') || null;
  const lastName = String(form.get('lastName') ?? '') || null;
  const company = String(form.get('company') ?? '') || null;
  const rfc = String(form.get('rfc') ?? '') || null;

  try {
    await updateProfile(db, userId, {firstName, lastName, company, rfc});
    const user = await findById(db, userId);
    return {error: null, user};
  } catch (error) {
    return data({error: error.message, user: null}, {status: 400});
  }
}

export default function AccountProfile() {
  const {user: contextUser} = useOutletContext();
  const {state} = useNavigation();
  /** @type {ActionReturnData} */
  const actionData = useActionData();
  const user = actionData?.user ?? contextUser;

  return (
    <div className="account-profile">
      <h2>Mi perfil</h2>
      <br />
      <Form method="PUT">
        <legend>Información personal</legend>
        <fieldset>
          <label htmlFor="firstName">Nombre</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            placeholder="Nombre"
            aria-label="Nombre"
            defaultValue={user?.firstName ?? ''}
            minLength={2}
          />
          <label htmlFor="lastName">Apellido</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            placeholder="Apellido"
            aria-label="Apellido"
            defaultValue={user?.lastName ?? ''}
            minLength={2}
          />
          <label htmlFor="company">Empresa</label>
          <input
            id="company"
            name="company"
            type="text"
            autoComplete="organization"
            placeholder="Empresa"
            aria-label="Empresa"
            defaultValue={user?.company ?? ''}
          />
          <label htmlFor="rfc">RFC</label>
          <input
            id="rfc"
            name="rfc"
            type="text"
            placeholder="RFC"
            aria-label="RFC"
            defaultValue={user?.rfc ?? ''}
          />
        </fieldset>
        {actionData?.error ? (
          <p>
            <mark>
              <small>{actionData.error}</small>
            </mark>
          </p>
        ) : (
          <br />
        )}
        <button type="submit" disabled={state !== 'idle'}>
          {state !== 'idle' ? 'Guardando' : 'Guardar'}
        </button>
      </Form>
    </div>
  );
}

/**
 * @typedef {{
 *   error: string | null;
 *   user: object | null;
 * }} ActionResponse
 */

/** @typedef {import('./+types/account.profile').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
/** @typedef {ReturnType<typeof useActionData<typeof action>>} ActionReturnData */
```
> Notes: drops the `CUSTOMER_UPDATE_MUTATION` import, `customerAccount.mutate`, and `handleAuthStatus`. The action stays method `PUT` (matching the `<Form method="PUT">`), calls `assertSameOrigin(request)` first (state-changing), then `updateProfile`. The outlet context key is `user`. Company/RFC fields are added because the Turso `users` table and `updateProfile` carry them.

- [ ] **Step 4: Verify lint + codegen, then MANUAL logged-in check**

Run: `npm run lint`
Expected: PASS (no `customerAccount`/`CUSTOMER_DETAILS_QUERY`/`CUSTOMER_UPDATE_MUTATION` references remain in these three files).

Run: `npm run codegen`
Expected: completes without error.

With `npm run dev` (env from Task 8 Step 7), logged in:
1. Visit `/account` → sidebar shows your name + email from Turso; the nav lists Resumen, Cotizaciones, Favoritos, Mi perfil ONLY (NO "Mis órdenes", NO "Direcciones").
2. The overview (`/account`) renders without error and shows the En cotización / Favoritos / Tipo de cuenta stats (no Órdenes stat, no "Ver órdenes" button).
3. Visit `/account/profile`, change Nombre/Apellido/Empresa/RFC, submit → values persist on reload (proves `updateProfile` wrote to Turso).
4. A cross-origin `PUT` to `/account/profile` (Origin: https://evil.example.com) → 403 (proves `assertSameOrigin`).

- [ ] **Step 5: Commit**

```bash
git add app/routes/account.jsx app/routes/account._index.jsx app/routes/account.profile.jsx
git commit -m "feat(auth): migrate surviving account routes off Shopify customerAccount to Turso

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Interim admin password-recovery route

> **Why:** with self-hosted auth there is no Shopify password-reset flow. Until a full email-based reset lands, this server-only route lets an operator set a temporary password for a user, guarded by a shared secret (`env.ADMIN_RESET_SECRET`) compared in constant time. It bumps `session_version` so any existing sessions for that user are invalidated. There is NO UI and NO loader (POST-only); a GET returns 404.

> **Why a MANUAL verification (no unit test):** the action touches real Turso (`findByEmail`, users update, `bumpSessionVersion`) and reads `context.env`; it is impractical to unit-test under Node. Verified by the `curl` sequence in Step 3.

**Files:**
- Create: `app/routes/admin.reset-password.jsx`

- [ ] **Step 1: Write the action (constant-time secret check)**

Create `app/routes/admin.reset-password.jsx`:
```jsx
import {data} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {findByEmail, bumpSessionVersion, normalizeEmail} from '~/lib/auth/users';
import {hashPassword} from '~/lib/auth/password';

// Constant-time string compare (no early return on length mismatch).
function constantTimeStringEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(String(a));
  const bb = enc.encode(String(b));
  let diff = ab.length ^ bb.length;
  const max = Math.max(ab.length, bb.length);
  for (let i = 0; i < max; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/**
 * @param {import('./+types/admin.reset-password').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);

  const expected = context.env.ADMIN_RESET_SECRET;
  const provided = request.headers.get('X-Admin-Reset-Secret') ?? '';
  // Default-deny: if the env secret is unset, never authorize.
  if (!expected || !constantTimeStringEqual(provided, expected)) {
    return data({error: 'Forbidden'}, {status: 403});
  }

  const form = await request.formData();
  const email = normalizeEmail(form.get('email') ?? '');
  if (!email) {
    return data({error: 'email is required'}, {status: 400});
  }

  const db = getDb(context.env);
  const user = await findByEmail(db, email);
  if (!user) {
    // Do not reveal whether the email exists.
    return data({ok: true}, {status: 200});
  }

  // Generate a temporary password (URL-safe random), hash it, store it.
  const temp = crypto.randomUUID();
  const rec = await hashPassword(temp, context.env);
  await db.execute({
    sql: `UPDATE users
          SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ?
          WHERE id = ?`,
    args: [rec.hash, rec.salt, rec.iterations, new Date().toISOString(), user.id],
  });

  // Invalidate every existing session for this user.
  await bumpSessionVersion(db, user.id);

  // Return the temp password ONCE so the operator can relay it out-of-band.
  return data({ok: true, tempPassword: temp}, {status: 200});
}

// POST-only: a GET must not act.
export async function loader() {
  throw new Response('Not Found', {status: 404});
}
```
> Notes: server-only (no default export / no UI). The secret is read from `context.env.ADMIN_RESET_SECRET` and compared in constant time; an unset secret default-denies. `assertSameOrigin` runs first. The temp password is returned exactly once in the response body (never logged). `bumpSessionVersion` (Task 3) is finally exercised here, invalidating the user's existing sessions.

- [ ] **Step 2: Verify lint + codegen**

Run: `npm run lint`
Expected: PASS (uses `crypto.randomUUID`, not `Math.random`; no bare libSQL import).

Run: `npm run codegen`
Expected: completes; `admin.reset-password` appears in generated route types.

- [ ] **Step 3: MANUAL verification (curl)**

With `npm run dev` and `ADMIN_RESET_SECRET="dev-admin-secret"` added to the env from Task 8 Step 7, against the dev origin:
```bash
# 1) Wrong secret -> 403
curl -i -X POST http://localhost:3000/admin/reset-password \
  -H "Origin: http://localhost:3000" \
  -H "X-Admin-Reset-Secret: wrong" \
  --data-urlencode "email=you@example.com"
# Expected: HTTP/1.1 403 Forbidden

# 2) Correct secret -> 200 with a tempPassword
curl -i -X POST http://localhost:3000/admin/reset-password \
  -H "Origin: http://localhost:3000" \
  -H "X-Admin-Reset-Secret: dev-admin-secret" \
  --data-urlencode "email=you@example.com"
# Expected: 200 ; JSON body { "ok": true, "tempPassword": "<uuid>" }

# 3) The OLD password no longer logs in; the temp password does
curl -i -X POST http://localhost:3000/auth/login -H "Origin: http://localhost:3000" \
  --data-urlencode "email=you@example.com" --data-urlencode "password=<OLD password>"
# Expected: 401
curl -i -X POST http://localhost:3000/auth/login -H "Origin: http://localhost:3000" \
  --data-urlencode "email=you@example.com" --data-urlencode "password=<tempPassword from step 2>"
# Expected: 302 to /account + Set-Cookie

# 4) GET is inert
curl -i http://localhost:3000/admin/reset-password
# Expected: HTTP/1.1 404 Not Found
```
All four expectations must hold before proceeding.

- [ ] **Step 4: Commit**

```bash
git add app/routes/admin.reset-password.jsx
git commit -m "feat(auth): interim admin password-recovery route guarded by ADMIN_RESET_SECRET

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §4 isolation/security rules → ESLint guardrails (Task 0), server-only modules (Tasks 1-8), `crypto.randomUUID` everywhere.
- §5.1 users schema → Task 2 `migrate`. §5.2 modules → Tasks 1-6. §5.3 routes → Task 8. §5.4 existing-file edits → Tasks 8-9.
- §11 security (hashing, session secure/rotation/version, throttling via `login_attempts`, CSRF) → Tasks 0,1,6,8.
- §12 env vars → consumed in Tasks 2,8,11 (`AUTH_PEPPER`, `TURSO_*`, `SESSION_SECRET`, `ADMIN_RESET_SECRET`).
- §5.4 surviving account routes migrated off Shopify `customerAccount` → Task 10 (account.jsx / account._index.jsx / account.profile.jsx). Interim admin password-recovery → Task 11.
- Task 0 extras (vitest + vitest.config.js + no-restricted-imports + Math.random ban) → Task 0.

**Frozen-interface check:** `getDb`, `migrate`, `hashPassword`/`verifyPassword`, `EmailTakenError`/`createUser`/`findByEmail`/`findById`/`updateProfile`/`setShopifyGid`/`bumpSessionVersion`, `loginSession`/`getSessionUser`, `requireUser`, `assertSameOrigin`, `createCustomer` (stub) — all match the contract signatures exactly.

**Known notes / deviations:** `findByEmail` (per contract) returns the public User shape without password columns, so `auth.login.jsx` re-reads `password_hash/salt/iterations` by id before `verifyPassword`. `bumpSessionVersion` is now invoked by the interim admin reset route (Task 11) to invalidate existing sessions; logout's optional global-revocation is still left to a follow-up, per §5.3 "Opcional". The `account.addresses` / `account.orders` routes remain in the tree but are unlinked from the account nav (deferred per §5.4); they are migrated off `customerAccount` in a later phase.
