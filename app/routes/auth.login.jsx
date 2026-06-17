import {redirect, data} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {findByEmail, normalizeEmail} from '~/lib/auth/users';
import {verifyPassword, hashPassword} from '~/lib/auth/password';
import {loginSession} from '~/lib/auth/session';
import {sendVerificationEmail} from '~/lib/auth/verify-link';

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
    // No user: run an equivalent PBKDF2 (pepper + derive, 100k) so the response
    // timing matches the user-exists path. Defeats account enumeration via latency.
    // (The previous dummy rec had an empty hash, which verifyPassword short-circuits
    // before doing any crypto — leaking that the account doesn't exist.)
    await hashPassword(password, context.env);
  }

  if (!user || !ok) {
    await recordAttempt(db, email, ip, false);
    return genericFail();
  }

  await recordAttempt(db, email, ip, true);

  // Gate access on a verified email. Credentials are valid, but until the email
  // is confirmed the account stays locked — re-send the link and block sign-in.
  if (!user.emailVerifiedAt) {
    await sendVerificationEmail(db, context.env, user, new URL(request.url).origin);
    return data(
      {
        error:
          'Tu cuenta aún no está verificada. Te reenviamos el enlace de verificación a tu correo.',
        needsVerification: true,
      },
      {status: 403},
    );
  }

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
