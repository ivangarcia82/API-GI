/* Generando Ideas — native API-GI home sections (services, testimonials, about).
 * Styled with the commerce design system (see app/styles/gi-screens.css),
 * NOT the `.gi-mkt` marketing look.
 */
import {useNavigate} from 'react-router';
import {Button, ScrollReveal} from '~/components/gi/ui';
import {Icon} from '~/components/gi/Icon';
import {SERVICES, TESTIMONIALS, OFFICES} from '~/lib/site-content';

const initials = (name) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** Five services, one relationship — links out to the service detail pages. */
export function ServicesStrip() {
  const navigate = useNavigate();
  return (
    <section className="section container">
      <div className="section-head">
        <div>
          <div className="eyebrow">// Servicios</div>
          <h2>Cinco servicios, una sola relación.</h2>
        </div>
        <p>
          De la selección de producto a la importación a medida: un solo
          equipo acompaña cada etapa de tu proyecto.
        </p>
      </div>
      <ScrollReveal>
        <div className="svc-strip-grid">
          {SERVICES.map((s) => (
            <a
              key={s.id}
              href={`/servicios/${s.id}`}
              className="svc-strip-card"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                navigate(`/servicios/${s.id}`);
              }}
            >
              <div className="svc-strip-top">
                <span className="svc-strip-num">{s.num}</span>
                <span className="svc-strip-arrow">
                  <Icon name="arrow_up_right" size={16} />
                </span>
              </div>
              <h3 className="svc-strip-title">{s.title}</h3>
              <p className="svc-strip-desc">{s.desc}</p>
            </a>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}

/** Client quotes — relationships that last years. */
export function ClientTestimonials() {
  const featured = TESTIMONIALS.slice(0, 6);
  return (
    <section className="section container">
      <div className="section-head">
        <div>
          <div className="eyebrow">Lo que dicen nuestros clientes</div>
          <h2>
            Relaciones que <span className="text-accent">duran años.</span>
          </h2>
        </div>
        <p>
          Marcas de todos los tamaños confían en nosotros para sus campañas,
          kits y eventos corporativos.
        </p>
      </div>
      <ScrollReveal>
        <div className="testi-grid">
          {featured.map((t) => (
            <div key={t.company + t.quote.slice(0, 12)} className="testi-card">
              <blockquote>&quot;{t.quote}&quot;</blockquote>
              <footer className="testi-foot">
                <span className="testi-avatar">{initials(t.company)}</span>
                <span className="testi-company">{t.company}</span>
              </footer>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}

/** Brand teaser — who we are, in one glance, with a CTA to the about page. */
export function AboutTeaser() {
  const navigate = useNavigate();
  const coverage = OFFICES.map((o) => o.name).join(' · ');
  return (
    <section className="section container">
      <div className="how how-about">
        <div className="how-head">
          <div className="eyebrow">// Quiénes somos</div>
          <h2>
            100% mexicana,<br />+12 años generando ideas.
          </h2>
        </div>
        <p className="how-about-copy">
          Somos una empresa 100% mexicana con más de 12 años de experiencia en
          promocionales, print shop e importaciones. Cobertura en {coverage},
          con envíos a todo el país.
        </p>
        <Button
          variant="accent"
          size="lg"
          iconRight="arrow_right"
          onClick={() => navigate('/conocenos')}
        >
          Conócenos
        </Button>
      </div>
    </section>
  );
}
