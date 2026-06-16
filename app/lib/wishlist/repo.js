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
