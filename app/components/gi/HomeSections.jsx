/* Generando Ideas — home page sections (hero, marquee, spotlight,
   lookbook, stats band, customizer, FAQ) */
import {useState, useEffect, useRef} from 'react';
import {useNavigate} from 'react-router';
import {Icon} from './Icon';
import {Button, CountUp, useInView} from './ui';
import {AddControl} from './ProductCard';
import {useApp} from '~/lib/AppContext';
import {formatPrice, LOOKBOOK} from '~/lib/gi';

/* ---- scroll parallax ---- */
function useParallax(strength = 0.1) {
  const ref = useRef(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          setOffset(-(center - window.innerHeight / 2) * strength);
        }
        raf = null;
      });
    };
    window.addEventListener('scroll', onScroll, {passive: true});
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [strength]);
  return [ref, offset];
}

/* ---- rotating hero collage ---- */
export function HeroCollage({images = [], featured, isLoggedIn}) {
  const [idx, setIdx] = useState(0);
  const pool = images.length ? images : [null];
  useEffect(() => {
    if (pool.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % pool.length), 3200);
    return () => clearInterval(t);
  }, [pool.length]);

  const secondary = pool[(idx + 2) % pool.length];
  const tertiary = pool[(idx + 4) % pool.length];

  return (
    <div className="hero-collage">
      <div className="hc-main">
        {pool.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            style={{
              opacity: i === idx ? 1 : 0,
              transform: i === idx ? 'scale(1)' : 'scale(1.04)',
            }}
          />
        ))}
        {featured && (
          <div className="hc-main-meta">
            <div>
              <div className="hc-sku">{featured.sku}</div>
              <div className="hc-name">{featured.title}</div>
            </div>
            <div className="hc-pr">
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  opacity: 0.6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {isLoggedIn ? 'Desde' : 'Cliente'}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                {isLoggedIn ? formatPrice(featured.price, featured.currency) : '— —'}
              </span>
            </div>
          </div>
        )}
        <div className="hc-main-dots">
          {pool.map((src, i) => (
            <button
              key={src}
              className={i === idx ? 'on' : ''}
              onClick={() => setIdx(i)}
              aria-label={`Producto ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="hc-float hc-float-1">
        <img src={secondary} alt="" />
      </div>
      <div className="hc-float hc-float-2">
        <img src={tertiary} alt="" />
      </div>

      <div className="hc-chip hc-chip-1">
        <Icon name="bolt" size={14} />
        <div>
          <div className="hc-chip-l">Producción</div>
          <div className="hc-chip-v">Nacional</div>
        </div>
      </div>
      <div className="hc-chip hc-chip-2">
        <Icon name="package" size={14} />
        <div>
          <div className="hc-chip-l">Catálogo</div>
          <div className="hc-chip-v">1,800+ SKUs</div>
        </div>
      </div>

      <svg className="hc-orbit" viewBox="0 0 400 400" fill="none">
        <circle
          cx="200"
          cy="200"
          r="180"
          stroke="var(--accent)"
          strokeWidth="1"
          strokeDasharray="2 6"
        />
      </svg>
    </div>
  );
}

/* ---- infinite product marquee ---- */
export function ImageMarquee({products = [], direction = 'left', speed = 50}) {
  const items = products.filter((p) => p.image).slice(0, 12);
  if (!items.length) return null;
  const duplicated = [...items, ...items];
  return (
    <div className="img-marquee">
      <div
        className="img-marquee-track"
        style={{
          animationDuration: `${speed}s`,
          animationDirection: direction === 'right' ? 'reverse' : 'normal',
        }}
      >
        {duplicated.map((p, i) => (
          // eslint-disable-next-line react/no-array-index-key -- marquee intentionally repeats items
          <div key={`${p.sku ?? p.title}-${i}`} className="img-marquee-item">
            <img src={p.image} alt={p.title} loading="lazy" />
            <div className="img-marquee-label">
              <span className="mm-sku">{p.sku}</span>
              <span className="mm-nm">{p.title}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- product spotlight ---- */
export function ProductSpotlight({product}) {
  const navigate = useNavigate();
  const {isLoggedIn} = useApp();
  const [imgRef, imgOffset] = useParallax(0.08);
  const [ref, inView] = useInView();
  if (!product) return null;

  const specs = [
    {l: 'Material', v: product.surface || 'Premium'},
    {l: 'Personalización', v: 'Láser / Serigrafía'},
    {l: 'Garantía', v: 'Reposición s/c'},
  ];

  return (
    <section className="spotlight" ref={ref}>
      <div className="spotlight-bg-text" aria-hidden="true">
        DESTACADO
      </div>
      <div className="container spotlight-inner">
        <div className="spotlight-media">
          <div className="spotlight-img-wrap">
            <img
              ref={imgRef}
              src={product.image}
              alt={product.title}
              style={{transform: `translateY(${imgOffset}px) scale(1.12)`}}
            />
          </div>
        </div>

        <div className="spotlight-info">
          <div className="eyebrow" style={{color: 'var(--accent-deep)'}}>
            // Producto destacado del mes
          </div>
          <h2 className="spotlight-title">{product.title}</h2>
          <p className="spotlight-desc">
            {product.description?.slice(0, 220) ||
              'El obsequio corporativo más solicitado por equipos de marketing. Personalízalo con tu logo y prodúcelo en volumen.'}
          </p>

          <div className="spotlight-specs">
            {specs.map((s, i) => (
              <div
                key={s.l}
                className="spotlight-spec"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'translateX(0)' : 'translateX(-12px)',
                  transition: `all 500ms cubic-bezier(0.16,1,0.3,1) ${i * 90 + 200}ms`,
                }}
              >
                <span className="ss-l">{s.l}</span>
                <span className="ss-v">{s.v}</span>
              </div>
            ))}
          </div>

          <div className="spotlight-foot">
            {isLoggedIn ? (
              <div className="spotlight-price">
                <span className="sp-from">Desde</span>
                <span className="sp-v">{formatPrice(product.price, product.currency)}</span>
                <span className="sp-unit">/ pieza</span>
              </div>
            ) : (
              <div className="spotlight-price">
                <span className="sp-from">Precio para clientes</span>
              </div>
            )}
            <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
              <AddControl
                product={product}
                size="lg"
                variant="accent"
                label="Cotizar ahora"
              />
              <Button
                variant="ghost"
                size="lg"
                iconRight="arrow_right"
                onClick={() => navigate(`/products/${product.handle}`)}
              >
                Ver producto
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- lookbook masonry ---- */
export function LookbookGrid({limit}) {
  const navigate = useNavigate();
  const items = limit ? LOOKBOOK.slice(0, limit) : LOOKBOOK;
  return (
    <div className="lookbook-grid">
      {items.map((lb, i) => (
        <LookbookCard
          key={lb.id}
          lb={lb}
          index={i}
          onClick={() => navigate(`/collections/${lb.collection}`)}
        />
      ))}
    </div>
  );
}

function LookbookCard({lb, index, onClick}) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`lookbook-card lb-${lb.span}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.98)',
        transition: `opacity 700ms cubic-bezier(0.16,1,0.3,1) ${index * 70}ms, transform 700ms cubic-bezier(0.16,1,0.3,1) ${index * 70}ms`,
      }}
    >
      <div className="lookbook-img">
        <img src={lb.image} alt={lb.title} loading="lazy" />
      </div>
      <div className="lookbook-overlay" />
      <div className="lookbook-top">
        <span className="lookbook-tag">{lb.tag}</span>
      </div>
      <div className="lookbook-bottom">
        <div className="lookbook-season">{lb.season}</div>
        <h3 className="lookbook-name">{lb.title}</h3>
        <div className="lookbook-cta">
          Ver edición <Icon name="arrow_right" size={14} />
        </div>
      </div>
    </div>
  );
}

