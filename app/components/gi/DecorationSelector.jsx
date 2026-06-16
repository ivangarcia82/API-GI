import {useEffect, useMemo, useState} from 'react';
import {
  getMeasures,
  calcDecoration,
  effectiveUnitPrice,
  round2,
  resolveTechniqueKey,
  resolveSurfaceKey,
  PRICE_MATRIX,
} from '~/lib/decoration/engine.js';

const SIN_DECORADO = 'Sin decorado';

function fmt(n) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "desde $X/pz" teaser for a technique on the product's (possibly fallback)
 *  surface: the cheapest per-unit decoration at scale (min precioMinimo / 0.67). */
function fromUnitPrice(technique, surface) {
  const tk = resolveTechniqueKey(technique);
  if (!tk) return null;
  const {key} = resolveSurfaceKey(tk, surface);
  if (!key) return null;
  const minMin = Math.min(...PRICE_MATRIX[tk][key].map((r) => r.precioMinimo));
  return round2(minMin / 0.67);
}

/**
 * PDP decoration selector. ONE matrix-powered control: technique + size are
 * picked as chips (no separate static "técnicas" block). Display-only numbers;
 * emits {technique, surface, size, qty}. Renders nothing when the product has
 * no techniques (graceful degradation).
 */
export default function DecorationSelector({product, basePrice, qty, onChange}) {
  const techniques = product?.techniques || [];
  // Only offer techniques that exist in the price matrix; non-standard ones
  // (no pricing entry) are intentionally omitted — they're audited separately.
  const available = useMemo(
    () => techniques.filter((t) => resolveTechniqueKey(t)),
    [techniques],
  );
  const surface = product?.surface || '';
  const [technique, setTechnique] = useState('');
  const [size, setSize] = useState('');

  const measures = useMemo(
    () => (technique && technique !== SIN_DECORADO ? getMeasures(technique, surface) : []),
    [technique, surface],
  );

  const effectiveSize = technique === SIN_DECORADO ? 'N/A' : size;

  const calc = useMemo(() => {
    if (!technique) return null;
    if (technique === SIN_DECORADO) {
      return calcDecoration(SIN_DECORADO, surface, qty, 'N/A');
    }
    // Evaluate even before a measure is picked so technique errors surface
    // immediately; a real price still requires a chosen measure.
    const r = calcDecoration(technique, surface, qty, size);
    if (!r.error && !size) return null;
    return r;
  }, [technique, surface, qty, size]);

  const hasError = Boolean(calc && calc.error);

  useEffect(() => {
    if (!technique) return;
    if (technique !== SIN_DECORADO && !size) return;
    onChange({technique, surface, size: effectiveSize, qty});
  }, [technique, surface, size, qty, effectiveSize, onChange]);

  if (techniques.length === 0) return null;

  function pickTechnique(t) {
    setTechnique(t);
    setSize('');
  }

  const showPrice = Boolean(calc && !calc.error);
  const unitPrice = showPrice
    ? round2(effectiveUnitPrice(basePrice, calc.totalPrice, qty))
    : null;
  const decoPerUnit = showPrice ? round2(calc.unitPrice) : null;
  const usedFallback = Boolean(
    showPrice && calc.surfaceFallback && technique !== SIN_DECORADO,
  );

  return (
    <div
      className="deco-selector"
      data-testid="decoration-selector"
      data-deco-error={hasError ? 'true' : 'false'}
      style={{display: 'flex', flexDirection: 'column', gap: 'var(--s-4)'}}
    >
      <div className="field">
        <label id="deco-tech-label">Elige tipo de decorado</label>
        <div
          className="pdp-printtech"
          role="group"
          aria-labelledby="deco-tech-label"
        >
          <button
            type="button"
            className={technique === SIN_DECORADO ? 'active' : ''}
            onClick={() => pickTechnique(SIN_DECORADO)}
          >
            <span>{SIN_DECORADO}</span>
          </button>
          {available.map((t) => {
            const from = fromUnitPrice(t, surface);
            return (
              <button
                type="button"
                key={t}
                className={technique === t ? 'active' : ''}
                onClick={() => pickTechnique(t)}
              >
                <span>{t}</span>
                {from != null && <span className="pt-cost">desde ${fmt(from)}/pz</span>}
              </button>
            );
          })}
        </div>
      </div>

      {technique && technique !== SIN_DECORADO && (
        <div className="field">
          <label id="deco-size-label">Elige la medida</label>
          <div
            className="pdp-printtech"
            role="group"
            aria-labelledby="deco-size-label"
          >
            {measures.map((m) => (
              <button
                type="button"
                key={m}
                className={size === m ? 'active' : ''}
                onClick={() => setSize(m)}
              >
                <span>{m}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {usedFallback && (
        <p className="help-msg" data-testid="deco-fallback">
          Material no estándar — cotizado con “{calc.surfaceUsed}” (tarifa más alta).
          El asesor lo ajustará si aplica.
        </p>
      )}

      {hasError && (
        <p className="error-msg" role="alert" data-testid="deco-error">
          {calc.error}
        </p>
      )}

      {showPrice && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            paddingTop: 'var(--s-3)',
            borderTop: '1px solid var(--line)',
          }}
        >
          <p
            data-testid="deco-unit-price"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 22,
              color: 'var(--ink)',
            }}
          >
            $ {fmt(unitPrice)} MXN
          </p>
          {technique !== SIN_DECORADO && (
            <p className="help-msg" data-testid="deco-included">
              incluye decorado ${fmt(decoPerUnit)}/pz
            </p>
          )}
          {technique !== SIN_DECORADO && !calc.isMinPriceUsed && (
            <p className="help-msg" data-testid="deco-fixed-charge">
              Cargo fijo de decorado ${fmt(calc.totalPrice)}; alcanza {calc.neededQtyForMin}{' '}
              piezas para precio por unidad
            </p>
          )}
        </div>
      )}
    </div>
  );
}
