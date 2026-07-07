// Port de ServicesShowcase.astro (gi-website-final/src/components/ServicesShowcase.astro)
// — mosaic layout branch only (list/stacked/pinned branches are not used by
// the home page and are out of scope for this port).
import {Link} from 'react-router';
import {SERVICES, ROUTES} from '~/lib/site-content';

// eslint-disable-next-line no-unused-vars -- kept for call-site compatibility with the Astro source's `layout` prop
export function ServicesShowcase({layout = 'mosaic'} = {}) {
  return (
    <div className="services-grid">
      {SERVICES.map((s, i) => (
        <Link
          key={s.id}
          className={i === 0 ? 'svc svc-hero' : `svc svc-${String.fromCharCode(96 + i)}`}
          to={ROUTES.service(s.id)}
        >
          <div className="svc-decoration" />
          <div>
            <span className={i === 0 ? 'svc-num svc-num-hero' : 'svc-num'}>
              {i === 0 ? `${s.num} — Servicio principal` : s.num}
            </span>
            <h3 style={{marginTop: 12}}>{s.title}</h3>
            <p>{s.desc}</p>
          </div>
          <span className="svc-cta">
            Ver más
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </Link>
      ))}
    </div>
  );
}
