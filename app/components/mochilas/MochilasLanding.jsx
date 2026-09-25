import {useEffect, useRef, useState} from 'react';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {MochilaForm} from './MochilaForm.jsx';

// Copy por línea; una línea nueva en LINES sin copy aquí se muestra sólo con
// su nombre y sus modelos.
const LINE_COPY = {
  takayama: {
    tagline: 'Diseño urbano con materiales técnicos, pensada para moverte todos los días.',
    attrs: [
      {t: 'Repelentes al agua', d: 'Materiales de alta resistencia que protegen lo que llevas.'},
      {t: 'Telas balísticas', d: 'Tejidos pensados para el uso diario, sin perder forma.'},
      {t: 'Diseños anti-robo', d: 'Modelos con apertura trasera y compartimentos ocultos.'},
      {t: 'Listas para tu laptop', d: 'Compartimentos acolchados para equipo y accesorios.'},
    ],
  },
  wagner: {
    tagline: 'Estructura sólida y acabados en curpiel para quien carga de todo.',
    attrs: [
      {t: 'Estructura resistente', d: 'Mantiene su forma aunque la llenes.'},
      {t: 'Curpiel texturizado', d: 'Detalles que se ven bien y aguantan el uso.'},
      {t: 'Repelentes al agua', d: 'Poliéster de alta resistencia contra la lluvia.'},
      {t: 'Bolsas laterales con malla', d: 'Tu botella y lo esencial siempre a la mano.'},
    ],
  },
};

function Chips({product, variant, onColor}) {
  return (
    <div className="mc-chips" role="group" aria-label={`Colores de ${product.name}`}>
      {product.variants.map((v) => (
        <button
          key={v.id}
          type="button"
          className={`mc-chip${v.id === variant.id ? ' is-on' : ''}`}
          aria-pressed={v.id === variant.id}
          onClick={() => onColor(product.id, v.id)}
        >
          {v.color}
        </button>
      ))}
    </div>
  );
}

function ModelCard({product, activeVariantId, onColor, onOpen, isChosen}) {
  const variant = product.variants.find((v) => v.id === activeVariantId) ?? product.variants[0];
  return (
    <article className={`mc-card${isChosen ? ' is-chosen' : ''}`} data-mc-card>
      <button type="button" className="mc-card-media" onClick={() => onOpen(product.id)}>
        {variant.image ? (
          <img
            src={variant.image}
            alt={variant.imageAlt ?? `${product.name} ${variant.color}`}
            loading="lazy"
            width="480"
            height="480"
          />
        ) : null}
        {isChosen ? <span className="mc-badge">Tu elección</span> : null}
      </button>
      <div className="mc-card-body">
        <h3>{product.name}</h3>
        <Chips product={product} variant={variant} onColor={onColor} />
        <button type="button" className="mc-link" onClick={() => onOpen(product.id)}>
          Ver detalle
        </button>
      </div>
    </article>
  );
}

