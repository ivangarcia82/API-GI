import {redirect, data} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {createUser, EmailTakenError} from '~/lib/auth/users';
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
  const phone = String(form.get('phone') ?? '') || null;
  const volume = String(form.get('volume') ?? '') || null;
  const needs = String(form.get('needs') ?? '') || null;

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
      phone,
      volume,
      needs,
      role: 'quoter',
    });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      return data({error: 'Ese correo ya está registrado.'}, {status: 409});
    }
    throw err;
  }

  // Link to Shopify (best-effort; reconciled later if it fails).
  const shopifyGid = await linkSignupCustomer(db, context.env, user);
  user.shopifyCustomerGid = shopifyGid;

  // Send the verification email (best-effort; signup succeeds even if it fails).
  await sendVerificationEmail(db, context.env, user, new URL(request.url).origin);

  // Account access requires a verified email — do NOT create a session here.
  // The user verifies via the emailed link (which logs them in), then can sign in.
  return redirect('/login?registrado=1');
}
