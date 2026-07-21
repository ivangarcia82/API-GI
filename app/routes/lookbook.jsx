import {useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';
import {LookbookGrid} from '~/components/gi/HomeSections';
import {LIFESTYLE} from '~/lib/gi';

export const meta = () => [
  {title: 'Lookbook · Generando Ideas'},
  {
    name: 'description',
    content:
      'Inspiración de proyectos: kits de bienvenida, merch de marca y regalos corporativos personalizados por Generando Ideas.',
  },
];

export default function Lookbook() {
  const navigate = useNavigate();

  return (
    <div data-screen-label="11 Lookbook">
      <section className="lookbook-hero">
        <div className="lookbook-hero-bg">
          <img src={LIFESTYLE.workspace} alt="" style={{transform: 'scale(1.15)'}} />
        </div>
        <div className="lookbook-hero-overlay" />
        <div className="container lookbook-hero-inner">
          <div className="eyebrow" style={{color: 'var(--accent)'}}>
            // Lookbook · Temporada 2026
          </div>
          <h1 className="fade-up">
            Ideas que se<br />
            <em>ven</em> y se sienten.
          </h1>
          <p className="fade-up" style={{animationDelay: '120ms'}}>
            Ediciones para inspirar tu próxima campaña. Cada look reúne productos que
            cuentan una historia de marca coherente.
          </p>
          <div
            className="fade-up"
            style={{animationDelay: '200ms', display: 'flex', gap: 12, flexWrap: 'wrap'}}
          >
            <Button variant="accent" size="lg" iconRight="arrow_right" onClick={() => navigate('/catalogo')}>
              Explorar catálogo
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate('/collections')}
              style={{
                color: 'var(--bg-elev)',
                borderColor: 'rgba(244,242,236,0.3)',
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(8px)',
              }}
            >
              Ver colecciones
            </Button>
          </div>
        </div>
        <div className="lookbook-hero-scroll">
          <span>Scroll</span>
          <div className="lhs-line">
            <div className="lhs-dot" />
          </div>
        </div>
      </section>

      <section className="container" style={{padding: '80px 0 40px'}}>
        <div className="lookbook-intro">
          <h2>
            6 ediciones,<br />infinitas combinaciones.
          </h2>
          <p>
            Nuestro equipo creativo arma cada edición pensando en un momento corporativo concreto:
            onboarding, activaciones, sostenibilidad, eventos deportivos. Tú eliges el look,
            nosotros lo producimos a tu marca.
          </p>
        </div>
      </section>

      <section className="container" style={{paddingBottom: 80}}>
        <LookbookGrid />
      </section>

      <section className="container" style={{paddingBottom: 80}}>
        <div className="lookbook-editorial">
          <div className="le-media">
            <img src={LIFESTYLE.unboxing} alt="" />
          </div>
          <div className="le-text">
            <div className="eyebrow">// Detrás de cada edición</div>
            <h2>
              Diseñamos la experiencia<br />completa, no solo el producto.
            </h2>
            <p>
              Desde el empaque hasta el inserto impreso, cada edición del lookbook llega lista para
              sorprender a quien la recibe. Cuidamos materiales, acabados y el momento de unboxing.
            </p>
            <ul className="le-list">
              {[
                'Selección temática por temporada',
                'Empaque y kitting personalizado',
                'Dummies digitales antes de producir',
                'Envíos individuales personalizados',
              ].map((t) => (
                <li key={t}>
                  <Icon name="check" size={15} /> {t}
                </li>
              ))}
            </ul>
            <Button variant="primary" size="lg" iconRight="arrow_right" onClick={() => navigate('/contacto')}>
              Crear mi edición
            </Button>
          </div>
        </div>
      </section>

      <section className="container">
        <div className="big-cta-photo">
          <div className="big-cta-bg">
            <img src={LIFESTYLE.team} alt="" />
          </div>
          <div className="big-cta-overlay" />
          <div style={{position: 'relative'}}>
            <div className="eyebrow" style={{color: 'var(--accent)'}}>
              // ¿Listo?
            </div>
            <h2 style={{marginTop: 16}}>
              Llevemos tu marca<br />
              al{' '}
              <em style={{fontStyle: 'italic', fontWeight: 400, color: 'var(--accent)'}}>
                siguiente
              </em>{' '}
              nivel.
            </h2>
            <div className="actions">
              <Button variant="accent" size="lg" iconRight="arrow_right" onClick={() => navigate('/registro')}>
                Crear cuenta gratis
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
