/* Generando Ideas — site header */
import {Suspense, useState} from 'react';
import {Await, NavLink, useNavigate} from 'react-router';
import {Icon} from './Icon';
import {Button} from './ui';
import {useApp} from '~/lib/AppContext';

const NAV = [
  {to: '/catalogo', label: 'Catálogo'},
  {to: '/collections', label: 'Colecciones'},
  {to: '/lookbook', label: 'Lookbook'},
  {to: '/servicios', label: 'Servicios'},
  {to: '/nosotros', label: 'Nosotros'},
];

function Logo() {
  return (
    <img
      className="brand-logo"
      src="/brand/gi-logo-horizontal.svg"
      alt="Generando Ideas"
      width={160}
      height={34}
    />
  );
}

function CartBadge({cart}) {
  return (
    <Suspense fallback={null}>
      <Await resolve={cart}>
        {(resolved) => {
          const count = resolved?.totalQuantity || 0;
          return count > 0 ? <span className="appbar-badge">{count}</span> : null;
        }}
      </Await>
    </Suspense>
  );
}

export function GiHeader({cart, isLoggedIn}) {
  const navigate = useNavigate();
  const {canBuy, quoteCount} = useApp();
  const [mobile, setMobile] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  return (
    <>
      <header className="appbar" data-screen-label="App Header">
        <div className="appbar-inner">
          <NavLink to="/" className="appbar-brand" prefetch="intent" aria-label="Generando Ideas — inicio">
            <Logo />
          </NavLink>

          <nav className="appbar-nav">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} prefetch="intent">
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="appbar-actions">
            <button
              className="appbar-iconbtn"
              aria-label="Buscar"
              onClick={() => navigate('/search')}
            >
              <Icon name="search" size={18} />
            </button>

            {canBuy && (
              <button
                className="appbar-iconbtn"
                aria-label="Carrito"
                onClick={() => navigate('/cart')}
              >
                <Icon name="cart" size={18} />
                <CartBadge cart={cart} />
              </button>
            )}

            <button
              className="appbar-iconbtn"
              aria-label="Cotización"
              onClick={() => navigate('/cotizacion')}
            >
              <Icon name="quote" size={18} />
              {quoteCount > 0 && <span className="appbar-badge">{quoteCount}</span>}
            </button>

            {!isLoggedIn ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/login')}
                >
                  Iniciar sesión
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  iconRight="arrow_right"
                  onClick={() => navigate('/registro')}
                >
                  Crear cuenta
                </Button>
              </>
            ) : (
              <div style={{position: 'relative'}}>
                <button
                  onClick={() => setUserMenu((m) => !m)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px 6px 6px',
                    borderRadius: 999,
                    border: '1px solid var(--line)',
                    background: 'var(--bg-elev)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <div
                    className="acct-avatar"
                    style={{width: 28, height: 28, fontSize: 11}}
                  >
                    GI
                  </div>
                  <Icon name="chevron_down" size={14} />
                </button>
                {userMenu && (
                  <div
                    onClick={() => setUserMenu(false)}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      background: 'var(--bg-elev)',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      boxShadow: 'var(--shadow-2)',
                      minWidth: 220,
                      padding: 8,
                      zIndex: 100,
                    }}
                  >
                    {[
                      {label: 'Mi cuenta', to: '/account', icon: 'user'},
                      {label: 'Mis órdenes', to: '/account/orders', icon: 'receipt'},
                      {label: 'Cotizaciones', to: '/cotizacion', icon: 'quote'},
                      {label: 'Favoritos', to: '/account/favoritos', icon: 'heart_outline'},
                    ].map((m) => (
                      <button
                        key={m.to}
                        onClick={() => navigate(m.to)}
                        style={menuItemStyle}
                      >
                        <Icon name={m.icon} size={15} />
                        {m.label}
                      </button>
                    ))}
                    <div
                      style={{
                        borderTop: '1px solid var(--line)',
                        marginTop: 4,
                        paddingTop: 4,
                      }}
                    >
                      <button
                        onClick={() => navigate('/account/logout')}
                        style={{...menuItemStyle, color: 'var(--ink-3)'}}
                      >
                        <Icon name="log_out" size={15} />
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              className="appbar-iconbtn appbar-burger"
              onClick={() => setMobile((m) => !m)}
              aria-label="Menú"
            >
              <Icon name={mobile ? 'x' : 'menu'} size={18} />
            </button>
          </div>
        </div>
      </header>

      {mobile && (
        <div
          className="mobile-menu"
          onClick={(e) => {
            if (e.target.tagName === 'A') setMobile(false);
          }}
        >
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} onClick={() => setMobile(false)}>
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/cotizacion" onClick={() => setMobile(false)}>
            Mi cotización
          </NavLink>
          {canBuy && (
            <NavLink to="/cart" onClick={() => setMobile(false)}>
              Mi carrito
            </NavLink>
          )}
          {isLoggedIn && (
            <NavLink to="/account" onClick={() => setMobile(false)}>
              Mi cuenta
            </NavLink>
          )}
        </div>
      )}
    </>
  );
}

const menuItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--ink-2)',
  textAlign: 'left',
};
