import {useEffect, useMemo, useState} from 'react';
import {
  getMeasures,
  calcDecoration,
  effectiveUnitPrice,
  round2,
} from '~/lib/decoration/engine.js';

const SIN_DECORADO = 'Sin decorado';

function fmt(n) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * PDP decoration selector. Display-only numbers; emits {technique, surface, size, qty}.
 * Renders nothing when the product has no techniques (graceful degradation).
 */
export default function DecorationSelector({product, basePrice, qty, onChange}) {
  const techniques = product?.techniques || [];
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
    // Evaluate even before a measure is picked so technique/surface errors
    // (checked ahead of the measure lookup in calcDecoration) surface
    // immediately. A successful price still requires a real measure.
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

  function handleTechnique(e) {
    setTechnique(e.target.value);
    setSize('');
  }

  function handleSize(e) {
    setSize(e.target.value);
  }

  const showPrice = Boolean(calc && !calc.error);
  const unitPrice = showPrice
    ? round2(effectiveUnitPrice(basePrice, calc.totalPrice, qty))
    : null;
  const decoPerUnit = showPrice ? round2(calc.unitPrice) : null;

  return (
    <div data-testid="decoration-selector" data-deco-error={hasError ? 'true' : 'false'}>
      <label htmlFor="gi-decorado-select">Elige tipo de decorado:</label>
      <select id="gi-decorado-select" value={technique} onChange={handleTechnique}>
        <option value="" disabled>
          Seleccione técnica de impresión
        </option>
        <option value={SIN_DECORADO}>{SIN_DECORADO}</option>
        {techniques.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <label htmlFor="gi-medida-select">Elige la medida:</label>
      <select
        id="gi-medida-select"
        value={effectiveSize === 'N/A' ? '' : size}
        onChange={handleSize}
        disabled={technique === '' || technique === SIN_DECORADO}
      >
        <option value="" disabled>
          {technique === SIN_DECORADO ? 'N/A' : 'Seleccione medida'}
        </option>
        {measures.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {hasError && (
        <p role="alert" data-testid="deco-error">
          {calc.error}
        </p>
      )}

      {showPrice && (
        <div>
          <p data-testid="deco-unit-price">$ {fmt(unitPrice)} MXN</p>
          {technique !== SIN_DECORADO && (
            <p data-testid="deco-included">incluye decorado ${fmt(decoPerUnit)}/pz</p>
          )}
          {technique !== SIN_DECORADO && !calc.isMinPriceUsed && (
            <p data-testid="deco-fixed-charge">
              Cargo fijo de decorado ${fmt(calc.totalPrice)}; alcanza {calc.neededQtyForMin} piezas
              para precio por unidad
            </p>
          )}
        </div>
      )}
    </div>
  );
}
