import {Form, NavLink, Outlet, useLoaderData} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {RouteError} from '~/components/gi/RouteError';
import {requireAdvisor} from '~/lib/auth/advisor-guard';

export function shouldRevalidate() {
  return true;
}

export async function loader({context}) {
  // requireAdvisor comprueba el rol contra la base, no contra la sesión.
  const asesor = await requireAdvisor(context);
  return {
    asesor: {
      firstName: asesor.firstName,
      lastName: asesor.lastName,
      email: asesor.email,
      position: asesor.position,
    },
  };
}

const NAV = [{to: '/asesor/cotizaciones', label: 'Cotizaciones', icon: 'quote'}];

const NAV_ITEM = (isActive) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 'var(--r-md)',
  fontSize: 14,
  fontWeight: 500,
  color: isActive ? 'var(--bg-elev)' : 'var(--ink-2)',
  background: isActive ? 'var(--ink)' : 'transparent',
});

export default function AsesorLayout() {
  const {asesor} = useLoaderData();
  const initials =
    `${asesor?.firstName?.[0] ?? ''}${asesor?.lastName?.[0] ?? ''}` || 'GI';

  return (
    <div className="container acct-page" data-screen-label="Asesor">
      <aside className="acct-sidebar">
        <div className="acct-user">
          <div className="acct-avatar">{initials}</div>
          <div className="acct-user-info">
            <div className="nm">
              {asesor?.firstName
                ? `${asesor.firstName} ${asesor.lastName ?? ''}`
                : 'Ejecutivo'}
            </div>
            <div className="em">{asesor?.position || asesor?.email || ''}</div>
          </div>
        </div>
        <nav className="acct-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to}>
              {({isActive}) => (
                <span className={isActive ? 'active' : ''} style={NAV_ITEM(isActive)}>
                  <Icon name={n.icon} size={15} />
                  {n.label}
                </span>
              )}
            </NavLink>
          ))}
          <Form method="POST" action="/auth/logout">
            <button type="submit" style={{...NAV_ITEM(false), width: '100%', textAlign: 'left'}}>
              <Icon name="log_out" size={15} />
              Cerrar sesión
            </button>
          </Form>
        </nav>
      </aside>

      <div className="acct-content">
        <Outlet context={{asesor}} />
      </div>
    </div>
  );
}

/* Mismo motivo que en la cuenta: si falla la sesión o la base, el fallo no
   debe llevarse la cabecera y dejar al ejecutivo sin forma de salir. */
export function ErrorBoundary() {
  return (
    <div className="container" style={{padding: '48px 0'}}>
      <RouteError />
    </div>
  );
}