/* ---- animated stats band ---- */
export function StatsBand() {
  const [ref, inView] = useInView();
  const stats = [
    {to: 1847, label: 'Productos en catálogo', suffix: ''},
    {to: 49, label: 'Colecciones curadas', suffix: ''},
    {to: 420, label: 'Clientes corporativos', suffix: '+'},
    {to: 98, label: 'Satisfacción del cliente', suffix: '%'},
  ];
  return (
    <section className="stats-band" ref={ref}>
      <div className="stats-band-glow" />
      <div className="container stats-band-inner">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="stats-band-item"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(16px)',
              transition: `all 600ms cubic-bezier(0.16,1,0.3,1) ${i * 100}ms`,
            }}
          >
            <div className="stats-band-n">
              {inView ? <CountUp to={s.to} suffix={s.suffix} /> : `0${s.suffix}`}
            </div>
            <div className="stats-band-l">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- interactive customizer ---- */
export function CustomizerSection({product}) {
  const navigate = useNavigate();
  const [color, setColor] = useState('#14110a');
  const [tech, setTech] = useState('Grabado láser');
  const [logoPos, setLogoPos] = useState('center');
  const [ref, inView] = useInView();
  if (!product) return null;

  const bgColors = [
    {hex: '#14110a', name: 'Negro'},
    {hex: '#f5b800', name: 'Ámbar'},
    {hex: '#1e4d8a', name: 'Azul'},
    {hex: '#5d6a3a', name: 'Olivo'},
    {hex: '#b3261e', name: 'Rojo'},
  ];

  return (
    <section className="customizer" ref={ref}>
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">// Personalización · interactivo</div>
            <h2>Marca tu producto en vivo.</h2>
          </div>
          <p>
            Elige color, técnica y posición del logo. Así de fácil es configurar
            antes de cotizar.
          </p>
        </div>

        <div className="customizer-stage">
          <div
            className="customizer-preview"
            style={{background: `linear-gradient(160deg, ${color}14, ${color}06)`}}
          >
            <div className="customizer-canvas">
              <div
                className="customizer-prod"
                style={{
                  transform: inView ? 'scale(1)' : 'scale(0.9)',
                  transition: 'transform 700ms cubic-bezier(0.16,1,0.3,1)',
                }}
              >
                <img src={product.image} alt={product.title} />
                <div className={`customizer-logo logo-${logoPos}`}>
                  <div
                    className="customizer-logo-mark"
                    style={{
                      borderColor:
                        tech === 'Grabado láser' ? 'rgba(255,255,255,0.6)' : color,
                    }}
                  >
                    <span style={{color: '#fff'}}>TU LOGO</span>
                  </div>
                </div>
              </div>
              <div className="customizer-tech-badge">{tech}</div>
            </div>
          </div>

          <div className="customizer-controls">
            <div className="customizer-prod-name">
              <div className="cpn-sku">{product.sku}</div>
              <div className="cpn-name">{product.title}</div>
            </div>

            <div className="customizer-group" role="group" aria-label="Color del producto">
              <span className="cz-group-label">Color del producto</span>
              <div className="customizer-swatches">
                {bgColors.map((c) => (
                  <button
                    key={c.hex}
                    className={`cz-swatch ${color === c.hex ? 'active' : ''}`}
                    style={{background: c.hex}}
                    onClick={() => setColor(c.hex)}
                    title={c.name}
                    aria-label={c.name}
                  />
                ))}
              </div>
            </div>

            <div className="customizer-group" role="group" aria-label="Técnica de marcado">
              <span className="cz-group-label">Técnica de marcado</span>
              <div className="customizer-segmented">
                {['Grabado láser', 'Serigrafía', 'Sublimación'].map((t) => (
                  <button
                    key={t}
                    className={tech === t ? 'active' : ''}
                    onClick={() => setTech(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="customizer-group" role="group" aria-label="Posición del logo">
              <span className="cz-group-label">Posición del logo</span>
              <div className="customizer-segmented">
                {[
                  {k: 'left', l: 'Izquierda'},
                  {k: 'center', l: 'Centro'},
                  {k: 'right', l: 'Derecha'},
                ].map((p) => (
                  <button
                    key={p.k}
                    className={logoPos === p.k ? 'active' : ''}
                    onClick={() => setLogoPos(p.k)}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="customizer-actions">
              <Button
                variant="primary"
                size="lg"
                iconRight="arrow_right"
                onClick={() => navigate(`/products/${product.handle}`)}
              >
                Configurar y cotizar
              </Button>
              <span className="customizer-hint">
                <Icon name="sparkle" size={13} /> Vista previa ilustrativa
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- FAQ accordion ---- */
export function FAQAccordion({items}) {
  const [open, setOpen] = useState(0);
  return (
    <div style={{display: 'flex', flexDirection: 'column'}}>
      {items.map((it, i) => (
        <div
          key={it.q}
          style={{
            borderTop: '1px solid var(--line)',
            borderBottom: i === items.length - 1 ? '1px solid var(--line)' : 'none',
          }}
        >
          <button
            onClick={() => setOpen(open === i ? -1 : i)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px 0',
              textAlign: 'left',
              gap: 16,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '-0.015em',
                lineHeight: 1.2,
              }}
            >
              {it.q}
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: open === i ? 'var(--ink)' : 'var(--bg-soft)',
                color: open === i ? 'var(--bg-elev)' : 'var(--ink)',
                transition: 'all 220ms cubic-bezier(0.16,1,0.3,1)',
                transform: open === i ? 'rotate(45deg)' : 'rotate(0deg)',
                flexShrink: 0,
              }}
            >
              <Icon name="plus" size={14} />
            </div>
          </button>
          <div
            style={{
              maxHeight: open === i ? 200 : 0,
              overflow: 'hidden',
              transition: 'max-height 400ms cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            <p style={{paddingBottom: 24, color: 'var(--ink-3)', margin: 0, maxWidth: 540}}>
              {it.a}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
