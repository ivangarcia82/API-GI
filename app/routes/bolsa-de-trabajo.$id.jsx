// Port de bolsa-de-trabajo/[id].astro (gi-website-final/src/pages/bolsa-de-trabajo/[id].astro).
// `getStaticPaths` + the Astro.redirect fallback become a loader that looks up
// the job by `params.id` and redirects to /bolsa-de-trabajo when it's unknown.
// The BreadcrumbList JSON-LD moves into the `meta` export via the shared
// `'script:ld+json'` convention (see servicios.$id.jsx, blog.$slug.jsx).
// `.reveal` fade-ins are handled globally by MarketingLayout's
// useMarketingReveal() (replaces the per-block GSAP stagger in the source);
// the magnetic apply-button hover is handled by <MagneticButton>.
import {Link, redirect, useLoaderData} from 'react-router';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {MagneticButton} from '~/components/marketing/MagneticButton';
import {ROUTES} from '~/lib/site-content';
import {getJobById, getRecruitmentSettings} from '~/lib/cms';

export async function loader({params}) {
  const [job, {recruitment, disclaimer}] = await Promise.all([
    getJobById(params.id),
    getRecruitmentSettings(),
  ]);
  if (!job) throw redirect(ROUTES.careers);
  return {job, recruitment, disclaimer};
}

export const meta = ({data}) => {
  const job = data?.job;
  if (!job) return [];
  const url = `https://generandoideas.com/bolsa-de-trabajo/${job.id}`;
  return [
    {title: `${job.title} — Bolsa de trabajo · Generando Ideas`},
    {name: 'description', content: `Vacante: ${job.title} · ${job.dept} · ${job.location}`},
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {'@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://generandoideas.com/'},
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Bolsa de trabajo',
            item: 'https://generandoideas.com/bolsa-de-trabajo',
          },
          {'@type': 'ListItem', position: 3, name: job.title, item: url},
        ],
      },
    },
  ];
};

export default function JobDetail() {
  const {job, recruitment, disclaimer} = useLoaderData();

  // Apply via the recruitment inbox, with the role pre-filled in the subject.
  const RECRUITMENT = recruitment;
  const RECRUITMENT_DISCLAIMER = disclaimer;
  const applyHref = `mailto:${RECRUITMENT.email}?subject=${encodeURIComponent('Postulación: ' + job.title)}`;
  const altApplyHref = `mailto:${RECRUITMENT.altEmail}?subject=${encodeURIComponent('Postulación: ' + job.title)}`;
  const telHref = `tel:+52${RECRUITMENT.phone.replace(/\s+/g, '')}`;

  return (
    <MarketingLayout>
      <div className="page job-detail">
        <section className="section job-hero">
          <div className="wrap">
            <Link className="btn btn-ghost back-link" to={ROUTES.careers}>
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
              Todas las vacantes
            </Link>
            <span className="eyebrow">
              {job.dept} · {job.location}
            </span>
            <h1 className="display job-h1">{job.title}</h1>
            <div className="job-chips">
              <span className="chip active">{job.type}</span>
              <span className="chip">{job.location}</span>
            </div>
          </div>
        </section>

        <section className="section job-body-sec">
          <div className="wrap job-layout">
            <article className="job-prose">
              <div className="prose-block reveal">
                <h2 className="prose-h">Sobre el rol</h2>
                <p className="prose-lede">
                  Somos una empresa mexicana, líder en la importación, fabricación y comercialización de
                  artículos promocionales, con clientes como Grupo Modelo, AT&amp;T, Grupo Salinas, Abbott
                  y Jaguar Land Rover. Estamos en búsqueda de tu talento para unirte a nuestro equipo como{' '}
                  <span className="text-accent">{job.title}</span>.
                </p>
              </div>

              <div className="prose-block reveal">
                <h2 className="prose-h">Lo que harás</h2>
                <ul className="prose-list">
                  {job.responsibilities.map((item) => (
                    <li key={item}>
                      <span className="li-mark" aria-hidden="true">
                        <svg
                          width="13"
                          height="13"
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
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="prose-block reveal">
                <h2 className="prose-h">Lo que buscamos</h2>
                <ul className="prose-list">
                  {job.requirements.map((item) => (
                    <li key={item}>
                      <span className="li-mark" aria-hidden="true">
                        <svg
                          width="13"
                          height="13"
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
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="prose-block reveal">
                <h2 className="prose-h">Lo que ofrecemos</h2>
                <ul className="prose-list prose-list-check">
                  {job.offer.map((item) => (
                    <li key={item}>
                      <span className="li-mark li-mark-good" aria-hidden="true">
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <aside className="job-aside">
              <div className="apply-box reveal">
                <h2 className="apply-h">¿Listo para postularte?</h2>
                <p className="apply-p">
                  Envía tu CV actualizado a{' '}
                  <a className="apply-mail" href={applyHref}>
                    {RECRUITMENT.email}
                  </a>
                </p>
                <MagneticButton>
                  <a className="btn btn-primary btn-lg apply-btn" href={applyHref}>
                    Enviar aplicación
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
                <p className="apply-alt">
                  También puedes escribir a <a href={altApplyHref}>{RECRUITMENT.altEmail}</a> o llamar al{' '}
                  <a href={telHref}>{RECRUITMENT.phone}</a>.
                </p>
                <dl className="apply-meta">
                  <div>
                    <dt>Área</dt>
                    <dd>{job.dept}</dd>
                  </div>
                  <div>
                    <dt>Ubicación</dt>
                    <dd>{job.location}</dd>
                  </div>
                  <div>
                    <dt>Modalidad</dt>
                    <dd>{job.type}</dd>
                  </div>
                  <div>
                    <dt>Sueldo</dt>
                    <dd>{job.salary}</dd>
                  </div>
                </dl>
                <p className="apply-note">{RECRUITMENT_DISCLAIMER}</p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
