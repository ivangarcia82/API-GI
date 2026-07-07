// Port de blog/[slug].astro (gi-website-final/src/pages/blog/[slug].astro).
// `getStaticPaths` + the Astro.redirect fallback become a loader that looks up
// the post by `params.slug` and redirects to /blog when it's unknown.
// The BlogPosting + BreadcrumbList JSON-LD moves into the `meta` export via
// the shared `'script:ld+json'` convention (see servicios.$id.jsx,
// products.$handle.jsx). `.reveal` fade-ins are handled globally by
// MarketingLayout's useMarketingReveal(). The hero zoom-parallax
// (scale 1.04 -> 1.14 while scrolling) is ported as a client-only useEffect
// using the shared ~/lib/motion GSAP/ScrollTrigger helpers, guarded by
// prefersReducedMotion(), mirroring servicios.$id.jsx. The article body below
// the lead paragraph is static boilerplate shared by every post in the
// source .astro file — copied verbatim.
import {useEffect, useRef} from 'react';
import {Link, redirect, useLoaderData} from 'react-router';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {BLOG_POSTS, ROUTES} from '~/lib/site-content';

export async function loader({params}) {
  const post = BLOG_POSTS.find((p) => p.id === params.slug);
  if (!post) throw redirect(ROUTES.blog);
  return {post};
}

export const meta = ({data}) => {
  const post = data?.post;
  if (!post) return [];
  const url = `https://generandoideas.com/blog/${post.id}`;
  return [
    {title: `${post.title} — Blog Generando Ideas`},
    {name: 'description', content: post.excerpt},
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt,
            image: {'@type': 'ImageObject', url: post.img},
            datePublished: post.iso,
            dateModified: post.iso,
            author: {'@id': 'https://generandoideas.com/#organization'},
            publisher: {
              '@id': 'https://generandoideas.com/#organization',
              logo: {'@type': 'ImageObject', url: 'https://generandoideas.com/favicon.svg'},
            },
            inLanguage: 'es-MX',
            articleSection: post.cat,
            mainEntityOfPage: {'@type': 'WebPage', '@id': url},
            url,
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {'@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://generandoideas.com/'},
              {'@type': 'ListItem', position: 2, name: 'Blog', item: 'https://generandoideas.com/blog'},
              {'@type': 'ListItem', position: 3, name: post.title, item: url},
            ],
          },
        ],
      },
    },
  ];
};

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
    <MarketingLayout>
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
              {post.cat} · <time dateTime={post.iso}>{post.date}</time> · {post.read} lectura
            </span>
            <h1 className="display article-title reveal">{post.title}</h1>
          </div>
        </section>

        <section className="article-figure-wrap">
          <div className="wrap">
            <figure className="article-figure" ref={figureRef} data-figure>
              <img
                src={post.img}
                alt={post.title}
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
          <div className="wrap">
            <div className="prose">
              <p className="prose-lead">{post.excerpt}</p>

              <p>
                En Generando Ideas llevamos más de 12 años observando cómo las marcas usan los
                artículos promocionales para conectar con su audiencia. Este artículo recopila lo
                que hemos aprendido trabajando con{' '}
                <span className="text-accent">más de 500 marcas</span> en México.
              </p>

              <h2 className="display prose-h2">Lo esencial en 30 segundos</h2>
              <ul className="prose-list">
                <li>Empieza siempre por el objetivo de la campaña, no por el producto.</li>
                <li>El costo por impresión del promocional vence al CPM digital a los 6 meses.</li>
                <li>La sustentabilidad ya no es opcional para audiencias menores de 35.</li>
                <li>Medir retorno es posible — con los tags correctos desde el día 0.</li>
              </ul>

              <blockquote className="prose-quote">
                El promocional no es un gasto de marketing. Es una inversión que se lleva puesta.
              </blockquote>

              <p>
                Si quieres seguir la conversación, escríbenos. Compartimos hallazgos con clientes
                aliados cada trimestre en sesiones cerradas.
              </p>
            </div>
          </div>
        </section>
      </article>
    </MarketingLayout>
  );
}
