import {useLoaderData, useNavigate} from 'react-router';
import {MockShopNotice} from '~/components/MockShopNotice';
import {Button, ScrollReveal, PH} from '~/components/gi/ui';
import {Icon} from '~/components/gi/Icon';
import {HeroCollage} from '~/components/gi/HomeSections';
import {
  ServicesStrip,
  ClientTestimonials,
} from '~/components/gi/HomeGiSections';
import {ImpactBand} from '~/components/marketing/ImpactBand';
import {ProcessSection} from '~/components/marketing/ProcessSection';
import {ClosingCTA} from '~/components/marketing/ClosingCTA';
import {useMarketingReveal} from '~/components/marketing/MarketingLayout';
import {useApp} from '~/lib/AppContext';
import {fetchCollectionCards} from '~/lib/giFragments';
import {HOME_CATEGORIES, HOME_FEATURED_COLLECTIONS} from '~/lib/gi';

export const meta = () => [
  {title: 'Generando Ideas — Promocionales que generan memoria'},
  {
    name: 'description',
    content:
      'Headless commerce B2B de productos promocionales personalizables. Cotiza, aprueba arte y produce en una sola plataforma.',
  },
];

export async function loader(args) {
  const criticalData = await loadCriticalData(args);
  return criticalData;
}

async function loadCriticalData({context}) {
  const {storefront} = context;

  // El hero muestra categorías, no productos: el home ya no pide productos
  // sueltos (ni su paleta de marca ni su precio por cliente).
  const [categories, featuredCollections] = await Promise.all([
    fetchCollectionCards(storefront, HOME_CATEGORIES.map((c) => c.handle)),
    fetchCollectionCards(storefront, HOME_FEATURED_COLLECTIONS),
  ]);

  // Merge category display config (icon + label) with fetched images
  const catMap = Object.fromEntries(categories.map((c) => [c.handle, c]));
  const categoryCards = HOME_CATEGORIES.map((c) => ({
    ...c,
    image: catMap[c.handle]?.image || null,
  }));

  return {
    isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN),
    categoryCards,
    featuredCollections,
  };
}

