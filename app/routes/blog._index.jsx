// Port de blog/index.astro (gi-website-final/src/pages/blog/index.astro).
// El filtro por categoría (innerHTML + querySelectorAll en el original) se
// reimplementa con estado de React. `useMarketingReveal()` (MarketingLayout)
// sólo corre al navegar (cambio de pathname), no en cada cambio de estado del
// filtro, así que el bloque destacado y la grilla se renderizan siempre con
// `reveal in` (ya "revelados"): así nunca quedan ocultos (opacity: 0) tras
// hacer clic en un chip. Esto reemplaza el `requestAnimationFrame(() => ...)`
// que el script original usaba para re-agregar `.in` a los nodos inyectados.
import {useState} from 'react';
import {Link} from 'react-router';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {BLOG_POSTS, BLOG_CATEGORIES} from '~/lib/site-content';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export const meta = () => [
  {title: 'Blog de Marketing Promocional y Branding | Generando Ideas'},
  {
    name: 'description',
    content:
      'Tendencias, ideas, casos de éxito y consejos para crear estrategias promocionales más efectivas para tu marca.',
  },
];

export default function BlogIndex() {
  const [cat, setCat] = useState('Todos');
  const filtered = cat === 'Todos' ? BLOG_POSTS : BLOG_POSTS.filter((p) => p.cat === cat);
  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <MarketingLayout>
      <div className="page blog-page">
        <section className="section blog-hero">
          <div className="wrap">
            <span className="eyebrow">Blog · Ideas en acción</span>
            <h1 className="blog-h1 display">
              Lo que aprendemos, <span className="text-grad-word">lo compartimos.</span>
            </h1>
            <p className="blog-lead">
              Tendencias, ideas, casos de éxito y consejos que te ayudarán a crear estrategias
              promocionales más efectivas para tu marca.
            </p>
          </div>
        </section>

        <section className="section blog-body">
          <div className="wrap">
            <div
              className="cat-filter blog-filter"
              role="group"
              aria-label="Filtrar artículos por categoría"
            >
              {BLOG_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cx('chip', c === cat && 'active')}
                  aria-pressed={c === cat}
                  onClick={() => setCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            <div>
              {featured ? (
                <Link className="blog-feature reveal in" to={`/blog/${featured.id}`}>
                  <div className="blog-feature-img">
                    <img src={featured.img} alt={featured.title} loading="lazy" />
                  </div>
                  <div className="blog-feature-body">
                    <span className="eyebrow">Destacado · {featured.cat}</span>
                    <h2 className="blog-feature-title display">{featured.title}</h2>
                    <p className="blog-feature-excerpt">{featured.excerpt}</p>
                    <span className="blog-meta">
                      <time dateTime={featured.iso}>{featured.date}</time> · {featured.read}{' '}
                      lectura
                    </span>
                  </div>
                </Link>
              ) : null}

              <div className="blog-grid reveal in">
                {rest.map((p, i) => (
                  <Link
                    key={p.id}
                    className="blog-card"
                    style={{'--i': i}}
                    to={`/blog/${p.id}`}
                  >
                    <div className="blog-card-img">
                      <img src={p.img} alt={p.title} loading="lazy" />
                    </div>
                    <div className="blog-card-body">
                      <span className="blog-card-cat">{p.cat}</span>
                      <h3 className="blog-card-title">{p.title}</h3>
                      <p className="blog-card-excerpt">{p.excerpt}</p>
                      <span className="blog-card-meta">
                        <time dateTime={p.iso}>{p.date}</time> · {p.read}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {!filtered.length ? (
                <p className="blog-empty">
                  Aún no hay artículos en esta categoría. Pronto compartiremos más.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
