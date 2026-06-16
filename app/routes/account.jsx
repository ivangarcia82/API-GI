import {data as remixData, Form, NavLink, Outlet, redirect, useLoaderData} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {findById} from '~/lib/auth/users';

export function shouldRevalidate() {
  return true;
}

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const {userId} = await requireUser(context);
  const db = getDb(context.env);
  const user = await findById(db, userId);
  if (!user) {
    // Snapshot is stale (user deleted); force re-auth.
    throw redirect('/login');
  }

  return remixData(
    {user},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

// Addresses and Orders are deferred per spec §5.4 — their nav links are removed.
const NAV = [
  {to: '/account', label: 'Resumen', icon: 'user', end: true},
  {to: '/account/cotizaciones', label: 'Cotizaciones', icon: 'quote'},
  {to: '/account/favoritos', label: 'Favoritos', icon: 'heart_outline'},
  {to: '/account/profile', label: 'Mi perfil', icon: 'settings'},
];

export default function AccountLayout() {
  /** @type {LoaderReturnData} */
  const {user} = useLoaderData();
  const initials =
    `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}` || 'GI';

  return (
    <div className="container acct-page" data-screen-label="09 Account">
      <aside className="acct-sidebar">
        <div className="acct-user">
          <div className="acct-avatar">{initials}</div>
          <div className="acct-user-info">
            <div className="nm">
              {user?.firstName
                ? `${user.firstName} ${user.lastName ?? ''}`
                : 'Mi cuenta'}
            </div>
            <div className="em">{user?.email || ''}</div>
          </div>
        </div>
        <nav className="acct-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {({isActive}) => (
                <span
                  className={isActive ? 'active' : ''}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--r-md)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: isActive ? 'var(--bg-elev)' : 'var(--ink-2)',
                    background: isActive ? 'var(--ink)' : 'transparent',
                  }}
                >
                  <Icon name={n.icon} size={15} />
                  {n.label}
                </span>
              )}
            </NavLink>
          ))}
          <Form method="POST" action="/auth/logout">
            <button
              type="submit"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--r-md)',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--ink-3)',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <Icon name="log_out" size={15} />
              Cerrar sesión
            </button>
          </Form>
        </nav>
      </aside>

      <div className="acct-content">
        <Outlet context={{user}} />
      </div>
    </div>
  );
}

/** @typedef {import('./+types/account').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
