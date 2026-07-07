// Port de servicios/[id].astro (gi-website-final/src/pages/servicios/[id].astro).
// `getStaticPaths` + the Astro.redirect fallback become a loader that looks up
// the service by `params.id` and redirects to /servicios when it's unknown.
// `.reveal` fade-ins are handled globally by MarketingLayout's
// useMarketingReveal(); the magnetic CTA hover is handled by <MagneticButton>.
// The hero zoom-parallax (scale 1.04 -> 1.14 while scrolling) is ported as a
// client-only useEffect using the shared ~/lib/motion GSAP/ScrollTrigger
// helpers, guarded by prefersReducedMotion(), mirroring ProcessSection.jsx.
import {useEffect, useRef} from 'react';
import {Link, redirect, useLoaderData} from 'react-router';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {MagneticButton} from '~/components/marketing/MagneticButton';
import {SERVICE_DETAILS, ROUTES} from '~/lib/site-content';

// Shared "how we work" process — keeps every service page feeling complete
// without inventing per-service copy that the team would have to maintain.
const PROCESS = [
  {t: 'Briefing', d: 'Escuchamos tu objetivo, audiencia y presupuesto para entender qué necesita tu marca.'},
  {t: 'Propuesta', d: 'Diseñamos una selección a medida con cotización clara y tiempos de entrega definidos.'},
  {t: 'Producción', d: 'Personalizamos y producimos con control de calidad en cada etapa del proceso.'},
  {t: 'Entrega', d: 'Coordinamos la logística y damos seguimiento hasta que el pedido llega a tus manos.'},
];

export async function loader({params}) {
  const s = SERVICE_DETAILS[params.id];
  if (!s) throw redirect(ROUTES.services);
  const other = Object.entries(SERVICE_DETAILS).filter(([k]) => k !== params.id);
  return {id: params.id, s, other};
}

export const meta = ({data}) => {
  const s = data?.s;
  if (!s) return [];
  const url = `https://generandoideas.com/servicios/${data.id}`;
  return [
    {title: s.seoTitle ?? `${s.title} — Generando Ideas`},
    {name: 'description', content: s.seoDescription ?? `${s.tagline} ${s.intro}`},
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Service',
            name: s.title,
            description: s.intro,
            image: s.hero,
            url,
            provider: {'@id': 'https://generandoideas.com/#organization'},
            areaServed: {'@type': 'Country', name: 'México'},
            mainEntityOfPage: {'@type': 'WebPage', '@id': url},
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {'@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://generandoideas.com/'},
              {'@type': 'ListItem', position: 2, name: 'Servicios', item: 'https://generandoideas.com/servicios'},
              {'@type': 'ListItem', position: 3, name: s.title, item: url},
            ],
          },
        ],
      },
    },
  ];
};

