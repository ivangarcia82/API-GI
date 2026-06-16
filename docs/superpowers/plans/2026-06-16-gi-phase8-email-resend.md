# Phase 8: Email verification + password reset (Resend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add transactional email (Resend), single-use expiring tokens, and the verify-email / forgot-password / reset-password flows, replacing the interim admin-only recovery from §11 of the spec.

**Architecture:** A pure-ish `sendEmail(env,{...})` posts to the Resend HTTP API (edge-safe `fetch`) and degrades to a loud no-op stub when `RESEND_API_KEY` is absent (mirrors the Admin stub). A new `email_tokens` table stores only a SHA-256 hash of each token; `tokens.js` creates/verifies single-use expiring tokens over libSQL. Three workerd-only routes (`auth.forgot`, `auth.reset`, `auth.verify`) drive the user flows, and signup is wired to send a best-effort verification email. Pure modules (resend, tokens, migrate addition) are covered by real vitest; the workerd-only routes get MANUAL verification steps.

**Tech Stack:** JS + JSX, React Router 7 on Oxygen/workerd, libSQL/web (Turso), WebCrypto (`crypto.subtle.digest`, `crypto.getRandomValues`, `crypto.randomUUID`), Resend HTTP API, vitest with in-memory libSQL via the NODE build (`import {createClient} from '@libsql/client'`, url `':memory:'`).

---

### Task 1: Resend email client with loud stub

**Files:**
- Create: `app/lib/email/resend.js`
- Test: `app/lib/email/resend.test.js`

- [ ] **Step 1: Write the failing test**

```js
import {describe, it, expect, vi, afterEach} from 'vitest';
import {sendEmail, isEmailStubMode} from './resend.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('email/resend', () => {
  it('is in stub mode when RESEND_API_KEY is absent', () => {
    expect(isEmailStubMode({})).toBe(true);
    expect(isEmailStubMode({RESEND_API_KEY: 'x'})).toBe(false);
  });

  it('stub mode logs and does not call fetch', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await sendEmail(
      {EMAIL_FROM: 'GI <no-reply@x.com>'},
      {to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>'},
    );
    expect(res).toEqual({stub: true, id: null});
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('posts to the Resend API with bearer auth and EMAIL_FROM', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({id: 'msg_123'}),
    });
    const env = {
      RESEND_API_KEY: 'sk_test',
      EMAIL_FROM: 'Generando Ideas <no-reply@notificaciones.generandoideas.com>',
    };
    const res = await sendEmail(env, {to: 'a@b.com', subject: 'Hola', html: '<p>x</p>'});
    expect(res).toEqual({stub: false, id: 'msg_123'});
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer sk_test');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toEqual({
      from: 'Generando Ideas <no-reply@notificaciones.generandoideas.com>',
      to: 'a@b.com',
      subject: 'Hola',
      html: '<p>x</p>',
    });
  });

  it('throws when the Resend API returns a non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({message: 'invalid from'}),
    });
    await expect(
      sendEmail({RESEND_API_KEY: 'sk', EMAIL_FROM: 'x'}, {to: 'a@b.com', subject: 's', html: 'h'}),
    ).rejects.toThrow(/Resend API error/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/email/resend.test.js`
Expected: FAIL — cannot find module `./resend.js`

- [ ] **Step 3: Write minimal implementation**

```js
// Server-only. Transactional email via Resend HTTP API (edge-safe fetch).
// Loud no-op stub when RESEND_API_KEY is absent (mirrors the Admin stub).
const RESEND_URL = 'https://api.resend.com/emails';

/**
 * @param {Record<string, any>} env
 * @returns {boolean} true when no RESEND_API_KEY -> stub mode
 */
export function isEmailStubMode(env) {
  return !(env && env.RESEND_API_KEY);
}

/**
 * Send an email. Returns {stub:boolean, id:string|null}.
 * @param {Record<string, any>} env
 * @param {{to: string, subject: string, html: string}} msg
 * @returns {Promise<{stub: boolean, id: string|null}>}
 */
export async function sendEmail(env, {to, subject, html}) {
  if (isEmailStubMode(env)) {
    console.warn(
      '[email][STUB] sendEmail invoked (no RESEND_API_KEY). ' +
        `to=${to} subject=${JSON.stringify(subject)} — email NOT sent.`,
    );
    return {stub: true, id: null};
  }

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({from: env.EMAIL_FROM, to, subject, html}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Resend API error (status ${res.status}): ${json && json.message ? json.message : 'unknown'}`,
    );
  }
  return {stub: false, id: json.id ?? null};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/email/resend.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/lib/email/resend.js app/lib/email/resend.test.js
