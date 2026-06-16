import {redirect, data} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {createUser, EmailTakenError} from '~/lib/auth/users';
import {loginSession} from '~/lib/auth/session';
import {linkSignupCustomer} from '~/lib/auth/signup-link';
import {sendVerificationEmail} from '~/lib/auth/verify-link';

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

  // Link to Shopify (best-effort; reconciled later if it fails). Sets the
  // gid on the user row; the session snapshot reads it just below.
  const shopifyGid = await linkSignupCustomer(db, context.env, user);
  user.shopifyCustomerGid = shopifyGid;

  // Send the verification email (best-effort; signup succeeds even if it fails).
  await sendVerificationEmail(db, context.env, user, new URL(request.url).origin);

  // Rotate to a brand-new session before setting identity (anti-fixation).
  await context.session.destroy();
  loginSession(context.session, {
    userId: user.id,
    role: user.role,
    gid: user.shopifyCustomerGid,
    sessionVersion: user.sessionVersion,
  });

  // server.js (isPending) attaches Set-Cookie to the redirect response.
  return redirect('/account');
}
