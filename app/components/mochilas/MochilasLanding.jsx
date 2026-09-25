import {useEffect, useRef, useState} from 'react';
import {useFetcher} from 'react-router';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {Icon} from '~/components/gi/Icon';
import {MOCHILAS_DEFAULT_TO} from '~/lib/mochilas/email';
import {MochilaForm} from './MochilaForm.jsx';
import {ModelCard} from './ModelCard.jsx';
import {ModelDetail} from './ModelDetail.jsx';
import {SelectionBar} from './SelectionBar.jsx';
import {RequestDone} from './RequestDone.jsx';

// Copy por línea; una línea nueva en LINES sin copy aquí se muestra sólo con
// su nombre y sus modelos.
const LINE_COPY = {
  takayama: {
    tagline: 'Diseño urbano con materiales técnicos, para moverte todos los días.',
    attrs: ['Repelentes al agua', 'Telas balísticas', 'Modelos anti-robo', 'Espacio para laptop'],
  },
  wagner: {
    tagline: 'Estructura sólida y acabados en curpiel para quien carga de todo.',
    attrs: [
      'Estructura resistente',
      'Curpiel texturizado',
      'Repelentes al agua',
      'Bolsas laterales con malla',
    ],
  },
};

const PASOS = [
  {t: 'Elige tu mochila', d: 'Una por colaborador, de la línea que más te guste.'},
  {t: 'Déjanos tus datos', d: 'La recoges en la oficina o, si eres foráneo, te la enviamos.'},
  {t: 'Te avisamos', d: 'Te escribimos cuando esté lista para entregártela.'},
];

function scrollToEl(el) {
  if (!el) return;
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView?.({behavior: reduce ? 'auto' : 'smooth', block: 'start'});
}

function findIn(lines, pred) {
  for (const line of lines) {
    for (const product of line.products) {
      if (pred(product)) return {line, product};
    }
  }
  return null;
}

/** Tres fotos reales para la portada: el primero de cada línea y luego el resto. */
function heroPicks(lines) {
  const picks = [];
  const add = (p) => {
    if (p && p.variants[0]?.image && !picks.includes(p)) picks.push(p);
  };
  lines.forEach((l) => add(l.products[0]));
  lines.forEach((l) => l.products.slice(1).forEach(add));
  return picks.slice(0, 3);
}