git commit -m "feat(email): Resend client with loud no-op stub

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Add `email_tokens` table to migrations

**Files:**
- Modify: `app/lib/db/migrate.js`
- Test: `app/lib/db/migrate.emailTokens.test.js`

- [ ] **Step 1: Write the failing test**

```js
import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from './migrate.js';

describe('migrate: email_tokens', () => {
  let db;
  beforeEach(async () => {
    db = createClient({url: ':memory:'});
    await migrate(db);
  });

  it('creates the email_tokens table', async () => {
    const r = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='email_tokens'",
    );
    expect(r.rows.length).toBe(1);
  });

  it('has the expected columns', async () => {
    const r = await db.execute('PRAGMA table_info(email_tokens)');
    const cols = r.rows.map((x) => x.name).sort();
    expect(cols).toEqual(
      ['created_at', 'expires_at', 'id', 'token_hash', 'type', 'used_at', 'user_id'].sort(),
    );
  });

  it("rejects a type outside ('verify','reset')", async () => {
    await expect(
      db.execute({
        sql: `INSERT INTO email_tokens (id,user_id,type,token_hash,expires_at,created_at)
              VALUES (?,?,?,?,?,?)`,
        args: ['t1', 'u1', 'bogus', 'h', '2026-06-17T00:00:00Z', '2026-06-16T00:00:00Z'],
      }),
    ).rejects.toThrow();
  });

  it('is idempotent (running migrate twice does not throw)', async () => {
    await expect(migrate(db)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/db/migrate.emailTokens.test.js`
Expected: FAIL — `email_tokens` table query returns 0 rows

- [ ] **Step 3: Add the table to the STATEMENTS array**

In `app/lib/db/migrate.js`, add this entry to the `STATEMENTS` array, immediately after the `wishlist` table block (before the closing `];`):

```js
  `CREATE TABLE IF NOT EXISTS email_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    type        TEXT NOT NULL CHECK (type IN ('verify','reset')),
    token_hash  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    used_at     TEXT,
    created_at  TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_email_tokens_hash ON email_tokens(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id, type)`,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/db/migrate.emailTokens.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/lib/db/migrate.js app/lib/db/migrate.emailTokens.test.js
git commit -m "feat(db): add email_tokens table

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Single-use expiring tokens (`tokens.js`)

**Files:**
- Create: `app/lib/auth/tokens.js`
- Test: `app/lib/auth/tokens.test.js`

- [ ] **Step 1: Write the failing test**

```js
import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {createToken, verifyAndConsumeToken, hashToken} from './tokens.js';

const USER = 'user-1';

