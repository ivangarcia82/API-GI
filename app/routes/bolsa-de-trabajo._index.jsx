// Port de bolsa-de-trabajo/index.astro (gi-website-final/src/pages/bolsa-de-trabajo/index.astro).
// The count-up stat and the magnetic CTA hover, both driven by inline
// <script> in the source, are replaced by the shared <CountUp> and
// <MagneticButton> primitives; `.reveal` fade-ins are handled globally by
// MarketingLayout's useMarketingReveal().
import {Link, useLoaderData} from 'react-router';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {CountUp} from '~/components/marketing/CountUp';
import {MagneticButton} from '~/components/marketing/MagneticButton';
import {getJobs, getRecruitmentSettings} from '~/lib/cms';

export async function loader() {
  const [jobs, {recruitment}] = await Promise.all([
    getJobs(),
    getRecruitmentSettings(),
  ]);
  return {jobs, recruitment};
}

export const meta = () => [
  {title: 'Bolsa de Trabajo | Oportunidades Profesionales en Generando Ideas'},
  {
    name: 'description',
    content:
      'Únete a un equipo que transforma ideas en experiencias. Vacantes en ventas, diseño, producción, operaciones y marketing.',
  },
];

export default function BolsaDeTrabajoIndex() {
  const {jobs, recruitment} = useLoaderData();

  const openCvHref = `mailto:${recruitment.email}?subject=${encodeURIComponent('CV abierto — Generando Ideas')}`;

  // Hairline stat band — vacante count is now dynamic from CMS.
  const STATS = [
    {value: jobs.length, suffix: '', display: String(jobs.length), count: true, label: 'Vacantes abiertas'},
    {value: 140, suffix: '+', display: '140+', count: false, label: 'Colaboradores actuales'},
  ];

  return (
    <MarketingLayout>
      <div className="page">
        <section className="section careers-hero">
          <div className="wrap">
            <span className="eyebrow">Bolsa de trabajo · Únete</span>
            <h1 className="display careers-h1">
              Únete a un equipo que transforma ideas en{' '}
              <span className="text-grad-word">experiencias.</span>
            </h1>
            <p className="careers-lede">
              En Generando Ideas creemos que las mejores experiencias nacen de personas apasionadas,
              creativas y comprometidas. Si buscas crecer profesionalmente mientras desarrollas
              proyectos que generan impacto, este es tu lugar.
            </p>
          </div>
        </section>

        <section className="section careers-stats-sec" aria-label="Generando Ideas en números">
          <div className="wrap reveal">
            <div className="stat-band">
              {STATS.map((s) => (
                <div className="stat-cell" key={s.label}>
                  {s.count ? (
                    <strong className="stat-n">
                      <CountUp value={s.value} suffix={s.suffix ?? ''} />
                    </strong>
                  ) : (
                    <strong className="stat-n">{s.display}</strong>
                  )}
                  <span className="stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section careers-jobs-sec">
          <div className="wrap">
            <h2 className="display careers-h2 reveal">Vacantes disponibles</h2>
            <div className="jobs-list reveal">
              {jobs.map((j) => (
                <Link className="job-row careers-job" to={`/bolsa-de-trabajo/${j.id}`} key={j.id}>
                  <div className="job-main">
                    <h3 className="job-title">{j.title}</h3>
                    <span className="job-meta">
                      {j.dept} · {j.location}
                    </span>
                  </div>
                  <div className="job-tail">
                    <span className="job-type">{j.type}</span>
                    <span className="job-arrow" aria-hidden="true">
                      <svg
                        width="20"
                        height="20"
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
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="section careers-cta-sec">
          <div className="wrap reveal">
            <div className="open-cv section-dark">
              <h2 className="display open-cv-h">¿No encuentras tu rol ideal?</h2>
              <p className="open-cv-p">
                Envíanos tu CV de cualquier forma. Estamos creciendo y abrimos nuevas posiciones cada
                mes.
              </p>
              <MagneticButton>
                <a className="btn btn-accent btn-lg open-cv-btn" href={openCvHref} rel="noopener">
                  Enviar CV abierto
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
                </a>
              </MagneticButton>
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
