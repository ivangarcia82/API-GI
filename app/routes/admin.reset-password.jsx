import {data} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {findByEmail, bumpSessionVersion, normalizeEmail} from '~/lib/auth/users';
import {hashPassword} from '~/lib/auth/password';

// Constant-time string compare (no early return on length mismatch).
function constantTimeStringEqual(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(String(a));
  const bb = enc.encode(String(b));
  let diff = ab.length ^ bb.length;
  const max = Math.max(ab.length, bb.length);
  for (let i = 0; i < max; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

/**
 * @param {import('./+types/admin.reset-password').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);

  const expected = context.env.ADMIN_RESET_SECRET;
  const provided = request.headers.get('X-Admin-Reset-Secret') ?? '';
  // Default-deny: if the env secret is unset, never authorize.
  if (!expected || !constantTimeStringEqual(provided, expected)) {
    return data({error: 'Forbidden'}, {status: 403});
  }

  const form = await request.formData();
  const email = normalizeEmail(form.get('email') ?? '');
  if (!email) {
    return data({error: 'email is required'}, {status: 400});
  }

  const db = getDb(context.env);
  const user = await findByEmail(db, email);
  if (!user) {
    // Do not reveal whether the email exists.
    return data({ok: true}, {status: 200});
  }

  // Generate a temporary password (URL-safe random), hash it, store it.
  const temp = crypto.randomUUID();
  const rec = await hashPassword(temp, context.env);
  await db.execute({
    sql: `UPDATE users
          SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ?
          WHERE id = ?`,
    args: [rec.hash, rec.salt, rec.iterations, new Date().toISOString(), user.id],
  });

  // Invalidate every existing session for this user.
  await bumpSessionVersion(db, user.id);

  // Return the temp password ONCE so the operator can relay it out-of-band.
  return data({ok: true, tempPassword: temp}, {status: 200});
}

// POST-only: a GET must not act.
export async function loader() {
  throw new Response('Not Found', {status: 404});
}