async function makeDb() {
  const db = createClient({url: ':memory:'});
  await migrate(db);
  await db.execute({
    sql: `INSERT INTO users (id,email,password_hash,password_salt,password_iterations,session_version,role,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [USER, 'u1@example.com', 'h', 's', 100000, 1, 'quoter', '2026-06-16T00:00:00Z', '2026-06-16T00:00:00Z'],
  });
  return db;
}

describe('auth/tokens', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('stores only the hash, never the raw token', async () => {
    const {token} = await createToken(db, {userId: USER, type: 'reset', ttlMs: 60_000});
    const r = await db.execute('SELECT token_hash FROM email_tokens');
    expect(r.rows[0].token_hash).toBe(await hashToken(token));
    expect(r.rows[0].token_hash).not.toBe(token);
  });

  it('verifies a fresh token and returns its user_id + type', async () => {
    const {token} = await createToken(db, {userId: USER, type: 'verify', ttlMs: 60_000});
    const res = await verifyAndConsumeToken(db, {token, type: 'verify'});
    expect(res).toEqual({userId: USER, type: 'verify'});
  });

  it('is single-use: a consumed token fails the second time', async () => {
    const {token} = await createToken(db, {userId: USER, type: 'reset', ttlMs: 60_000});
    expect(await verifyAndConsumeToken(db, {token, type: 'reset'})).toEqual({userId: USER, type: 'reset'});
    expect(await verifyAndConsumeToken(db, {token, type: 'reset'})).toBeNull();
  });

  it('rejects an expired token', async () => {
    const {token} = await createToken(db, {userId: USER, type: 'reset', ttlMs: -1000});
    expect(await verifyAndConsumeToken(db, {token, type: 'reset'})).toBeNull();
  });

  it('rejects a token whose type does not match', async () => {
    const {token} = await createToken(db, {userId: USER, type: 'verify', ttlMs: 60_000});
    expect(await verifyAndConsumeToken(db, {token, type: 'reset'})).toBeNull();
  });

  it('rejects a garbage / unknown token without throwing', async () => {
    expect(await verifyAndConsumeToken(db, {token: 'not-a-real-token', type: 'reset'})).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/auth/tokens.test.js`
Expected: FAIL — cannot find module `./tokens.js`

- [ ] **Step 3: Write minimal implementation**

```js
// Server-only. Single-use, expiring email tokens. We store only a SHA-256 hash
// of the raw token; the raw token lives only in the emailed link. Verification
// is atomic single-use: the consuming UPDATE only succeeds while used_at IS NULL.
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * SHA-256 hex of the raw token.
 * @param {string} token
 * @returns {Promise<string>}
 */
export async function hashToken(token) {
  const data = new TextEncoder().encode(String(token));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

/**
 * Generate a URL-safe random token (32 bytes -> 64 hex chars).
 * @returns {string}
 */
function randomToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/**
 * Create and persist a single-use token. Returns the RAW token for the email link.
 * @param {import('@libsql/client/web').Client} db
 * @param {{userId: string, type: 'verify'|'reset', ttlMs?: number}} opts
 * @returns {Promise<{token: string, expiresAt: string}>}
 */
export async function createToken(db, {userId, type, ttlMs = DEFAULT_TTL_MS}) {
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlMs).toISOString();
  await db.execute({
    sql: `INSERT INTO email_tokens (id, user_id, type, token_hash, expires_at, used_at, created_at)
          VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    args: [crypto.randomUUID(), userId, type, tokenHash, expiresAt, createdAt],
  });
  return {token, expiresAt};
}

/**
 * Verify a token and atomically consume it (single-use). Returns {userId,type}
 * on success, or null for unknown / wrong-type / expired / already-used tokens.
 * @param {import('@libsql/client/web').Client} db
 * @param {{token: string, type: 'verify'|'reset'}} opts
 * @returns {Promise<{userId: string, type: string}|null>}
 */
export async function verifyAndConsumeToken(db, {token, type}) {
  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();
  // Atomic single-use: only consumes an unused, unexpired token of the right type.
  const upd = await db.execute({
    sql: `UPDATE email_tokens SET used_at = ?
          WHERE token_hash = ? AND type = ? AND used_at IS NULL AND expires_at > ?`,
    args: [now, tokenHash, type, now],
  });
  if (!upd.rowsAffected) return null;
  const sel = await db.execute({
    sql: `SELECT user_id, type FROM email_tokens WHERE token_hash = ? AND type = ?`,
    args: [tokenHash, type],
  });
  const row = sel.rows[0];
  if (!row) return null;
  return {userId: row.user_id, type: row.type};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/auth/tokens.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/lib/auth/tokens.js app/lib/auth/tokens.test.js
git commit -m "feat(auth): single-use expiring email tokens (hash-only storage)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Email templates helper

**Files:**
- Create: `app/lib/email/templates.js`
- Test: `app/lib/email/templates.test.js`

- [ ] **Step 1: Write the failing test**

```js
import {describe, it, expect} from 'vitest';
import {verifyEmailTemplate, resetPasswordTemplate} from './templates.js';

describe('email/templates', () => {
  it('verify template embeds the link and returns subject + html', () => {
    const t = verifyEmailTemplate('https://gi.com/auth/verify?token=abc');
    expect(t.subject).toMatch(/verifica/i);
    expect(t.html).toContain('https://gi.com/auth/verify?token=abc');
  });

  it('reset template embeds the link and returns subject + html', () => {
    const t = resetPasswordTemplate('https://gi.com/auth/reset?token=xyz');
    expect(t.subject).toMatch(/contrase/i);
    expect(t.html).toContain('https://gi.com/auth/reset?token=xyz');
  });

  it('escapes the URL so it cannot break out of the href attribute', () => {
    const t = resetPasswordTemplate('https://gi.com/auth/reset?token=a"b<c');
    expect(t.html).not.toContain('a"b<c');
    expect(t.html).toContain('a&quot;b&lt;c');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/email/templates.test.js`
Expected: FAIL — cannot find module `./templates.js`

- [ ] **Step 3: Write minimal implementation**

```js
// Server-only. HTML email bodies for verify + reset flows. URLs are escaped
// before interpolation so a crafted link cannot break the href attribute.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(heading, bodyHtml, ctaUrl, ctaLabel) {
  const url = escapeHtml(ctaUrl);
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.5">
  <h1 style="font-size:20px">${escapeHtml(heading)}</h1>
  ${bodyHtml}
  <p style="margin:24px 0">
    <a href="${url}" style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">${escapeHtml(ctaLabel)}</a>
  </p>
  <p style="font-size:12px;color:#666">Si el botón no funciona, copia y pega este enlace:<br>${url}</p>
  <p style="font-size:12px;color:#666">Generando Ideas</p>
  </body></html>`;
}

