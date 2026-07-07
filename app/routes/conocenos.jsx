// Port de conocenos.astro (gi-website-final/src/pages/conocenos.astro).
// `.reveal` fade-ins are handled globally by MarketingLayout's
// useMarketingReveal(); the magnetic CTA hover is handled by <MagneticButton>
// (same GSAP quickTo wiring as the source's inline <script>).
import {Link} from 'react-router';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {MagneticButton} from '~/components/marketing/MagneticButton';
import {ROUTES} from '~/lib/site-content';

// Certificaciones y distintivos. Cuando se cuente con los logotipos oficiales,
// agregar `logo: '/brand/certs/...'` a cada item y mostrarlos junto al nombre.
const CERTIFICATIONS = [
  {
    name: 'Principios Rectores Coca-Cola',
    desc: 'Certificamos nuestras operaciones bajo los Principios Rectores, mediante una auditoría externa que ratifica buenas prácticas éticas, laborales y ambientales en la cadena de valor.',
  },
  {
    name: 'SMETA',
    desc: 'Cumplimiento de los estándares de los 4 pilares, demostrando nuestro compromiso con prácticas éticas, responsabilidad social, seguridad y sostenibilidad.',
  },
  {
    name: 'Certificate FAMA Disney',
    desc: 'Nuestras instalaciones cuentan con la aprobación FAMA, cumpliendo con los estándares de calidad, seguridad y cumplimiento social exigidos por The Walt Disney Company. Esta auditoría nos faculta para la manufactura y distribución de productos bajo licencias globales.',
  },
  {
    name: 'PPAI',
    desc: 'Socios activos de la red Promotional Products Association International (PPAI), para garantizar estándares de calidad y ética en cada proyecto.',
  },
  {
    name: 'AMPPRO',
    desc: 'Asociación Mexicana de Profesionales de la Promoción. Miembros activos desde nuestra fundación en 2013 hasta la actualidad, con participación en el comité 2025-2026.',
  },
  {
    name: 'ESR',
    desc: '5 años consecutivos como Empresa Socialmente Responsable, otorgado por el Centro Mexicano para la Filantropía.',
  },
  {
    name: 'Círculo de Proveedores',
    desc: 'Cumplimiento en la evaluación de aspectos legales, financieros, operativos y comerciales.',
  },
  {
    name: 'Certificación Integral de Empresas',
    desc: 'Cumplimiento de los estándares requeridos por Grupo Salinas con nivel oro, que indica excelencia operativa y el cumplimiento total o superior de las normas estratégicas, de gobernabilidad y técnicas.',
  },
];

export const meta = () => [
  {title: 'Conócenos | Generando Ideas - Expertos en Artículos Promocionales y Branding'},
  {
    name: 'description',
    content:
      'Conoce Generando Ideas, empresa con más de 12 años de experiencia en artículos promocionales, regalos corporativos y soluciones de branding para fortalecer tu marca.',
  },
];

export default function Conocenos() {
  return (
    <MarketingLayout>
      <div className="page conocenos">
        <section className="section about-hero">
          <div className="wrap">
            <span className="eyebrow">Conócenos · Desde 2013</span>
            <h1 className="display about-h1">
              Somos una empresa <span className="text-grad-word">100% mexicana</span> que
              vive, respira y crea promocionales.
            </h1>
          </div>
        </section>

        <section className="section about-intro">
          <div className="wrap reveal">
            <div className="about-head">
              <span className="eyebrow">¿Quiénes somos?</span>
              <h2 className="display about-copy-h">
                <span className="text-accent">Líderes</span> en la industria promocional
              </h2>
            </div>
            <figure className="about-figure">
              <img
                src="/publicitas.jpg"
                alt="El equipo de Generando Ideas en una expo de la industria promocional"
                loading="lazy"
              />
            </figure>
            <div className="about-copy">
              <p>
                Iniciamos operaciones en 2013 con una idea clara: las marcas necesitan más que
                un producto con logo. Necesitan un socio que entienda su voz, su audiencia y
                sus objetivos — y que convierta cada artículo en una extensión de su identidad.
              </p>
              <p>
                Hoy operamos tres sucursales en México (CDMX, Yucatán y Sonora), ofreciendo
                alternativas únicas: promocionales, Promotional Workshop, Print Shop, Digital
                Evolution e importaciones.
              </p>
            </div>
          </div>
        </section>

        <section className="section section-alt">
          <div className="wrap mv-grid">
            <article className="mv-card mv-light reveal">
              <span className="eyebrow">Propósito</span>
              <h3 className="display mv-h">Ideas en resultados</h3>
              <p>
                Convertimos ideas en resultados concretos, con prácticas honestas que generan
                un impacto positivo en nuestra sociedad.
              </p>
            </article>
            <article className="mv-card mv-ink reveal">
              <span className="eyebrow">Principios</span>
              <h3 className="display mv-h">En lo que creemos</h3>
              <ul className="mv-principles">
                <li>Resultados reales, compromisos cumplidos.</li>
                <li>Ideas estratégicas, actitud correcta.</li>
                <li>La integridad es parte del resultado.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow">Por qué nosotros</span>
                <h2 className="display values-h">
                  Lo que nos <span className="text-accent">diferencia.</span>
                </h2>
              </div>
            </div>
            <div className="diff-grid reveal">
              <article className="diff-card">
                <h3 className="value-title">Más de 12 años de experiencia</h3>
                <p>
                  Ayudamos a empresas a fortalecer su marca mediante soluciones promocionales
                  efectivas y adaptadas a sus objetivos.
                </p>
              </article>
              <article className="diff-card">
                <h3 className="value-title">Amplio catálogo de soluciones</h3>
                <p>
                  Ofrecemos una amplia variedad de artículos promocionales, regalos
                  corporativos y productos para campañas, eventos y reconocimientos.
                </p>
              </article>
              <article className="diff-card">
                <h3 className="value-title">Personalización y branding</h3>
                <p>
                  Transformamos cada producto en una herramienta de comunicación, aplicando
                  técnicas de personalización que potencian la identidad y visibilidad de tu
                  marca.
                </p>
              </article>
              <article className="diff-card">
                <h3 className="value-title">Compromiso en cada proyecto</h3>
                <p>
                  Brindamos acompañamiento personalizado, atención cercana y seguimiento
                  continuo para garantizar calidad, cumplimiento y satisfacción en cada
                  entrega.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section-alt certs">
          <div className="wrap">
            <div className="section-head">
              <div>
                <span className="eyebrow">Certificaciones</span>
                <h2 className="display certs-h">
                  Respaldos que <span className="text-accent">nos distinguen.</span>
                </h2>
              </div>
              <p>
                Operamos bajo estándares y auditorías que avalan nuestra calidad, ética y
                compromiso social.
              </p>
            </div>
            <ul className="certs-grid reveal" aria-label="Certificaciones y distintivos">
              {CERTIFICATIONS.map((c) => (
                <li className="cert-card" key={c.name}>
                  <h3 className="cert-name">{c.name}</h3>
                  <p>{c.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section section-dark about-cta">
          <div className="wrap about-cta-inner">
            <h2 className="display about-cta-h">¿Listo para amplificar tu marca?</h2>
            <MagneticButton>
              <Link to={ROUTES.contact} className="btn btn-accent btn-lg">
                Empecemos a trabajar
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
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
