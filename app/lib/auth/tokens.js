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