/**
 * @param {string} verifyUrl
 * @returns {{subject: string, html: string}}
 */
export function verifyEmailTemplate(verifyUrl) {
  return {
    subject: 'Verifica tu correo — Generando Ideas',
    html: layout(
      'Verifica tu correo',
      '<p>Gracias por registrarte. Confirma tu correo para activar tu cuenta.</p>',
      verifyUrl,
      'Verificar correo',
    ),
  };
}

/**
 * @param {string} resetUrl
 * @returns {{subject: string, html: string}}
 */
export function resetPasswordTemplate(resetUrl) {
  return {
    subject: 'Restablece tu contraseña — Generando Ideas',
    html: layout(
      'Restablece tu contraseña',
      '<p>Recibimos una solicitud para restablecer tu contraseña. El enlace expira en 1 hora. Si no fuiste tú, ignora este correo.</p>',
      resetUrl,
      'Restablecer contraseña',
    ),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/email/templates.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/lib/email/templates.js app/lib/email/templates.test.js
git commit -m "feat(email): verify + reset HTML templates with URL escaping

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `markEmailVerified` + `updatePassword` user repo helpers

**Files:**
- Modify: `app/lib/auth/users.js`
- Test: `app/lib/auth/users.emailReset.test.js`

- [ ] **Step 1: Write the failing test**

```js
import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {createUser, findById, markEmailVerified, updatePassword} from './users.js';
import {verifyPassword} from './password.js';

const ENV = {AUTH_PEPPER: 'test-pepper'};

async function makeDb() {
  const db = createClient({url: ':memory:'});
  await migrate(db);
  return db;
}

describe('users: markEmailVerified + updatePassword', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('markEmailVerified sets email_verified_at', async () => {
    const u = await createUser(db, ENV, {email: 'a@b.com', password: 'password1', role: 'quoter'});
    expect((await findById(db, u.id)).emailVerifiedAt).toBeNull();
    await markEmailVerified(db, u.id);
    expect((await findById(db, u.id)).emailVerifiedAt).not.toBeNull();
  });

  it('updatePassword stores a new hash that verifies and bumps session_version', async () => {
    const u = await createUser(db, ENV, {email: 'a@b.com', password: 'password1', role: 'quoter'});
    const before = (await findById(db, u.id)).sessionVersion;
    await updatePassword(db, ENV, u.id, 'newpassword2');

    const r = await db.execute({
      sql: `SELECT password_hash, password_salt, password_iterations FROM users WHERE id = ?`,
      args: [u.id],
    });
    const rec = {
      hash: r.rows[0].password_hash,
      salt: r.rows[0].password_salt,
      iterations: r.rows[0].password_iterations,
    };
    expect(await verifyPassword('newpassword2', rec, ENV)).toBe(true);
    expect(await verifyPassword('password1', rec, ENV)).toBe(false);
    expect((await findById(db, u.id)).sessionVersion).toBe(before + 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/auth/users.emailReset.test.js`
Expected: FAIL — `markEmailVerified` / `updatePassword` are not exported

- [ ] **Step 3: Add the helpers to `app/lib/auth/users.js`**

Add this import at the top of the file (the existing top import is `import {hashPassword} from './password.js';` — replace it):

```js
import {hashPassword} from './password.js';
```

becomes

```js
import {hashPassword} from './password.js';
import {bumpSessionVersion} from './users.js'; // self-reference avoided; see below
```

Do NOT add that self-import. Instead append these two functions to the END of `app/lib/auth/users.js` (after `bumpSessionVersion`, which is already defined in this file so it is in scope):

```js
export async function markEmailVerified(db, id) {
  await db.execute({
    sql: `UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), new Date().toISOString(), id],
  });
}