export default function ServiceDetail() {
  const {s, other} = useLoaderData();

  // Restrained accent: gradient at most ONE word of the H1, and only when the
  // service title has more than one word (gradienting a single-word title
  // would gradient the whole heading, which is banned). The first word
  // carries it.
  const titleWords = s.title.split(' ');
  const gradFirst = titleWords.length > 1;
  const headFirst = titleWords[0];
  const headRest = gradFirst ? titleWords.slice(1).join(' ') : '';

  const stageRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img) return undefined;

    let cleanup = () => {};
    let cancelled = false;
    import('~/lib/motion').then(({gsap, ScrollTrigger, prefersReducedMotion}) => {
      if (cancelled || prefersReducedMotion()) return;
      const tween = gsap.fromTo(
        img,
        {scale: 1.04},
        {
          scale: 1.14,
          ease: 'none',
          scrollTrigger: {
            trigger: stage,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      );
      cleanup = () => {
        ScrollTrigger.getAll().forEach((t) => {
          if (t.trigger === stage) t.kill();
        });
        gsap.killTweensOf(img);
        tween.kill();
      };
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [s.hero]);

  return (
    <MarketingLayout>
      <div className="page svc-detail">
        <section className="section svc-intro">
          <div className="wrap">
            <Link className="btn btn-ghost back-link" to={ROUTES.services}>
              <svg
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
                <path d="M19 12H5M11 18l-6-6 6-6" />
              </svg>
              Todos los servicios
            </Link>
            <span className="eyebrow">Servicio {s.num}</span>
            <h1 className="display svc-h1">
              {gradFirst ? (
                <>
                  <span className="text-grad-word">{headFirst}</span> {headRest}
                </>
              ) : (
                s.title
              )}
            </h1>
            <p className="svc-tagline" style={{'--svc-color': s.color}}>
              {s.tagline}
            </p>
          </div>
        </section>

        <section className="svc-hero-wrap">
          <div className="wrap">
            <div className="svc-hero-stage" ref={stageRef} data-hero-stage>
              <img
                src={s.hero}
                alt={`${s.title} — ${s.tagline}`}
                width={1400}
                height={612}
                loading="lazy"
                decoding="async"
                ref={imgRef}
                data-hero-img
              />
            </div>
          </div>
        </section>

        <section className="section svc-includes">
          <div className="wrap svc-includes-grid reveal">
            <div className="svc-includes-lead">
              <span className="eyebrow">Por qué nosotros</span>
              <h2 className="display svc-h2">
                Lo que <span className="text-accent">incluye</span>
              </h2>
              <p className="svc-intro-copy">{s.intro}</p>
              <div className="svc-examples">
                {s.examples.map((e) => (
                  <span className="svc-chip" key={e}>
                    {e}
                  </span>
                ))}
              </div>
            </div>
            <ul className="svc-features" style={{'--svc-color': s.color}}>
              {s.features.map((f, i) => (
                <li className="svc-feature" key={f.t}>
                  <span className="svc-feature-num">0{i + 1}</span>
                  <h3 className="svc-feature-t">{f.t}</h3>
                  <p className="svc-feature-d">{f.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section svc-process">
          <div className="wrap reveal">
            <div className="svc-process-head">
              <span className="eyebrow">Cómo trabajamos</span>
              <h2 className="display svc-h2">
                De la idea a tus manos, en <span className="text-accent">4 pasos</span>
              </h2>
            </div>
            <ol className="svc-steps">
              {PROCESS.map((p, i) => (
                <li className="svc-step" key={p.t}>
                  <span className="svc-step-num">0{i + 1}</span>
                  <h3 className="svc-step-t">{p.t}</h3>
                  <p className="svc-step-d">{p.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section section-dark svc-end-cta">
          <div className="wrap svc-cta-inner">
            <h2 className="display svc-cta-h">
              ¿Te interesa <span className="text-accent">{s.title}</span>?
            </h2>
            <p className="svc-cta-sub">Hablemos. Respuesta en menos de 24 horas hábiles.</p>
            <div className="svc-cta-actions">
              <MagneticButton>
                <Link to={ROUTES.contact} className="btn btn-accent btn-lg">
                  Cotizar ahora
                  <svg
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
              </MagneticButton>
              <Link to={ROUTES.estore} className="btn btn-ghost-light btn-lg">
                Ver e-store
              </Link>
            </div>
          </div>
        </section>

        <section className="section section-alt svc-more">
          <div className="wrap">
            <span className="eyebrow">Más servicios</span>
            <h2 className="display svc-h2 svc-more-h">Explora nuestro portafolio</h2>
            <div className="svc-more-grid">
              {other.map(([k, v]) => (
                <Link
                  key={k}
                  to={ROUTES.service(k)}
                  className="svc-more-card reveal"
                  style={{'--svc-tint': v.color}}
                >
                  <span className="svc-more-num">{v.num}</span>
                  <h3 className="svc-more-t">{v.title}</h3>
                  <span className="svc-more-arrow" aria-hidden="true">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
