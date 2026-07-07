import {useLoaderData, useNavigate} from 'react-router';
import {MockShopNotice} from '~/components/MockShopNotice';
import {ProductCard} from '~/components/gi/ProductCard';
import {Button, CountUp, ScrollReveal, PH} from '~/components/gi/ui';
import {Icon} from '~/components/gi/Icon';
import {HeroCollage, LookbookGrid} from '~/components/gi/HomeSections';
import {
  ServicesStrip,
  ClientTestimonials,
  AboutTeaser,
} from '~/components/gi/HomeGiSections';
import {useApp} from '~/lib/AppContext';
import {GI_PRODUCTS_QUERY, fetchCollectionCards} from '~/lib/giFragments';
import {
  normalizeProduct,
  HOME_CATEGORIES,
  FEATURED_COLLECTIONS,
  LIFESTYLE,
} from '~/lib/gi';

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

  const [categories, featuredCollections, productsRes] = await Promise.all([
    fetchCollectionCards(storefront, HOME_CATEGORIES.map((c) => c.handle)),
    fetchCollectionCards(storefront, FEATURED_COLLECTIONS),
    storefront.query(GI_PRODUCTS_QUERY, {
      variables: {first: 16, sortKey: 'BEST_SELLING'},
    }),
  ]);

  const products = (productsRes?.products?.nodes || [])
    .map(normalizeProduct)
    .filter(Boolean);

  // Merge category display config (icon + label) with fetched images
  const catMap = Object.fromEntries(categories.map((c) => [c.handle, c]));
  const categoryCards = HOME_CATEGORIES.map((c) => ({
    ...c,
    image: catMap[c.handle]?.image || null,
  }));

  return {
    isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN),
    categoryCards,
    featuredCollections: featuredCollections.slice(0, 3),
    products,
  };
}

