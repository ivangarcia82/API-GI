// Server-only. Solicitudes de la campaña de mochilas: una por colaborador.
// La llave primaria en user_id hace la regla; aquí sólo se lee su resultado.

/**
 * @param {import('@libsql/client/web').Client} db
 * @param {{userId: string, email: string, line: string, model: string, color: string,
 *   variantId: string, image: string|null, foraneo: boolean, details: object}} r
 * @returns {Promise<{created: boolean}>} false si el colaborador ya tenía una
 */
export async function createMochilaRequest(db, r) {
  const res = await db.execute({
    sql: `INSERT INTO mochila_requests
            (user_id, email, line, model, color, variant_id, image, foraneo, details, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO NOTHING`,
    args: [
      r.userId,
      r.email,
      r.line,
      r.model,
      r.color,
      r.variantId,
      r.image ?? null,
      r.foraneo ? 1 : 0,
      JSON.stringify(r.details ?? {}),
      new Date().toISOString(),
    ],
  });
  return {created: res.rowsAffected > 0};
}

/**
 * @param {import('@libsql/client/web').Client} db
 * @param {string} userId
 */
export async function findMochilaRequest(db, userId) {
  const res = await db.execute({
    sql: `SELECT line, model, color, image, foraneo, created_at
            FROM mochila_requests WHERE user_id = ?`,
    args: [userId],
  });
  const row = res.rows[0];
  if (!row) return null;
  return {
    line: row.line,
    model: row.model,
    color: row.color,
    image: row.image ?? null,
    foraneo: Number(row.foraneo) === 1,
    createdAt: row.created_at,
  };
}

/**
 * Libera al colaborador: se usa cuando el correo no salió, para que reintente.
 * @param {import('@libsql/client/web').Client} db
 * @param {string} userId
 */
export async function deleteMochilaRequest(db, userId) {
  await db.execute({sql: 'DELETE FROM mochila_requests WHERE user_id = ?', args: [userId]});
}
