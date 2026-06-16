import {useEffect, useMemo, useState} from 'react';
import {
  getMeasures,
  calcDecoration,
  resolveTechniqueKey,
} from '~/lib/decoration/engine.js';

const SIN_DECORADO = 'Sin decorado';

/**
 * PDP decoration picker. ONE matrix-powered control: technique + size as chips.
 * It renders NO prices — the PDP price bar shows the single integrated unit
 * price + total. Emits {technique, surface, size, qty}; renders nothing when
 * the product has no techniques (graceful degradation).
 */
export default function DecorationSelector({product, qty, onChange}) {
  const techniques = useMemo(() => product?.techniques || [], [product?.techniques]);
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

  // Evaluated only to detect an invalid combination (data-deco-error); the
  // resulting price is shown by the PDP, not here.
  const calc = useMemo(() => {
    if (!technique) return null;
    if (technique === SIN_DECORADO) {
      return calcDecoration(SIN_DECORADO, surface, qty, 'N/A');
    }
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

  return (
    <div
      className="deco-selector"
      data-testid="decoration-selector"
      data-deco-error={hasError ? 'true' : 'false'}
      style={{display: 'flex', flexDirection: 'column', gap: 'var(--s-4)'}}
    >
      <div className="field">
        <span className="field-label" id="deco-tech-label">Elige tipo de decorado</span>
        <div className="pdp-printtech" role="group" aria-labelledby="deco-tech-label">
          <button
            type="button"
            className={technique === SIN_DECORADO ? 'active' : ''}
            onClick={() => pickTechnique(SIN_DECORADO)}
          >
            <span>{SIN_DECORADO}</span>
          </button>
          {available.map((t) => (
            <button
              type="button"
              key={t}
              className={technique === t ? 'active' : ''}
              onClick={() => pickTechnique(t)}
            >
              <span>{t}</span>
            </button>
          ))}
        </div>
      </div>

      {technique && technique !== SIN_DECORADO && (
        <div className="field">
          <span className="field-label" id="deco-size-label">Elige la medida</span>
          <div className="pdp-printtech" role="group" aria-labelledby="deco-size-label">
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

      {hasError && (
        <p className="error-msg" role="alert" data-testid="deco-error">
          {calc.error}
        </p>
      )}
    </div>
  );
}