// Sets a new password hash AND invalidates other sessions (session_version++).
export async function updatePassword(db, env, id, newPassword) {
  const rec = await hashPassword(newPassword, env);
  await db.execute({
    sql: `UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ?
          WHERE id = ?`,
    args: [rec.hash, rec.salt, rec.iterations, new Date().toISOString(), id],
  });
  return bumpSessionVersion(db, id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/auth/users.emailReset.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/lib/auth/users.js app/lib/auth/users.emailReset.test.js
git commit -m "feat(auth): markEmailVerified + updatePassword user repo helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Forgot-password request flow (`auth.forgot.jsx`)

No user enumeration: the action ALWAYS returns the same generic success. Only when the user exists do we create a reset token and send the email. This route is workerd-only (loaders/actions + libSQL + Resend), so it gets MANUAL verification.

**Files:**
- Create: `app/routes/auth.forgot.jsx`

- [ ] **Step 1: Write the route (loader form + action)**

```jsx
import {data, Form, useActionData} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {findByEmail} from '~/lib/auth/users';
import {createToken} from '~/lib/auth/tokens';
import {sendEmail} from '~/lib/email/resend';
import {resetPasswordTemplate} from '~/lib/email/templates';

const GENERIC = {ok: true, message: 'Si el correo existe, te enviamos un enlace para restablecer tu contraseña.'};

/**
 * @param {import('./+types/auth.forgot').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);
  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  if (!email) return data(GENERIC);

  const db = getDb(context.env);
  const user = await findByEmail(db, email);

  // Only act when the user exists; response is identical either way (no enumeration).
  if (user) {
    try {
      const {token} = await createToken(db, {userId: user.id, type: 'reset', ttlMs: 60 * 60 * 1000});
      const url = new URL('/auth/reset', request.url);
      url.searchParams.set('token', token);
      const tpl = resetPasswordTemplate(url.toString());
      await sendEmail(context.env, {to: user.email, subject: tpl.subject, html: tpl.html});
    } catch (err) {
      // Never leak failure to the caller; log for ops.
      console.warn(`[forgot] reset email failed for ${user.id}: ${err && err.message}`);
    }
  }
  return data(GENERIC);
}

export default function Forgot() {
  const actionData = useActionData();
  return (
    <main style={{maxWidth: 420, margin: '40px auto', padding: 16}}>
      <h1>Restablecer contraseña</h1>
      {actionData?.ok ? (
        <p>{actionData.message}</p>
      ) : (
        <Form method="post">
          <label>
            Correo
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <button type="submit">Enviar enlace</button>
        </Form>
      )}
    </main>
  );
}
```

- [ ] **Step 2: MANUAL verification (workerd-only)**

Run the dev server: `npm run dev`. Then:
1. Visit `/auth/forgot`, submit a non-existent email → page shows the generic success message; server log shows NO reset-email line (user did not exist).
2. Submit a registered email → page shows the SAME generic message; with `RESEND_API_KEY` unset, the server log shows `[email][STUB] sendEmail invoked ... subject="Restablece tu contraseña — Generando Ideas"`.
3. Confirm the two responses are byte-identical (no enumeration).
Expected: identical generic message in both cases; stub log only for the existing user.

- [ ] **Step 3: Commit**

```bash
git add app/routes/auth.forgot.jsx
git commit -m "feat(auth): forgot-password request flow (no enumeration)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Reset-password flow (`auth.reset.jsx`)

GET shows the form for a structurally-present token (the loader does NOT consume it); POST consumes the token, sets the new password, bumps session_version, and rotates the session.

**Files:**
- Create: `app/routes/auth.reset.jsx`

- [ ] **Step 1: Write the route (loader + action)**

```jsx
import {data, redirect, Form, useLoaderData, useActionData} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {verifyAndConsumeToken} from '~/lib/auth/tokens';
import {updatePassword, findById} from '~/lib/auth/users';
import {loginSession} from '~/lib/auth/session';

/**
 * @param {import('./+types/auth.reset').Route.LoaderArgs} args
 */
export async function loader({request}) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  // Do NOT consume here; just surface whether a token is present in the link.
  return data({hasToken: token.length > 0, token});
}

/**
 * @param {import('./+types/auth.reset').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);
  const form = await request.formData();
  const token = String(form.get('token') ?? '');
  const password = String(form.get('password') ?? '');
  if (password.length < 8) {
    return data({error: 'La contraseña debe tener al menos 8 caracteres.', token}, {status: 400});
  }

  const db = getDb(context.env);
  const consumed = await verifyAndConsumeToken(db, {token, type: 'reset'});
  if (!consumed) {
    return data({error: 'El enlace es inválido o expiró. Solicita uno nuevo.', token: ''}, {status: 400});
  }

  await updatePassword(db, context.env, consumed.userId, password);
  const user = await findById(db, consumed.userId);

  // Rotate the session to a fresh one, then log the user in.
  await context.session.destroy();
  loginSession(context.session, {
    userId: user.id,
    role: user.role,
    gid: user.shopifyCustomerGid,
    sessionVersion: user.sessionVersion,
  });
  return redirect('/account');
}

export default function Reset() {
  const {hasToken, token} = useLoaderData();
  const actionData = useActionData();
  if (!hasToken) {
    return (
      <main style={{maxWidth: 420, margin: '40px auto', padding: 16}}>
        <h1>Enlace inválido</h1>
        <p>Falta el token. Solicita un nuevo enlace desde <a href="/auth/forgot">Restablecer contraseña</a>.</p>
      </main>
    );
  }
  return (
    <main style={{maxWidth: 420, margin: '40px auto', padding: 16}}>
      <h1>Nueva contraseña</h1>
      {actionData?.error ? <p style={{color: 'crimson'}}>{actionData.error}</p> : null}
      <Form method="post">
        <input type="hidden" name="token" value={actionData?.token ?? token} />
        <label>
          Nueva contraseña
          <input type="password" name="password" minLength={8} required autoComplete="new-password" />
        </label>
        <button type="submit">Guardar</button>
      </Form>
    </main>
  );
}
```

- [ ] **Step 2: MANUAL verification (workerd-only)**

With `npm run dev` running:
1. From a forgot-password run with `RESEND_API_KEY` unset, copy the reset URL: temporarily add `console.log(url.toString())` to `auth.forgot.jsx` action (or read the token from Turso during local testing), visit `/auth/reset?token=<token>` → form renders.
2. Submit a password ≥ 8 chars → redirected to `/account`, logged in.
3. Reuse the SAME token at `/auth/reset?token=<token>` and submit again → "El enlace es inválido o expiró" (single-use).
4. Visit `/auth/reset` with no token → "Enlace inválido".
5. Confirm the old password no longer logs in at `/auth/login` (session_version bumped + new hash).
Expected: success on first use, rejection on reuse, old password rejected.

- [ ] **Step 3: Commit**

```bash
git add app/routes/auth.reset.jsx
git commit -m "feat(auth): reset-password flow (single-use token + session rotation)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Email-verification flow (`auth.verify.jsx`)

GET with a valid token marks `users.email_verified_at`. This is a GET link from the email; it is same-origin-safe (no state-changing form), so `assertSameOrigin` is not applied to the loader — the token itself is the capability.

**Files:**
- Create: `app/routes/auth.verify.jsx`

- [ ] **Step 1: Write the route (loader)**

```jsx
import {data, useLoaderData} from 'react-router';
import {getDb} from '~/lib/db/client';
import {verifyAndConsumeToken} from '~/lib/auth/tokens';
import {markEmailVerified} from '~/lib/auth/users';

/**
 * @param {import('./+types/auth.verify').Route.LoaderArgs} args
 */
export async function loader({request, context}) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!token) return data({ok: false});

  const db = getDb(context.env);
  const consumed = await verifyAndConsumeToken(db, {token, type: 'verify'});
  if (!consumed) return data({ok: false});

  await markEmailVerified(db, consumed.userId);
  return data({ok: true});
}