function Detail({lineName, product, activeVariantId, onColor, onChoose, onClose}) {
  const variant = product.variants.find((v) => v.id === activeVariantId) ?? product.variants[0];
  const closeRef = useRef(null);
  // onClose cambia en cada render del padre: se lee por ref para que el foco
  // inicial y el listener de Escape no se reinstalen al cambiar de color.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="mc-overlay">
      {/* Fondo clicable como botón real; el teclado cierra con Escape o con la X. */}
      <button
        type="button"
        className="mc-backdrop"
        aria-label="Cerrar detalle"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        className="mc-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mc-detail-title"
        data-lenis-prevent
      >
        <button
          ref={closeRef}
          type="button"
          className="mc-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>
        <div className="mc-detail-media">
          {variant.image ? (
            <img src={variant.image} alt={`${product.name} ${variant.color}`} />
          ) : null}
        </div>
        <div className="mc-detail-body">
          <span className="eyebrow">{lineName}</span>
          <h3 id="mc-detail-title">{product.name}</h3>
          <p>{product.description}</p>
          <Chips product={product} variant={variant} onColor={onColor} />
          <button type="button" className="mc-submit" onClick={() => onChoose(variant.id)}>
            Elegir esta
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MochilasLanding({lines, collaborator}) {
  const [activeByProduct, setActiveByProduct] = useState({});
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [openId, setOpenId] = useState(null);
  const formRef = useRef(null);
  const rootRef = useRef(null);

  const findProduct = (pred) => {
    for (const line of lines) {
      const product = line.products.find(pred);
      if (product) return {line, product};
    }
    return null;
  };

  const chosen = findProduct((p) => p.variants.some((v) => v.id === selectedVariantId));
  const open = openId ? findProduct((p) => p.id === openId) : null;
  const total = lines.reduce((n, l) => n + l.products.length, 0);

  const setColor = (productId, variantId) =>
    setActiveByProduct((m) => ({...m, [productId]: variantId}));

  // Desde el select sólo se marca; desde una tarjeta o el detalle, además se
  // baja al formulario.
  const select = (variantId) => {
    setSelectedVariantId(variantId);
    const hit = findProduct((p) => p.variants.some((v) => v.id === variantId));
    if (hit) setColor(hit.product.id, variantId);
  };
  const choose = (variantId) => {
    select(variantId);
    setOpenId(null);
    formRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
  };

  useEffect(() => {
    let ctx;
    import('~/lib/motion').then(({gsap, ScrollTrigger, prefersReducedMotion}) => {
      if (prefersReducedMotion() || !rootRef.current) return;
      ctx = gsap.context(() => {
        gsap.from('.mc-hero-line', {
          yPercent: 110,
          opacity: 0,
          duration: 1,
          stagger: 0.12,
          ease: 'expo.out',
        });
        ScrollTrigger.batch('[data-mc-card]', {
          start: 'top 88%',
          once: true,
          onEnter: (els) =>
            gsap.from(els, {y: 40, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out'}),
        });
      }, rootRef);
    });
    return () => ctx?.revert();
  }, []);

  const firstName = collaborator.fullName.split(' ')[0];

  return (
    <MarketingLayout className="mc-page">
      <div ref={rootRef}>
        <section className="section mc-hero">
          <div className="wrap">
            <span className="eyebrow">Para el equipo Generando Ideas</span>
            <h1 className="display mc-hero-title">
              <span className="mc-hero-mask">
                <span className="mc-hero-line">Elige tu</span>
              </span>{' '}
              <span className="mc-hero-mask">
                <span className="mc-hero-line text-grad-word">mochila</span>
              </span>
            </h1>
            <p className="mc-lede">
              {firstName ? `${firstName}, ` : ''}gracias a nuestro proveedor, cada colaborador puede
              elegir una mochila de las líneas {lines.map((l) => l.name).join(' y ')}. Explora los
              modelos, elige la tuya y déjanos tus datos para entregártela.
            </p>
            <nav className="mc-jump" aria-label="Líneas">
              {lines.map((l) => (
                <a key={l.id} href={`#${l.id}`} className="mc-jump-link">
                  <span>{l.name}</span>
                  <small>{l.products.length} modelos</small>
                </a>
              ))}
            </nav>
          </div>
        </section>

        {total === 0 ? (
          <section className="section">
            <div className="wrap">
              <p className="mc-muted">
                Por ahora no hay modelos disponibles. Vuelve a intentarlo más tarde.
              </p>
            </div>
          </section>
        ) : null}

        {lines.map((line, i) => {
          const copy = LINE_COPY[line.id];
          return (
            <section
              key={line.id}
              id={line.id}
              className={`section mc-line${i % 2 === 1 ? ' section-alt' : ''}`}
            >
              <div className="wrap">
                <span className="eyebrow reveal">Línea</span>
                <h2 className="display mc-line-title reveal">{line.name}</h2>
                {copy ? <p className="mc-lede reveal">{copy.tagline}</p> : null}
                {copy ? (
                  <div className="mc-attrs">
                    {copy.attrs.map((a) => (
                      <div key={a.t} className="mc-attr reveal">
                        <h3>{a.t}</h3>
                        <p>{a.d}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mc-cards">
                  {line.products.map((p) => (
                    <ModelCard
                      key={p.id}
                      product={p}
                      activeVariantId={activeByProduct[p.id]}
                      onColor={setColor}
                      onOpen={setOpenId}
                      isChosen={p.id === chosen?.product.id}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}

        <section className="section section-soft" id="formulario" ref={formRef}>
          <div className="wrap mc-form-wrap">
            <span className="eyebrow">Último paso</span>
            <h2>Tus datos de entrega</h2>
            <MochilaForm
              lines={lines}
              collaborator={collaborator}
              selectedVariantId={selectedVariantId}
              onSelectVariant={select}
            />
          </div>
        </section>
      </div>

      {open ? (
        <Detail
          lineName={open.line.name}
          product={open.product}
          activeVariantId={activeByProduct[open.product.id]}
          onColor={setColor}
          onChoose={choose}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </MarketingLayout>
  );
}
