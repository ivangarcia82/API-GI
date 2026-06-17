import {data, redirect, useLoaderData} from 'react-router';
import {getDb} from '~/lib/db/client';
import {verifyAndConsumeToken} from '~/lib/auth/tokens';
import {markEmailVerified, findById} from '~/lib/auth/users';
import {loginSession} from '~/lib/auth/session';

/**
 * @param {import('./+types/auth.verify').Route.LoaderArgs} args
 */
export async function loader({request, context}) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!token) return data({ok: false});

  const db = getDb(context.env);
  const consumed = await verifyAndConsumeToken(db, {token, type: 'verify'});
  if (!consumed) return data({ok: false});

  await markEmailVerified(db, consumed.userId);

  // Verifying the email proves inbox ownership — log the user straight in so
  // clicking the link lands them in their account (Set-Cookie rides the redirect).
  const user = await findById(db, consumed.userId);
  if (user) {
    await context.session.destroy();
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
  const {ok} = useLoaderData();
  return (
    <main style={{maxWidth: 420, margin: '40px auto', padding: 16}}>
      <h1>{ok ? 'Correo verificado' : 'Enlace inválido'}</h1>
      <p>
        {ok
          ? 'Tu correo quedó verificado. Ya puedes usar tu cuenta.'
          : 'El enlace es inválido o expiró. Inicia sesión y solicita uno nuevo.'}
      </p>
      <p>
        <a href="/account">Ir a mi cuenta</a>
      </p>
    </main>
  );
}