export default function Verify() {
  const {ok} = useLoaderData();
  return (
    <main style={{maxWidth: 420, margin: '40px auto', padding: 16}}>
      <h1>{ok ? 'Correo verificado' : 'Enlace inválido'}</h1>
      <p>
        {ok
          ? 'Tu correo quedó verificado. Ya puedes usar tu cuenta.'
          : 'El enlace es inválido o expiró. Inicia sesión y solicita uno nuevo.'}
      </p>
      <p>
        <a href="/account">Ir a mi cuenta</a>
      </p>
    </main>
  );
}
```

- [ ] **Step 2: MANUAL verification (workerd-only)**

With `npm run dev` running and a `verify` token created (via signup in Task 9, or insert one through Turso during local testing):
1. Visit `/auth/verify?token=<valid>` → "Correo verificado"; query Turso `SELECT email_verified_at FROM users WHERE id=...` → not null.
2. Visit `/auth/verify?token=<same>` again → "Enlace inválido" (single-use).
3. Visit `/auth/verify` with no token → "Enlace inválido".
Expected: verified on first valid use, rejected on reuse / missing token.

- [ ] **Step 3: Commit**

```bash
git add app/routes/auth.verify.jsx
git commit -m "feat(auth): email-verification flow

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Wire signup to send the verification email

