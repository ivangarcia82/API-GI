import {
  data as remixData,
  Form,
  NavLink,
  Outlet,
  useLoaderData,
} from 'react-router';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {Icon} from '~/components/gi/Icon';

export function shouldRevalidate() {
  return true;
}

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const {customerAccount} = context;
  const {data, errors} = await customerAccount.query(CUSTOMER_DETAILS_QUERY, {
    variables: {
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.customer) {
    throw new Error('Customer not found');
  }

  return remixData(
    {customer: data.customer},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

const NAV = [
  {to: '/account', label: 'Resumen', icon: 'user', end: true},
  {to: '/account/orders', label: 'Mis órdenes', icon: 'receipt'},
  {to: '/cotizacion', label: 'Cotizaciones', icon: 'quote'},
  {to: '/account/favoritos', label: 'Favoritos', icon: 'heart_outline'},
  {to: '/account/profile', label: 'Mi perfil', icon: 'settings'},
  {to: '/account/addresses', label: 'Direcciones', icon: 'truck'},
];

export default function AccountLayout() {
  /** @type {LoaderReturnData} */
  const {customer} = useLoaderData();
  const initials = `${customer?.firstName?.[0] ?? ''}${customer?.lastName?.[0] ?? ''}` || 'GI';

  return (
    <div className="container acct-page" data-screen-label="09 Account">
      <aside className="acct-sidebar">
        <div className="acct-user">
          <div className="acct-avatar">{initials}</div>
          <div className="acct-user-info">
            <div className="nm">
              {customer?.firstName
                ? `${customer.firstName} ${customer.lastName ?? ''}`
                : 'Mi cuenta'}
            </div>
            <div className="em">{customer?.emailAddress?.emailAddress || ''}</div>
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
          <Form method="POST" action="/account/logout">
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
        <Outlet context={{customer}} />
      </div>
    </div>
  );
}

/** @typedef {import('./+types/account').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
