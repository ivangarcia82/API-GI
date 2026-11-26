/* Preguntas frecuentes. Todo el contenido viene de ~/lib/faq (ahí está la
   regla de qué puede entrar) y se sirve completo en el HTML del servidor: sin
   acordeones ni nada que haya que abrir, porque los rastreadores de IA no
   ejecutan JavaScript y lo que no está a la vista para ellos no existe. */
import {Link} from 'react-router';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {FAQ_GROUPS, FAQ_PATH, faqSchema} from '~/lib/faq';
import {ROUTES} from '~/lib/site-content';
import {SITE_URL} from '~/lib/seo';

const TITULO = 'Preguntas frecuentes sobre artículos promocionales | Generando Ideas';
const DESCRIPCION =
  'Cómo cotizar, ver precios y personalizar artículos promocionales con Generando Ideas: técnicas de decorado, tiempos de respuesta, sucursales y contacto.';

export const meta = () => {
  const url = `${SITE_URL}${FAQ_PATH}`;
  return [
    {title: TITULO},
    {name: 'description', content: DESCRIPCION},
    {tagName: 'link', rel: 'canonical', href: url},
    {property: 'og:title', content: TITULO},
    {property: 'og:description', content: DESCRIPCION},
    {property: 'og:type', content: 'website'},
    {property: 'og:url', content: url},
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@graph': [
          faqSchema(SITE_URL),
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {'@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/`},
              {'@type': 'ListItem', position: 2, name: 'Preguntas frecuentes', item: url},
            ],
          },
        ],
      },
    },
  ];
};

function Detalle({item}) {
  return (
    <>
      {item.steps?.length ? (
        <ol className="faq-steps">
          {item.steps.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
      ) : null}
      {item.table ? (
        <div className="svc-table-wrap faq-table">
          <table className="svc-table">
            <thead>
              <tr>
                {item.table.cols.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {item.table.rows.map(([nombre, uso]) => (
                <tr key={nombre}>
                  <th scope="row">{nombre}</th>
                  <td>{uso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

export default function PreguntasFrecuentes() {
  return (
    <MarketingLayout>
      <div className="page faq">
        <section className="section faq-hero">
          <div className="wrap">
            <span className="eyebrow">Preguntas frecuentes</span>
            <h1 className="faq-h1 display">
              Preguntas <span className="text-grad-word">frecuentes.</span>
            </h1>
            <p className="faq-lead">
              Generando Ideas es una empresa mexicana de artículos promocionales y regalos
              corporativos personalizados para empresas en México. Aquí respondemos cómo cotizar,
              cómo ver precios, qué técnicas de decorado manejamos y cómo contactarnos.
            </p>
          </div>
        </section>

        <section className="section faq-body">
          <div className="wrap faq-layout">
            <nav className="faq-index" aria-label="Temas">
              <ul>
                {FAQ_GROUPS.map((g) => (
                  <li key={g.id}>
                    <a href={`#${g.id}`}>{g.title}</a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="faq-groups">
              {FAQ_GROUPS.map((g) => (
                <section className="faq-group" id={g.id} key={g.id} aria-labelledby={`${g.id}-t`}>
                  <h2 className="faq-group-t display" id={`${g.id}-t`}>
                    {g.title}
                  </h2>
                  {g.items.map((item) => (
                    <article className="faq-item" key={item.q}>
                      <h3 className="faq-q">{item.q}</h3>
                      <p className="faq-a">{item.a}</p>
                      <Detalle item={item} />
                    </article>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-alt faq-cierre">
          <div className="wrap faq-cierre-inner">
            <h2 className="faq-cierre-t display">¿No encontraste tu respuesta?</h2>
            <p className="faq-cierre-p">
              Escríbenos y un asesor de Generando Ideas te responde en menos de 48 horas hábiles.
            </p>
            <div className="faq-cierre-cta">
              <Link to={ROUTES.contact} className="btn btn-accent btn-lg">
                Contactar a un asesor
              </Link>
              <Link to={ROUTES.catalog} className="btn btn-ghost btn-lg">
                Ver el catálogo
              </Link>
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