Best-effort: signup still succeeds even if token creation or email send fails. We add a `sendVerificationEmail` helper (unit-tested with mocked deps), then call it from the signup action AFTER the user is created and BEFORE the redirect.

**Files:**
- Create: `app/lib/auth/verify-link.js`
- Modify: `app/routes/auth.signup.jsx`
- Test: `app/lib/auth/verify-link.test.js`

- [ ] **Step 1: Write the failing test**

```js
import {describe, it, expect, vi} from 'vitest';
import {sendVerificationEmail} from './verify-link.js';

describe('auth/verify-link', () => {
  it('creates a verify token and sends an email with the verify URL', async () => {
    const created = [];
    const fakeDb = {};
    const deps = {
      createToken: vi.fn(async () => ({token: 'tok123'})),
      sendEmail: vi.fn(async () => ({stub: true, id: null})),
    };
    const res = await sendVerificationEmail(
      fakeDb,
      {RESEND_API_KEY: undefined},
      {id: 'u1', email: 'a@b.com'},
      'https://gi.com',
      deps,
    );
    expect(res).toBe(true);
    expect(deps.createToken).toHaveBeenCalledWith(fakeDb, {userId: 'u1', type: 'verify', ttlMs: 24 * 60 * 60 * 1000});
    const msg = deps.sendEmail.mock.calls[0][1];
    expect(msg.to).toBe('a@b.com');
    expect(msg.html).toContain('https://gi.com/auth/verify?token=tok123');
  });

  it('returns false and does not throw when token creation fails', async () => {
    const deps = {
      createToken: vi.fn(async () => {
        throw new Error('db down');
      }),
      sendEmail: vi.fn(),
    };
    const res = await sendVerificationEmail({}, {}, {id: 'u1', email: 'a@b.com'}, 'https://gi.com', deps);
    expect(res).toBe(false);
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/auth/verify-link.test.js`
Expected: FAIL — cannot find module `./verify-link.js`

- [ ] **Step 3: Write minimal implementation**

