// Port de blog/[slug].astro (gi-website-final/src/pages/blog/[slug].astro).
// `getStaticPaths` + the Astro.redirect fallback become a loader that looks up
// the post by `params.slug` and redirects to /blog when it's unknown.
// The BlogPosting + BreadcrumbList JSON-LD moves into the `meta` export via
// the shared `'script:ld+json'` convention (see servicios.$id.jsx,
// products.$handle.jsx). `.reveal` fade-ins are handled globally by
// MarketingLayout's useMarketingReveal(). The hero zoom-parallax
// (scale 1.04 -> 1.14 while scrolling) is ported as a client-only useEffect
// using the shared ~/lib/motion GSAP/ScrollTrigger helpers, guarded by
// prefersReducedMotion(), mirroring servicios.$id.jsx.
//
// El cuerpo sale de ~/lib/blog: cada artículo trae su respuesta directa, su
// resumen y sus apartados (pregunta + respuesta inmediata). Antes los seis
// artículos compartían el mismo texto genérico. Todo se sirve en el HTML del
// servidor, sin nada que abrir.
import {useEffect, useRef} from 'react';
import {Link, redirect, useLoaderData} from 'react-router';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {ROUTES} from '~/lib/site-content';
import {BLOG_POSTS, BLOG_REDIRECTS} from '~/lib/blog';
import {SITE_URL, ORGANIZATION_ID} from '~/lib/seo';

export async function loader({params}) {
  const post = BLOG_POSTS.find((p) => p.id === params.slug);
  if (post) return {post};
  // Artículo retirado: de forma permanente a su reemplazo (o al índice).
  const destino = BLOG_REDIRECTS[params.slug];
  if (destino) throw redirect(destino, 301);
  throw redirect(ROUTES.blog);
}

/** Las imágenes locales se declaran con dirección completa. */
const absoluta = (ruta) => (ruta.startsWith('/') ? `${SITE_URL}${ruta}` : ruta);

export const meta = ({data}) => {
  const post = data?.post;
  if (!post) return [];
  const url = `${SITE_URL}/blog/${post.id}`;
  const titulo = `${post.title} — Blog Generando Ideas`;
  return [
    {title: titulo},
    {name: 'description', content: post.excerpt},
    {tagName: 'link', rel: 'canonical', href: url},
    {property: 'og:title', content: post.title},
    {property: 'og:description', content: post.excerpt},
    {property: 'og:type', content: 'article'},
    {property: 'og:url', content: url},
    {property: 'og:image', content: absoluta(post.img)},
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt,
            abstract: post.answer,
            image: {'@type': 'ImageObject', url: absoluta(post.img)},
            datePublished: post.iso,
            dateModified: post.iso,
            author: {
              '@type': 'Person',
              name: post.author.name,
              worksFor: {'@id': ORGANIZATION_ID},
            },
            publisher: {
              '@id': ORGANIZATION_ID,
              logo: {'@type': 'ImageObject', url: `${SITE_URL}/favicon.svg`},
            },
            inLanguage: 'es-MX',
            articleSection: post.cat,
            wordCount: post.words,
            mainEntityOfPage: {'@type': 'WebPage', '@id': url},
            url,
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {'@type': 'ListItem', position: 1, name: 'Inicio', item: `${SITE_URL}/`},
              {'@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog`},
              {'@type': 'ListItem', position: 3, name: post.title, item: url},
            ],
          },
        ],
      },
    },
  ];
};

