import {data, Form, useActionData} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {findByEmail} from '~/lib/auth/users';
import {createToken} from '~/lib/auth/tokens';
import {sendEmail} from '~/lib/email/resend';
import {resetPasswordTemplate} from '~/lib/email/templates';

const GENERIC = {ok: true, message: 'Si el correo existe, te enviamos un enlace para restablecer tu contraseña.'};

/**
 * @param {import('./+types/auth.forgot').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);
  const form = await request.formData();
  const email = String(form.get('email') ?? '');
  if (!email) return data(GENERIC);

  const db = getDb(context.env);
  const user = await findByEmail(db, email);

  // Only act when the user exists; response is identical either way (no enumeration).
  if (user) {
    try {
      const {token} = await createToken(db, {userId: user.id, type: 'reset', ttlMs: 60 * 60 * 1000});
      const url = new URL('/auth/reset', request.url);
      url.searchParams.set('token', token);
      const tpl = resetPasswordTemplate(url.toString());
      await sendEmail(context.env, {to: user.email, subject: tpl.subject, html: tpl.html});
    } catch (err) {
      // Never leak failure to the caller; log for ops.
      console.warn(`[forgot] reset email failed for ${user.id}: ${err && err.message}`);
    }
  }
  return data(GENERIC);
}

export default function Forgot() {
  const actionData = useActionData();
  return (
    <main style={{maxWidth: 420, margin: '40px auto', padding: 16}}>
      <h1>Restablecer contraseña</h1>
      {actionData?.ok ? (
        <p>{actionData.message}</p>
      ) : (
        <Form method="post">
          <label>
            Correo
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <button type="submit">Enviar enlace</button>
        </Form>
      )}
    </main>
  );
}