```js
// Server-only. Best-effort verification email on signup. A failure here must
// NOT fail signup; returns true on success, false on any error. `deps` is
// injectable for unit tests (defaults to the real token/email modules).
import {createToken as realCreateToken} from './tokens.js';
import {sendEmail as realSendEmail} from '../email/resend.js';
import {verifyEmailTemplate} from '../email/templates.js';

/**
 * @param {import('@libsql/client/web').Client} db
 * @param {Record<string, any>} env
 * @param {{id: string, email: string}} user
 * @param {string} origin  e.g. new URL(request.url).origin
 * @param {{createToken?: Function, sendEmail?: Function}} [deps]
 * @returns {Promise<boolean>}
 */
export async function sendVerificationEmail(db, env, user, origin, deps = {}) {
  const createToken = deps.createToken ?? realCreateToken;
  const sendEmail = deps.sendEmail ?? realSendEmail;
  try {
    const {token} = await createToken(db, {userId: user.id, type: 'verify', ttlMs: 24 * 60 * 60 * 1000});
    const url = new URL('/auth/verify', origin);
    url.searchParams.set('token', token);
    const tpl = verifyEmailTemplate(url.toString());
    await sendEmail(env, {to: user.email, subject: tpl.subject, html: tpl.html});
    return true;
  } catch (err) {
    console.warn(`[signup] verification email failed for ${user.id}: ${err && err.message}`);
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/auth/verify-link.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire it into `app/routes/auth.signup.jsx`**

Add the import next to the existing `linkSignupCustomer` import:

```jsx
import {linkSignupCustomer} from '~/lib/auth/signup-link';
```

becomes

```jsx
import {linkSignupCustomer} from '~/lib/auth/signup-link';
import {sendVerificationEmail} from '~/lib/auth/verify-link';
```

Then, in the action, after this existing block:

```jsx
  // Link to Shopify (best-effort; reconciled later if it fails). Sets the
  // gid on the user row; the session snapshot reads it just below.
  const shopifyGid = await linkSignupCustomer(db, context.env, user);
  user.shopifyCustomerGid = shopifyGid;
```

insert:

```jsx
  // Send the verification email (best-effort; signup succeeds even if it fails).
  await sendVerificationEmail(db, context.env, user, new URL(request.url).origin);
```

- [ ] **Step 6: Re-run the unit test and MANUAL signup check**

Run: `npx vitest run app/lib/auth/verify-link.test.js`
Expected: PASS.

MANUAL (workerd-only): with `npm run dev` and `RESEND_API_KEY` unset, register a new account at `/registro`. The server log shows `[email][STUB] sendEmail invoked ... subject="Verifica tu correo — Generando Ideas"`, the signup completes, and you are redirected to `/account`. Then break email on purpose (temporarily set `RESEND_API_KEY` to a bad value) and confirm signup STILL succeeds (best-effort), logging `[signup] verification email failed`.

- [ ] **Step 7: Commit**

```bash
git add app/lib/auth/verify-link.js app/lib/auth/verify-link.test.js app/routes/auth.signup.jsx
git commit -m "feat(auth): send verification email on signup (best-effort)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Deployment note + full test run

**Files:**
- Create: `docs/superpowers/notes/2026-06-16-phase8-deploy.md`

- [ ] **Step 1: Write the deployment note**

```markdown
# Phase 8 deployment — email verification + password reset (Resend)

## After merging to the live environment

1. **Migrate the live DB** to create `email_tokens`:
   ```bash
   set -a; . ./.env; set +a; node scripts/migrate.mjs
   ```
   Confirm `email_tokens` appears in the printed table list. The migration is
   idempotent (`CREATE ... IF NOT EXISTS`), so it is safe to re-run.

2. **Set Oxygen secrets** (not committed):
   ```bash
   npx shopify hydrogen env push   # or set via the Shopify admin / Oxygen UI:
   #   RESEND_API_KEY = <resend key>
   #   EMAIL_FROM     = Generando Ideas <no-reply@notificaciones.generandoideas.com>
   ```
   With `RESEND_API_KEY` unset, the email client runs as a loud no-op stub and
   no mail is sent (forgot/verify still return success; ops sees `[email][STUB]`).

## Verify in production
- Trigger a password reset for a known account; confirm the email arrives and the
  reset link logs you in and invalidates the old password.
- Register a new account; confirm the verification email arrives and the link sets
  `email_verified_at`.
```

- [ ] **Step 2: Run the full email/auth test suite**

Run: `npx vitest run app/lib/email app/lib/auth app/lib/db/migrate.emailTokens.test.js`
Expected: PASS — resend (4), templates (3), tokens (6), migrate email_tokens (4), users.emailReset (2), verify-link (2).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/notes/2026-06-16-phase8-deploy.md
git commit -m "docs(phase8): deployment + secrets note for Resend email

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