/** Un bloque de un apartado: párrafo, lista, pasos o tabla. */
function Bloque({bloque}) {
  if (bloque.p) return <p>{bloque.p}</p>;
  if (bloque.ul) {
    return (
      <ul className="prose-list">
        {bloque.ul.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (bloque.ol) {
    return (
      <ol className="prose-steps">
        {bloque.ol.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }
  if (bloque.table) {
    return (
      <div className="svc-table-wrap prose-table">
        {/* Con tres o más columnas la tabla conserva un ancho legible y se
            desliza de lado en pantallas angostas, en vez de apretar el texto. */}
        <table
          className="svc-table"
          style={bloque.table.cols.length >= 3 ? {minWidth: bloque.table.cols.length * 170} : undefined}
        >
          <thead>
            <tr>
              {bloque.table.cols.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bloque.table.rows.map(([primera, ...resto]) => (
              <tr key={primera}>
                <th scope="row">{primera}</th>
                {resto.map((celda, i) => (
                  // Las celdas de una fila no cambian de orden.
                  // eslint-disable-next-line react/no-array-index-key
                  <td key={i}>{celda}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

export default function BlogArticle() {
  const {post} = useLoaderData();

  const figureRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const figure = figureRef.current;
    const img = imgRef.current;
    if (!figure || !img) return undefined;

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
            trigger: figure,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      );
      cleanup = () => {
        ScrollTrigger.getAll().forEach((t) => {
          if (t.trigger === figure) t.kill();
        });
        gsap.killTweensOf(img);
        tween.kill();
      };
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [post.img]);

  return (
    <MarketingLayout className="gi-mkt-sticky">
      <article className="page article">
        <section className="section article-head">
          <div className="wrap">
            <Link className="btn btn-ghost back-link" to={ROUTES.blog}>
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
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
              Volver al blog
            </Link>
            <span className="eyebrow article-meta reveal">
              {post.cat} · <time dateTime={post.iso}>{post.date}</time> · {post.read} lectura ·{' '}
              {/* La firma va aquí, antes del título, para que el primer párrafo
                  después del h1 sea la respuesta directa y no la firma. */}
              <span className="article-author">Por {post.author.name}</span>
            </span>
            <h1 className="display article-title reveal">{post.title}</h1>
          </div>
        </section>

        <section className="article-figure-wrap">
          <div className="wrap">
            <figure className="article-figure" ref={figureRef} data-figure>
              <img
                src={post.img}
                alt={post.imgAlt}
                width={1400}
                height={700}
                loading="eager"
                fetchpriority="high" // eslint-disable-line react/no-unknown-property
                decoding="async"
                ref={imgRef}
                data-figure-img
              />
            </figure>
          </div>
        </section>

        <section className="section article-body-section">
          <div className="wrap article-layout">
            <div className="prose">
              {/* La respuesta directa: lo primero que lee quien llega y lo que
                  un buscador o un asistente de IA puede citar tal cual. */}
              <p className="prose-lead">{post.answer}</p>

              <h2 className="display prose-h2">En resumen</h2>
              <ul className="prose-list">
                {post.takeaways.map((punto) => (
                  <li key={punto}>{punto}</li>
                ))}
              </ul>

              {post.sections.map((seccion, n) => [
                <h2 className="display prose-h2" id={`s${n + 1}`} key={seccion.h}>
                  {seccion.h}
                </h2>,
                ...seccion.blocks.map((bloque, i) => (
                  // Los bloques de un apartado no cambian de orden.
                  // eslint-disable-next-line react/no-array-index-key
                  <Bloque bloque={bloque} key={`${seccion.h}-${i}`} />
                )),
              ])}

              <div className="prose-next">
                <span className="eyebrow">Siguiente paso</span>
                <div className="prose-next-links">
                  {post.next.map((n, i) => (
                    <Link className={`btn ${i === 0 ? 'btn-accent' : 'btn-ghost'}`} to={n.to} key={n.to}>
                      {n.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Índice lateral: el texto tiene un ancho de lectura acotado y
                esta columna acompaña al bajar, para no dejar media pantalla
                vacía. Va después del texto en el HTML, así no se mete entre
                una pregunta y su respuesta. En pantallas angostas se oculta. */}
            <aside className="article-aside" aria-label="En este artículo">
              <div className="article-aside-box">
                <span className="eyebrow">En este artículo</span>
                <ol className="article-toc">
                  {post.sections.map((seccion, n) => (
                    <li key={seccion.h}>
                      <a href={`#s${n + 1}`}>{seccion.h}</a>
                    </li>
                  ))}
                </ol>
                <Link className="btn btn-accent" to={post.next[0].to}>
                  {post.next[0].label}
                </Link>
              </div>
            </aside>
          </div>
        </section>
      </article>
    </MarketingLayout>
  );
}