export default function Homepage() {
  const data = useLoaderData();
  const navigate = useNavigate();
  const {isLoggedIn, openQuoteDrawer} = useApp();
  const {categoryCards, featuredCollections} = data;
  useMarketingReveal();

  // El collage del hero muestra las categorías, no productos sueltos. Cuando
  // diseño entregue las imágenes de categoría, basta con ponerlas en Shopify
  // como imagen de cada colección.
  const heroImages = categoryCards.map((c) => c.image).filter(Boolean).slice(0, 8);

  return (
    <div data-screen-label="01 Home">
      {data.isShopLinked ? null : (
        <div className="container" style={{paddingTop: 24}}>
          <MockShopNotice />
        </div>
      )}

      {/* HERO */}
      <section className="home-hero">
        <div className="container">
          <div className="home-hero-grid">
            <div>
              <h1 className="fade-up" style={{animationDelay: '80ms'}}>
                Promocionales que<br />
                <em>generan</em> memoria.
              </h1>

              <p className="home-hero-sub fade-up" style={{animationDelay: '160ms'}}>
                Más de 1,800 productos personalizables para tu próxima campaña, kit
                de bienvenida o evento corporativo. Cotiza, aprueba arte y produce en
                una sola plataforma.
              </p>

              <div className="home-hero-actions fade-up" style={{animationDelay: '220ms'}}>
                <Button
                  as="a"
                  href="#categorias"
                  variant="soft"
                  size="lg"
                  iconRight="arrow_right"
                >
                  Explorar catálogo
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  icon="quote"
                  onClick={() => (isLoggedIn ? openQuoteDrawer() : navigate('/registro'))}
                >
                  {isLoggedIn ? 'Solicitar cotización' : 'Crear cuenta gratis'}
                </Button>
              </div>
            </div>

            <HeroCollage images={heroImages} />
          </div>
        </div>
      </section>

      <div className="gi-mkt">
        <ImpactBand />
      </div>

      {/* CATEGORIES */}
      <section id="categorias" className="section container" style={{paddingTop: 60}}>
        <div className="section-head">
          <div>
            <h2>
              Encuentra por <span className="text-accent">categoría.</span>
            </h2>
          </div>
          <p>
            Productos organizados en grandes familias, todas con opciones de
            personalización.
          </p>
        </div>
        <ScrollReveal>
          <div className="cat-grid">
            {categoryCards.slice(0, 4).map((c) => (
              <a
                key={c.handle}
                href={`/collections/${c.handle}`}
                className="cat-card cat-card-photo"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/collections/${c.handle}`);
                }}
              >
                <div className="cat-card-bg">
                  {c.image ? (
                    <img src={c.image} alt={c.name} loading="lazy" />
                  ) : (
                    <div style={{width: '100%', height: '100%', background: 'var(--bg-deep)'}} />
                  )}
                </div>
                <div className="cat-card-overlay" />
                <div className="cat-card-arrow">
                  <Icon name="arrow_up_right" size={14} />
                </div>
                <div className="cat-card-bottom">
                  <div className="cat-card-name">{c.name}</div>
                  <div className="cat-card-count">Ver productos</div>
                </div>
              </a>
            ))}
          </div>
        </ScrollReveal>
        {categoryCards.length > 4 && (
          <div style={{display: 'flex', justifyContent: 'center', marginTop: 32}}>
            {/* Lleva al listado completo de familias (/collections), no al
                catálogo de productos: la home sólo muestra cuatro. */}
            <Button
              variant="ghost"
              size="lg"
              iconRight="arrow_right"
              onClick={() => navigate('/collections')}
            >
              Ver todas las categorías
            </Button>
          </div>
        )}
      </section>

      {/* SERVICES */}
      <ServicesStrip />

      {/* FEATURED COLLECTIONS */}
      <section className="section container" style={{paddingTop: 40}}>
        <div className="section-head">
          <div>
            <h2>
              <span className="text-accent">Colecciones</span> para campañas
              precisas.
            </h2>
          </div>
          <p>
            Cada colección une calidad, oferta y propósito. Diseñadas por nuestro
            equipo creativo.
          </p>
        </div>
        <ScrollReveal>
          {/* Misma retícula y proporción que las categorías: el cliente pidió
              que estas tarjetas no fueran más anchas que aquéllas. */}
          <div className="cat-grid collections-compact">
            {featuredCollections.map((c, i) => (
              <div
                key={c.handle}
                className="coll-card"
                onClick={() => navigate(`/collections/${c.handle}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/collections/${c.handle}`);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="coll-card-img">
                  <PH src={c.image} alt={c.title} zoom className="ph-square" />
                  <div className="coll-card-tag">// {String(i + 1).padStart(2, '0')}</div>
                </div>
                <div className="coll-card-info">
                  <div>
                    <div className="coll-card-name">{c.title}</div>
                    <div className="coll-card-meta">
                      {c.description?.slice(0, 60) || 'Colección destacada'}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'var(--bg-soft)',
                      color: 'var(--ink)',
                    }}
                  >
                    <Icon name="arrow_right" size={16} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
        <div style={{display: 'flex', justifyContent: 'center', marginTop: 32}}>
          {/* /collections pasó a presentarse como "Categorías", así que el
              cierre de esta sección lleva al catálogo de productos. */}
          <Button
            variant="ghost"
            size="lg"
            iconRight="arrow_right"
            onClick={() => navigate('/catalogo')}
          >
            Ver todo el catálogo
          </Button>
        </div>
      </section>

      {/* PROCESS */}
      <div className="gi-mkt">
        <ProcessSection />
      </div>

      {/* CLIENT TESTIMONIALS */}
      <ClientTestimonials />

      {/* CLOSING CTA */}
      <div className="gi-mkt">
        <ClosingCTA />
      </div>
    </div>
  );
}
