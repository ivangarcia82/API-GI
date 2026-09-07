import {redirect, data} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {findByEmail, normalizeEmail, getPasswordRecord} from '~/lib/auth/users';
import {verifyPassword, hashPassword} from '~/lib/auth/password';
import {loginSession} from '~/lib/auth/session';
import {clientIp, recentFailures, recordAttempt, MAX_ATTEMPTS} from '~/lib/auth/attempts';
import {sendVerificationEmail} from '~/lib/auth/verify-link';
import {safeRedirectTo} from '~/lib/auth/redirect-to';

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
    const rec = await getPasswordRecord(db, user.id);
    ok = await verifyPassword(
      password,
      rec ?? {hash: '', salt: '', iterations: 100000},
      context.env,
    );
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

  // De vuelta a donde venía. `safeRedirectTo` acota el destino a rutas
  // internas: sin eso, /login?redirectTo=https://sitio-falso/ usaría nuestro
  // login de trampolín para un phishing.
  return redirect(safeRedirectTo(form.get('redirectTo')));
}
