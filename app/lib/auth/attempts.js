// Server-only. Contador de intentos fallidos, compartido por /auth/login y por
// el cambio de contraseña en /account/profile. El filtro es `email OR ip`: es la
// misma credencial en ambos flujos, así que fallar en uno también frena el otro.

export const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
export const MAX_ATTEMPTS = 8; // por email O por IP dentro de la ventana

export function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
    'unknown'
  );
}

export async function recentFailures(db, email, ip) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const res = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM login_attempts
          WHERE success = 0 AND created_at >= ? AND (email = ? OR ip = ?)`,
    args: [since, email, ip],
  });
  return Number(res.rows[0]?.n ?? 0);
}

export async function recordAttempt(db, email, ip, success) {
  await db.execute({
    sql: `INSERT INTO login_attempts (id, email, ip, success, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), email, ip, success ? 1 : 0, new Date().toISOString()],
  });
}
