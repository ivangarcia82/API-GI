import {Form, useActionData, useNavigation, useLoaderData} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';

export {action} from './auth.login.jsx';

import {safeRedirectTo} from '~/lib/auth/redirect-to';

export const meta = () => [{title: 'Iniciar sesión · Generando Ideas'}];

/** @param {{request: Request}} args */
export function loader({request}) {
  const url = new URL(request.url);
  return {
    registrado: url.searchParams.get('registrado') === '1',
    // A dónde volver al entrar. Se acota aquí y el `action` lo vuelve a acotar:
    // el campo oculto es tan manipulable como la URL.
    redirectTo: safeRedirectTo(url.searchParams.get('redirectTo')),
  };
}

export default function Login() {
  const actionData = useActionData();
  const {registrado, redirectTo} = useLoaderData();
  const nav = useNavigation();
  const busy = nav.state !== 'idle';

  return (
    <div className="auth-wrap" data-screen-label="02 Login">
      <div className="auth-form-col">
        <div className="eyebrow">// Acceso · /login</div>
        <h1>Inicia sesión.</h1>
        <p>Accede a tu lista de cotización y al historial de cotizaciones.</p>

        {registrado && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'start',
              padding: 14,
              marginBottom: 16,
              background: 'var(--accent-soft, var(--bg-soft))',
              borderRadius: 12,
              fontSize: 13,
              color: 'var(--ink-2)',
            }}
            role="status"
          >
            <Icon name="check" size={16} className="muted" />
            <span>
              <strong style={{color: 'var(--ink)'}}>Cuenta creada.</strong> Te enviamos un
              correo para verificar tu cuenta. Ábrelo y haz clic en el enlace para activarla.
            </span>
          </div>
        )}

        <Form className="auth-form" method="post">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="field">
            <label htmlFor="login-email">Correo corporativo</label>
            <input
              id="login-email"
              className="input"
              type="email"
              name="email"
              required
              placeholder="mariana@empresa.mx"
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              className="input"
              type="password"
              name="password"
              required
              placeholder="••••••••"
            />
            <a
              href="/auth/forgot"
              style={{
                alignSelf: 'flex-end',
                marginTop: 6,
                fontSize: 13,
                color: 'var(--ink-3)',
                textDecoration: 'underline',
              }}
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          {actionData?.error && (
            <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
              {actionData.error}
            </span>
          )}

          <Button
            type="submit"
            variant="accent"
            size="lg"
            iconRight="arrow_right"
            disabled={busy}
            style={{width: '100%', justifyContent: 'center', marginTop: 8, color: '#fff'}}
          >
            {busy ? 'Entrando…' : 'Iniciar sesión'}
          </Button>
        </Form>

        <div
          style={{
            marginTop: 32,
            padding: 16,
            background: 'var(--bg-soft)',
            borderRadius: 12,
            fontSize: 13,
            color: 'var(--ink-3)',
            display: 'flex',
            gap: 12,
            alignItems: 'start',
          }}
        >
          <Icon name="bolt" size={16} className="muted" />
          <span>
            <strong style={{color: 'var(--ink)'}}>¿No tienes cuenta?</strong>{' '}
            <a
              href={
                redirectTo && redirectTo !== '/account'
                  ? `/registro?redirectTo=${encodeURIComponent(redirectTo)}`
                  : '/registro'
              }
              style={{color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline'}}>
              Regístrate aquí
            </a>{' '}
            · Aprobación en menos de 24 horas hábiles.
          </span>
        </div>
      </div>

      <aside className="auth-side">
        <div style={{position: 'relative'}}>
          <div className="eyebrow" style={{color: 'var(--accent)'}}>
            // Acceso autorizado
          </div>
          <h2>Accede a información <em>exclusiva</em>.</h2>
        </div>
        <div className="auth-perks">
          {[
            'Precios netos por proyecto',
            'Lista de cotización ilimitada',
            'Historial completo de cotizaciones',
            'Re-cotizaciones con un solo clic',
          ].map((p) => (
            <div key={p} className="p">
              <Icon name="check" size={16} />
              {p}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
