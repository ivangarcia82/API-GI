/* Generando Ideas — site footer (marketing 4-column design, ported from
   gi-website-final/src/components/Footer.astro). Wrapped in `.gi-mkt` so it
   inherits the marketing footer/social styles from app/styles/gi-marketing.css
   regardless of which kind of page (marketing or commerce) renders it. */
import {NavLink} from 'react-router';
import {BRAND, ROUTES, SERVICES} from '~/lib/site-content';
import {SocialIcons} from '~/components/marketing/SocialIcons';

export function GiFooter() {
  return (
    <div className="gi-mkt">
      <footer className="footer" data-screen-label="Footer">
        <div className="wrap">
          <NavLink to={ROUTES.home} className="footer-logo" aria-label="Generando Ideas — inicio">
            <img src="/brand/logo-horizontal-blanco.svg" alt="Generando Ideas" width={282} height={63} />
          </NavLink>
          <div className="footer-brand">
            Vivimos de <em>promocionales.</em>
          </div>
          <div className="footer-grid">
            <div>
              <h3>Contáctanos</h3>
              <p style={{color: 'var(--gray-300)', fontSize: 14, lineHeight: 1.6, margin: 0}}>
                {BRAND.phone}
                <br />
                {BRAND.email}
                <br />
                CDMX · Sonora · Yucatán
              </p>
              <SocialIcons variant="footer" />
              <p className="footer-slogan" aria-label="Your one stop solution">
                Your one
                <br />
                stop
                <br />
                solution<span className="r">®</span>
              </p>
            </div>
            <div>
              <h3>Empresa</h3>
              <ul>
                <li>
                  <NavLink to={ROUTES.about}>Conócenos</NavLink>
                </li>
                <li>
                  <NavLink to={ROUTES.about}>Propósito</NavLink>
                </li>
                <li>
                  <NavLink to={ROUTES.about}>Principios</NavLink>
                </li>
              </ul>
            </div>
            <div>
              <h3>Servicios</h3>
              <ul>
                {SERVICES.map((s) => (
                  <li key={s.id}>
                    <NavLink to={ROUTES.service(s.id)}>{s.title}</NavLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Recursos</h3>
              <ul>
                <li>
                  <NavLink to={ROUTES.catalog}>Catálogos</NavLink>
                </li>
                <li>
                  <NavLink to={ROUTES.blog}>Blog</NavLink>
                </li>
                <li>
                  <NavLink to={ROUTES.careers}>Bolsa de trabajo</NavLink>
                </li>
                <li>
                  <NavLink to={ROUTES.estore}>e-Store</NavLink>
                </li>
                <li>
                  <a href={ROUTES.privacy} target="_blank" rel="noopener noreferrer">
                    Aviso de privacidad
                  </a>
                </li>
                <li>
                  <a href={ROUTES.terms} target="_blank" rel="noopener noreferrer">
                    Términos y condiciones
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 Generando Ideas. Todos los derechos reservados.</span>
            <span>
              100% Empresa Mexicana ·{' '}
              <svg
                width="7"
                height="7"
                viewBox="0 0 8 8"
                aria-hidden="true"
                style={{display: 'inline-block', verticalAlign: 'middle'}}
              >
                <circle cx="4" cy="4" r="4" fill="var(--orange-500)" />
              </svg>{' '}
              MX
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
