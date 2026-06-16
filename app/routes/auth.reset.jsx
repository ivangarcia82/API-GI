import {data, redirect, Form, useLoaderData, useActionData} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {verifyAndConsumeToken} from '~/lib/auth/tokens';
import {updatePassword, findById} from '~/lib/auth/users';
import {loginSession} from '~/lib/auth/session';

/**
 * @param {import('./+types/auth.reset').Route.LoaderArgs} args
 */
export async function loader({request}) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  // Do NOT consume here; just surface whether a token is present in the link.
  return data({hasToken: token.length > 0, token});
}

/**
 * @param {import('./+types/auth.reset').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);
  const form = await request.formData();
  const token = String(form.get('token') ?? '');
  const password = String(form.get('password') ?? '');
  if (password.length < 8) {
    return data({error: 'La contraseña debe tener al menos 8 caracteres.', token}, {status: 400});
  }

  const db = getDb(context.env);
  const consumed = await verifyAndConsumeToken(db, {token, type: 'reset'});
  if (!consumed) {
    return data({error: 'El enlace es inválido o expiró. Solicita uno nuevo.', token: ''}, {status: 400});
  }

  await updatePassword(db, context.env, consumed.userId, password);
  const user = await findById(db, consumed.userId);

  // Rotate the session to a fresh one, then log the user in.
  await context.session.destroy();
  loginSession(context.session, {
    userId: user.id,
    role: user.role,
    gid: user.shopifyCustomerGid,
    sessionVersion: user.sessionVersion,
  });
  return redirect('/account');
}

export default function Reset() {
  const {hasToken, token} = useLoaderData();
  const actionData = useActionData();
  if (!hasToken) {
    return (
      <main style={{maxWidth: 420, margin: '40px auto', padding: 16}}>
        <h1>Enlace inválido</h1>
        <p>Falta el token. Solicita un nuevo enlace desde <a href="/auth/forgot">Restablecer contraseña</a>.</p>
      </main>
    );
  }
  return (
    <main style={{maxWidth: 420, margin: '40px auto', padding: 16}}>
      <h1>Nueva contraseña</h1>
      {actionData?.error ? <p style={{color: 'crimson'}}>{actionData.error}</p> : null}
      <Form method="post">
        <input type="hidden" name="token" value={actionData?.token ?? token} />
        <label>
          Nueva contraseña
          <input type="password" name="password" minLength={8} required autoComplete="new-password" />
        </label>
        <button type="submit">Guardar</button>
      </Form>
    </main>
  );
}
