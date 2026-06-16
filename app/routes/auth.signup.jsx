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
