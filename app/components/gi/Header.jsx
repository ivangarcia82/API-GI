/* Generando Ideas — site header */
import {useState} from 'react';
import {NavLink, useNavigate, useSubmit} from 'react-router';
import {Icon} from './Icon';
import {Button} from './ui';
import {SocialIcons} from '~/components/marketing/SocialIcons';
import {useApp} from '~/lib/AppContext';
import {CatalogTrigger, CatalogPanel, MobileCatalogMenu, useCatalogMenu} from './CatalogMenu';

const NAV = [
  {to: '/', label: 'Inicio'},
  {to: '/conocenos', label: 'Conócenos'},
  {to: '/servicios', label: 'Servicios'},
  {to: '/catalogo', label: 'Catálogo'},
  {to: '/blog', label: 'Blog'},
  {to: '/contacto', label: 'Contacto'},
];

function Logo() {
  return (
    <img
      className="brand-logo"
      src="/brand/gi-logo-horizontal.svg"
      alt="Generando Ideas"
      width={200}
      height={42}
    />
  );
}

export function GiHeader({isLoggedIn}) {
  const navigate = useNavigate();
  const submit = useSubmit();
  const {quoteCount, openQuoteDrawer, openSearch} = useApp();
  const [mobile, setMobile] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const catalogMenu = useCatalogMenu();

  return (
    <>
      <header className="appbar" data-screen-label="App Header">
        <div className="appbar-inner">
          <NavLink to="/" className="appbar-brand" prefetch="intent" aria-label="Generando Ideas — inicio">
            <Logo />
          </NavLink>

          <nav className="appbar-nav" aria-label="Principal">
            {NAV.map((n) =>
              n.to === '/catalogo' ? (
                <CatalogTrigger key={n.to} menu={catalogMenu} />
              ) : (
                <NavLink key={n.to} to={n.to} prefetch="intent" end={n.to === '/'}>
                  {n.label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="appbar-actions">
            <div className="gi-mkt gi-mkt-header-icons">
              <SocialIcons variant="nav" />
            </div>

            <button
              className="appbar-iconbtn"
              aria-label="Buscar"
              aria-keyshortcuts="Meta+K Control+K"
              title="Buscar (⌘K)"
              onClick={openSearch}
            >
              <Icon name="search" size={18} />
            </button>

            <button
              className="appbar-iconbtn"
              aria-label={
                quoteCount > 0
                  ? `Cotización · ${quoteCount} ${quoteCount === 1 ? 'pieza' : 'piezas'}`
                  : 'Cotización'
              }
              onClick={openQuoteDrawer}
            >
              <Icon name="quote" size={18} />
              {quoteCount > 0 && (
                <span className="appbar-badge" aria-hidden="true">
                  {quoteCount}
                </span>
              )}
            </button>

            {!isLoggedIn ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="appbar-auth"
                  onClick={() => navigate('/login')}
                >
                  Iniciar sesión
                </Button>
                <Button
                  variant="accent"
                  size="sm"
                  className="appbar-auth"
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
                    role="menu"
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
                      {label: 'Cotizaciones', to: '/account/cotizaciones', icon: 'quote'},
                      {label: 'Favoritos', to: '/account/favoritos', icon: 'heart_outline'},
                    ].map((m) => (
                      <button
                        key={m.to}
                        role="menuitem"
                        onClick={() => {
                          setUserMenu(false);
                          navigate(m.to);
                        }}
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
                      {/*
                        Envío programático, no un <Form> con type="submit".
                        Cerrar el menú desmonta este subárbol (`userMenu &&`
                        arriba), y React 18 vacía ese setState de forma síncrona
                        al terminar el clic — antes de que el navegador despache
                        el `submit`. El form quedaba desconectado y el navegador
                        cancelaba el envío ("Form submission canceled because
                        the form is not connected"): la petición nunca salía.
                        `submit()` no depende del ciclo de vida del DOM, igual
                        que el `navigate()` de los demás ítems de este menú.
                      */}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserMenu(false);
                          submit(null, {
                            method: 'post',
                            action: '/auth/logout',
                          });
                        }}
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
        <CatalogPanel menu={catalogMenu} />
      </header>

      {mobile && (
        <nav className="mobile-menu" aria-label="Menú móvil">
          {NAV.map((n) =>
            n.to === '/catalogo' ? (
              <MobileCatalogMenu key={n.to} onNavigate={() => setMobile(false)} />
            ) : (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                onClick={() => setMobile(false)}
              >
                {n.label}
              </NavLink>
            ),
          )}
          <button
            type="button"
            className="mobile-menu-link"
            onClick={() => {
              setMobile(false);
              openQuoteDrawer();
            }}
          >
            Mi cotización
          </button>
          {isLoggedIn && (
            <NavLink to="/account" onClick={() => setMobile(false)}>
              Mi cuenta
            </NavLink>
          )}
          {!isLoggedIn && (
            <div className="mobile-menu-auth">
              <Button
                variant="accent"
                size="lg"
                iconRight="arrow_right"
                onClick={() => {
                  setMobile(false);
                  navigate('/registro');
                }}
              >
                Crear cuenta
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  setMobile(false);
                  navigate('/login');
                }}
              >
                Iniciar sesión
              </Button>
            </div>
          )}
          <div className="gi-mkt mobile-menu-social">
            <SocialIcons variant="nav" />
          </div>
        </nav>
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
