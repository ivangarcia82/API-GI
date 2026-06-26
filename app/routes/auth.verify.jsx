import {data, redirect, Form, useActionData, useLoaderData} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {verifyAndConsumeToken} from '~/lib/auth/tokens';
import {markEmailVerified, findById} from '~/lib/auth/users';
import {loginSession} from '~/lib/auth/session';

export const meta = () => [{title: 'Verificar correo · Generando Ideas'}];

/**
 * GET only reports whether a token is present — it never CONSUMES it. This stops
 * email scanners / link prefetchers from burning the single-use token before the
 * user actually clicks the confirm button.
 * @param {import('./+types/auth.verify').Route.LoaderArgs} args
 */
export function loader({request}) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  return data({hasToken: token.length > 0, token});
}

/**
 * @param {import('./+types/auth.verify').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);
  const form = await request.formData();
  const token = String(form.get('token') ?? '');
  if (!token) return data({ok: false}, {status: 400});

  const db = getDb(context.env);
  const consumed = await verifyAndConsumeToken(db, {token, type: 'verify'});
  if (!consumed) return data({ok: false}, {status: 400});

  await markEmailVerified(db, consumed.userId);

  // Verifying the email proves inbox ownership — log the user straight in so
  // confirming lands them in their account (Set-Cookie rides the redirect).
  const user = await findById(db, consumed.userId);
  if (user) {
    loginSession(context.session, {
      userId: user.id,
      role: user.role,
      gid: user.shopifyCustomerGid,
      sessionVersion: user.sessionVersion,
    });
    return redirect('/account');
  }
  return data({ok: true});
}

export default function Verify() {
  const {hasToken, token} = useLoaderData();
  const actionData = useActionData();
  const failed = actionData?.ok === false;

  if (!hasToken || failed) {
    return (
      <main style={{maxWidth: 420, margin: '40px auto', padding: 16}}>
        <h1>Enlace inválido</h1>
        <p>El enlace es inválido o expiró. Inicia sesión y solicita uno nuevo.</p>
        <p>
          <a href="/login">Ir a iniciar sesión</a>
        </p>
      </main>
    );
  }

  return (
    <main style={{maxWidth: 420, margin: '40px auto', padding: 16}}>
      <h1>Confirma tu correo</h1>
      <p>Haz clic para verificar tu cuenta y entrar.</p>
      <Form method="post">
        <input type="hidden" name="token" value={token} />
        <button type="submit">Confirmar mi correo</button>
      </Form>
    </main>
  );
}
