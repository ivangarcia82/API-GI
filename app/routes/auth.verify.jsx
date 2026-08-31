import {data, redirect, Form, useActionData, useLoaderData, useNavigation} from 'react-router';
import {Button} from '~/components/gi/ui';
import {assertSameOrigin} from '~/lib/http/csrf';
import {getDb} from '~/lib/db/client';
import {verifyAndConsumeToken} from '~/lib/auth/tokens';
import {markEmailVerified, findById} from '~/lib/auth/users';
import {loginSession} from '~/lib/auth/session';
import {notifyAdvisorOfSignup} from '~/lib/auth/signup-notify';

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
    // Avisar al asesor asignado. El token es de un solo uso, así que esto corre
    // exactamente una vez por cuenta. Se va por waitUntil para que el redirect
    // no espere al Admin API ni a Resend; si el runtime no lo ofrece, se espera.
    // La cuenta ya quedó verificada: ningún fallo aquí puede tumbar el alta.
    const avisando = Promise.resolve()
      .then(() => notifyAdvisorOfSignup(context.env, {user}))
      .catch((err) => {
        console.error('[verify] advisor notification failed:', err);
      });
    if (typeof context.waitUntil === 'function') context.waitUntil(avisando);
    else await avisando;

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

const wrapStyle = {
  maxWidth: 480,
  margin: '80px auto 120px',
  padding: '0 20px',
  textAlign: 'center',
};

const titleStyle = {
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 'clamp(32px, 5vw, 44px)',
  letterSpacing: '-0.02em',
  margin: '12px 0 16px',
};

const bodyStyle = {color: 'var(--ink-3)', fontSize: 16, lineHeight: 1.6, margin: '0 0 28px'};

export default function Verify() {
  const {hasToken, token} = useLoaderData();
  const actionData = useActionData();
  const nav = useNavigation();
  const busy = nav.state !== 'idle';
  const failed = actionData?.ok === false;

  if (!hasToken || failed) {
    return (
      <main style={wrapStyle} data-screen-label="Auth Verify">
        <div className="eyebrow">// Verificación</div>
        <h1 style={titleStyle}>Este enlace ya no es válido.</h1>
        <p style={bodyStyle}>
          El enlace de verificación expiró o ya fue usado. Inicia sesión con tu
          correo y contraseña para solicitar uno nuevo.
        </p>
        <Button as="a" href="/login" variant="accent" size="lg" iconRight="arrow_right" style={{color: '#fff'}}>
          Ir a iniciar sesión
        </Button>
      </main>
    );
  }

  return (
    <main style={wrapStyle} data-screen-label="Auth Verify">
      <div className="eyebrow">// Verificación · último paso</div>
      <h1 style={titleStyle}>Confirma tu correo.</h1>
      <p style={bodyStyle}>
        Al confirmar, tu cuenta queda verificada y entras directo a tu panel —
        sin volver a iniciar sesión.
      </p>
      <Form method="post">
        <input type="hidden" name="token" value={token} />
        <Button
          type="submit"
          variant="accent"
          size="lg"
          iconRight="check"
          disabled={busy}
          style={{color: '#fff', minWidth: 280, justifyContent: 'center'}}
        >
          {busy ? 'Verificando…' : 'Confirmar y entrar a mi cuenta'}
        </Button>
      </Form>
    </main>
  );
}