export default function Homepage() {
  const data = useLoaderData();
  const navigate = useNavigate();
  const {isLoggedIn, openQuoteDrawer} = useApp();
  const {categoryCards, featuredCollections, products} = data;

  const heroImages = products.map((p) => p.image).filter(Boolean).slice(0, 8);
  const featured = products[0];

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
              <div className="fade-up">
                <div className="home-hero-eyebrow">
                  <span className="tag-ink tag">v2.0</span>
                  <span style={{fontSize: 13, color: 'var(--ink-3)'}}>
                    Catálogo 2026 disponible
                  </span>
                  <Icon name="arrow_right" size={14} className="muted-2" />
                </div>
              </div>

              <h1 className="fade-up" style={{animationDelay: '80ms'}}>
                Promocionales<br />
                que <em>generan</em><br />
                memoria.
              </h1>

              <p className="home-hero-sub fade-up" style={{animationDelay: '160ms'}}>
                Más de 1,800 productos personalizables para tu próxima campaña, kit
                de bienvenida o evento corporativo. Cotiza, aprueba arte y produce en
                una sola plataforma.
              </p>

              <div className="home-hero-actions fade-up" style={{animationDelay: '220ms'}}>
                <Button
                  variant="primary"
                  size="lg"
                  iconRight="arrow_right"
                  onClick={() => navigate('/catalogo')}
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

              <div className="home-hero-meta fade-up stagger" style={{animationDelay: '280ms'}}>
                <div>
                  <span className="n ticker"><CountUp to={1847} /></span>
                  <span className="l">Productos en catálogo</span>
                </div>
                <div>
                  <span className="n ticker"><CountUp to={12} suffix=" años" /></span>
                  <span className="l">En la industria</span>
                </div>
                <div>
                  <span className="n ticker"><CountUp to={420} suffix="+" /></span>
                  <span className="l">Clientes corporativos</span>
                </div>
                <div>
                  <span className="n ticker">8–15d</span>
                  <span className="l">Producción promedio</span>
                </div>
              </div>
            </div>

            <HeroCollage images={heroImages} featured={featured} isLoggedIn={isLoggedIn} />
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="section container" style={{paddingTop: 60}}>
        <div className="section-head">
          <div>
            <div className="eyebrow">// Catálogo · 01</div>
            <h2>Encuentra por categoría.</h2>
          </div>
          <p>
            Productos curados en grandes familias, todas con opciones de
            personalización.
          </p>
        </div>
        <ScrollReveal>
          <div className="cat-grid">
            {categoryCards.map((c) => (
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
      </section>

      {/* SERVICES */}
      <ServicesStrip />

      {/* FEATURED PRODUCTS */}
      <section className="section container" style={{paddingTop: 40}}>
        <div className="section-head">
          <div>
            <div className="eyebrow">// Destacados · 02</div>
            <h2>Lo más cotizado este mes.</h2>
          </div>
          <Button variant="ghost" iconRight="arrow_right" onClick={() => navigate('/catalogo')}>
            Ver todos los productos
          </Button>
        </div>
        <ScrollReveal>
          <div className="product-grid">
            {products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* FEATURED COLLECTIONS */}
      <section className="section container" style={{paddingTop: 40}}>
        <div className="section-head">
          <div>
            <div className="eyebrow">// Colecciones · 03</div>
            <h2>Líneas curadas para campañas precisas.</h2>
          </div>
          <p>
            Cada colección une calidad, oferta y propósito. Diseñadas por nuestro
            equipo creativo.
          </p>
        </div>
        <ScrollReveal>
          <div className="collections">
            {featuredCollections.map((c, i) => (
              <div
                key={c.handle}
                className={`coll-card ${i === 0 ? 'coll-card-large' : ''}`}
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
                  <PH
                    src={c.image}
                    alt={c.title}
                    zoom
                    className={i === 0 ? '' : 'ph-square'}
                  />
                  <div className="coll-card-tag">// {String(i + 1).padStart(2, '0')}</div>
                </div>
                <div className="coll-card-info">
                  <div>
                    <div className="coll-card-name">{c.title}</div>
                    <div className="coll-card-meta">
                      {c.description?.slice(0, 60) || 'Colección curada'}
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
          <Button
            variant="ghost"
            size="lg"
            iconRight="arrow_right"
            onClick={() => navigate('/collections')}
          >
            Ver todas las colecciones
          </Button>
        </div>
      </section>

      {/* ABOUT TEASER */}
      <AboutTeaser />

      {/* HOW IT WORKS */}
      <section className="section container">
        <div className="how">
          <div className="how-bg">
            <img src={LIFESTYLE.team} alt="" />
          </div>
          <div className="how-head">
            <div className="eyebrow">// Proceso · 04</div>
            <h2>
              De la idea al inventario,<br />en una plataforma.
            </h2>
          </div>
          <div className="how-steps">
            {[
              {num: '01', title: 'Explora el catálogo', desc: '1,800+ productos visibles. Crea favoritos y compara sin registro previo.'},
              {num: '02', title: 'Solicita tu cotización', desc: 'Agrega productos a tu lista y envíala a un asesor con un clic. Te respondemos con precios por proyecto.'},
              {num: '03', title: 'Aprueba arte', desc: 'Subes tu logo, preparamos dummies digitales para tu validación en 24h.'},
              {num: '04', title: 'Recibe y rastrea', desc: 'Coordinamos la producción y el envío de tu pedido con seguimiento en cada etapa.'},
            ].map((s) => (
              <div key={s.num} className="how-step">
                <div className="num">{s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLIENT TESTIMONIALS */}
      <ClientTestimonials />

      {/* LOOKBOOK */}
      <section className="section container" style={{paddingTop: 40}}>
        <div className="section-head">
          <div>
            <div className="eyebrow">// Lookbook · 05</div>
            <h2>Ediciones curadas por temporada.</h2>
          </div>
          <Button variant="ghost" iconRight="arrow_right" onClick={() => navigate('/lookbook')}>
            Ver lookbook completo
          </Button>
        </div>
        <LookbookGrid limit={6} />
      </section>

      {/* BIG CTA */}
      <section className="container">
        <div className="big-cta-photo">
          <div className="big-cta-bg">
            <img src={LIFESTYLE.unboxing} alt="" />
          </div>
          <div className="big-cta-overlay" />
          <div style={{position: 'relative'}}>
            <div className="eyebrow" style={{color: 'var(--accent)'}}>
              // Empieza hoy
            </div>
            <h2 style={{marginTop: 16}}>
              Tu próxima campaña<br />
              empieza con un{' '}
              <em style={{fontStyle: 'italic', fontWeight: 400, color: 'var(--accent)'}}>
                clic
              </em>
              .
            </h2>
            <div className="actions" style={{position: 'relative'}}>
              <Button
                variant="accent"
                size="lg"
                iconRight="arrow_right"
                onClick={() => navigate(isLoggedIn ? '/catalogo' : '/registro')}
              >
                {isLoggedIn ? 'Ver catálogo' : 'Crear cuenta gratis'}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                icon="chat"
                onClick={() => navigate('/contacto')}
                style={{
                  color: 'var(--bg-elev)',
                  borderColor: 'rgba(244,242,236,0.3)',
                  background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                Agendar demo
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