function LineTabs({lines, activeId, onSelect}) {
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = lines.findIndex((l) => l.id === activeId);
    const step = e.key === 'ArrowRight' ? 1 : lines.length - 1;
    const next = lines[(i + step) % lines.length];
    onSelect(next.id);
    document.getElementById(`mc-tab-${next.id}`)?.focus();
  };
  return (
    // El tablist recibe las flechas (patrón ARIA de pestañas); cada tab es un botón.
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div className="mc-tabs" role="tablist" aria-label="Líneas" onKeyDown={onKeyDown}>
      {lines.map((l) => {
        const on = l.id === activeId;
        return (
          <button
            key={l.id}
            id={`mc-tab-${l.id}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls="mc-panel"
            tabIndex={on ? 0 : -1}
            className={`mc-tab${on ? ' is-on' : ''}`}
            onClick={() => onSelect(l.id)}
          >
            {l.name}
            <span className="mc-tab-count">{l.products.length}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function MochilasLanding({lines, collaborator}) {
  const fetcher = useFetcher();
  const [activeLineId, setActiveLineId] = useState(lines[0]?.id ?? null);
  const [activeByProduct, setActiveByProduct] = useState({});
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [openId, setOpenId] = useState(null);
  const [formInView, setFormInView] = useState(false);
  const modelsRef = useRef(null);
  const formRef = useRef(null);
  const done = Boolean(fetcher.data?.ok);

  // La barra se esconde cuando el formulario ya está a la vista.
  useEffect(() => {
    const el = formRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setFormInView(e.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [done]);

  if (done) {
    return (
      <MarketingLayout className="mc-page">
        <RequestDone request={fetcher.data.summary} collaborator={collaborator} />
      </MarketingLayout>
    );
  }

  const activeLine = lines.find((l) => l.id === activeLineId) ?? lines[0];
  const chosen = findIn(lines, (p) => p.variants.some((v) => v.id === selectedVariantId));
  const selection = chosen
    ? {...chosen, variant: chosen.product.variants.find((v) => v.id === selectedVariantId)}
    : null;
  const open = openId ? findIn(lines, (p) => p.id === openId) : null;
  const copy = activeLine ? LINE_COPY[activeLine.id] : null;
  const picks = heroPicks(lines);
  const firstName = collaborator.fullName.split(' ')[0];

  const setColor = (productId, variantId) =>
    setActiveByProduct((m) => ({...m, [productId]: variantId}));
  const choose = (variantId) => {
    setSelectedVariantId(variantId);
    const hit = findIn(lines, (p) => p.variants.some((v) => v.id === variantId));
    if (hit) setColor(hit.product.id, variantId);
    setOpenId(null);
  };

  return (
    <MarketingLayout className="mc-page">
      <section className="mc-hero">
        <div className="mc-wrap mc-hero-grid">
          <div className="mc-hero-copy">
            <h1 className="mc-hero-title">
              Elige tu mochila. <span className="mc-accent">Es para ti.</span>
            </h1>
            <p className="mc-lede">
              {firstName ? `${firstName}, gracias` : 'Gracias'} a nuestro proveedor, cada colaborador de
              Generando Ideas puede llevarse una mochila de{' '}
              {lines.length > 1
                ? `las líneas ${lines.map((l) => l.name).join(' y ')}`
                : `la línea ${lines[0]?.name ?? ''}`}
              .
            </p>
            <button
              type="button"
              className="mc-btn mc-btn-primary mc-btn-lg"
              onClick={() => scrollToEl(modelsRef.current)}
            >
              Ver modelos
              <Icon name="arrow_right" size={18} strokeWidth={2.2} />
            </button>
          </div>
          {picks.length ? (
            <div className="mc-hero-stack" aria-hidden="true">
              {picks.map((p, i) => (
                <img
                  key={p.id}
                  className={`mc-hero-photo mc-hero-photo-${i + 1}`}
                  src={p.variants[0].image}
                  alt=""
                  width="420"
                  height="525"
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="mc-wrap">
          <ol className="mc-steps" aria-label="Cómo funciona">
            {PASOS.map((s, i) => (
              <li key={s.t} className="mc-step">
                <span className="mc-step-n" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h2 className="mc-step-title">{s.t}</h2>
                  <p className="mc-step-text">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mc-help">
            ¿Dudas? Escribe a <a href={`mailto:${MOCHILAS_DEFAULT_TO}`}>{MOCHILAS_DEFAULT_TO}</a>.
          </p>
        </div>
      </section>

      <section className="mc-models" ref={modelsRef} id="modelos" aria-labelledby="mc-models-title">
        <div className="mc-wrap">
          <div className="mc-models-head">
            <h2 id="mc-models-title" className="mc-models-title">
              Los modelos
            </h2>
            {lines.length > 1 ? (
              <LineTabs lines={lines} activeId={activeLine?.id} onSelect={setActiveLineId} />
            ) : null}
          </div>

          {!activeLine ? (
            <p className="mc-empty">
              Por ahora no hay modelos disponibles. Vuelve a intentarlo más tarde.
            </p>
          ) : (
            <div
              id="mc-panel"
              role={lines.length > 1 ? 'tabpanel' : undefined}
              aria-labelledby={lines.length > 1 ? `mc-tab-${activeLine.id}` : undefined}
              key={activeLine.id}
              className="mc-panel"
            >
              <div className="mc-line-intro">
                {copy ? <p className="mc-line-tagline">{copy.tagline}</p> : null}
                {copy ? (
                  <ul className="mc-line-attrs">
                    {copy.attrs.map((a) => (
                      <li key={a}>
                        <Icon name="check" size={16} strokeWidth={2.4} />
                        {a}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="mc-cards">
                {activeLine.products.map((p) => (
                  <ModelCard
                    key={p.id}
                    product={p}
                    variantId={activeByProduct[p.id]}
                    isChosen={p.id === chosen?.product.id}
                    onColor={setColor}
                    onChoose={choose}
                    onOpen={setOpenId}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section
        className="mc-form-band"
        id="formulario"
        ref={formRef}
        aria-labelledby="mc-form-title"
      >
        <div className="mc-form-card">
          <h2 id="mc-form-title" className="mc-form-title">
            Tus datos de entrega
          </h2>
          <MochilaForm
            fetcher={fetcher}
            collaborator={collaborator}
            selection={selection}
            onChange={() => scrollToEl(modelsRef.current)}
          />
        </div>
      </section>

      {selection && !formInView ? (
        <SelectionBar selection={selection} onContinue={() => scrollToEl(formRef.current)} />
      ) : null}

      {open ? (
        <ModelDetail
          lineName={open.line.name}
          product={open.product}
          variantId={activeByProduct[open.product.id]}
          onColor={setColor}
          onChoose={choose}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </MarketingLayout>
  );
}
