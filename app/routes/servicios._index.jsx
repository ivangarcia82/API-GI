// Port de servicios/index.astro (gi-website-final/src/pages/servicios/index.astro).
// `.reveal` fade-ins are handled globally by MarketingLayout's
// useMarketingReveal(); the page's own IntersectionObserver script (`.svc-rev`
// staggering + per-tile `--svc-i` indices on the mosaic) is not ported — the
// shared `.reveal` treatment already covers the fade-up on scroll-in, just
// without the manual per-block stagger delays.
import {Link} from 'react-router';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {ServicesShowcase} from '~/components/marketing/ServicesShowcase';
import {SERVICES, SERVICE_DETAILS, ROUTES} from '~/lib/site-content';

const OFFER_CATALOG_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'OfferCatalog',
  name: 'Servicios de Generando Ideas',
  provider: {'@id': 'https://generandoideas.com/#organization'},
  itemListElement: SERVICES.map((s) => ({
    '@type': 'Service',
    name: s.title,
    description: SERVICE_DETAILS[s.id]?.intro ?? s.desc,
    url: `https://generandoideas.com/servicios/${s.id}`,
    provider: {'@id': 'https://generandoideas.com/#organization'},
    areaServed: {'@type': 'Country', name: 'México'},
  })),
};

export const meta = () => [
  {title: 'Generando Ideas | Servicios de Marketing Promocional y Branding'},
  {
    name: 'description',
    content:
      'En Generando Ideas convertimos objetivos de negocio en soluciones promocionales: promocionales, Print Shop, Promotional Workshop, Digital Evolution e importaciones.',
  },
  {'script:ld+json': OFFER_CATALOG_JSON_LD},
];

export default function ServiciosIndex() {
  return (
    <MarketingLayout>
      <div className="page svc-index">
        <section className="section svc-hero-sec">
          <div className="wrap">
            <span className="eyebrow reveal">Servicios</span>
            <h1 className="display svc-h1 reveal">
              Servicios que transforman ideas en{' '}
              <span className="text-grad-word">experiencias</span> de marca.
            </h1>
            <div className="svc-hero-foot">
              <div className="svc-lede reveal">
                <p>
                  En Generando Ideas convertimos objetivos de negocio en soluciones
                  promocionales que generan impacto.
                </p>
                <p>
                  Desde la selección estratégica de productos y el desarrollo de campañas
                  hasta la personalización y entrega, acompañamos a nuestros clientes en cada
                  etapa del proceso.
                </p>
                <p>
                  Nuestro enfoque combina creatividad, experiencia y atención al detalle para
                  crear experiencias memorables que fortalecen la conexión entre las marcas y
                  sus audiencias.
                </p>
              </div>
              <ul className="svc-index-list reveal" aria-label="Índice de servicios">
                {SERVICES.map((s) => (
                  <li key={s.id}>
                    <Link to={ROUTES.service(s.id)}>
                      <span className="n">{s.num}</span>
                      <span className="t">{s.title}</span>
                      <svg
                        className="ar"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="section svc-mosaic-sec section-alt">
          <div className="wrap">
            <div className="svc-mosaic-head">
              <span className="eyebrow reveal">El ecosistema completo</span>
              <h2 className="reveal">
                Una ventanilla, <span className="text-accent">cinco caminos</span> para tu
                marca.
              </h2>
            </div>
            <div className="svc-mosaic-mount reveal">
              <ServicesShowcase layout="mosaic" />
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
