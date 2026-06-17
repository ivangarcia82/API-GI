/* Generando Ideas — site footer */
import {NavLink} from 'react-router';

function Logo() {
  return (
    <img
      className="footer-logo"
      src="/brand/gi-logo-horizontal.svg"
      alt="Generando Ideas"
      width={180}
      height={38}
    />
  );
}

export function GiFooter() {
  return (
    <footer className="footer" data-screen-label="Footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div style={{marginBottom: 20}}>
              <Logo />
            </div>
            <p className="brand-slogan" style={{marginBottom: 20}}>
              Your one<br />stop<br />solution<span className="accent">.</span>
            </p>
            <p style={{color: 'var(--ink-3)', maxWidth: 320, fontSize: 14, lineHeight: 1.55}}>
              Empresa 100% mexicana líder en la industria promocional desde 2013.
              Producción, fulfillment y proyectos especiales.
            </p>
            <div style={{display: 'flex', gap: 8, marginTop: 20}}>
              {[
                {s: 'LI', label: 'LinkedIn', href: 'https://www.linkedin.com/company/generandoideas'},
                {s: 'IG', label: 'Instagram', href: 'https://www.instagram.com/generandoideas'},
                {s: 'FB', label: 'Facebook', href: 'https://www.facebook.com/generandoideas'},
              ].map((it) => (
                <a
                  key={it.s}
                  href={it.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={it.label}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid var(--line)',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--ink-3)',
                    textDecoration: 'none',
                  }}
                >
                  {it.s}
                </a>
              ))}
            </div>
          </div>
          <div>
            <h4>Productos</h4>
            <ul>
              <li><NavLink to="/catalogo">Catálogo completo</NavLink></li>
              <li><NavLink to="/collections">Colecciones</NavLink></li>
              <li><NavLink to="/collections/termos">Termos</NavLink></li>
              <li><NavLink to="/collections/textil">Textil</NavLink></li>
              <li><NavLink to="/collections/ecologicos">Ecológicos</NavLink></li>
            </ul>
          </div>
          <div>
            <h4>Compañía</h4>
            <ul>
              <li><NavLink to="/contacto">Contacto</NavLink></li>
              <li><NavLink to="/lookbook">Lookbook</NavLink></li>
              <li><NavLink to="/policies">Avisos legales</NavLink></li>
            </ul>
          </div>
        </div>
        <div className="footer-legal">
          <span>©2026 Generando Ideas · México</span>
          <span>Producción · Fulfillment · Proyectos especiales</span>
        </div>
      </div>
    </footer>
  );
}
