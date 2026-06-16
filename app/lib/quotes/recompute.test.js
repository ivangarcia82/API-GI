import {describe, it, expect} from 'vitest';
import {recomputeItemPricing} from './recompute.js';

describe('recomputeItemPricing', () => {
  it('integrates decoration into effective unit price (qty >= min)', () => {
    const r = recomputeItemPricing({
      baseUnitPrice: 25,
      technique: 'SERIGRAFÍA',
      surface: 'TEXTIL',
      size: '4 x 4',
      qty: 300,
    });
    expect(r.error).toBeNull();
    // decorationTotal = (300 * 3.33) / 0.67 = 1491.0447...
    expect(r.decorationTotal).toBeCloseTo(1491.0447761194, 4);
    // effective = round2(25 + 1491.0447.../300)
    expect(r.effectiveUnitPrice).toBe(29.97);
  });

  it('"Sin decorado" -> no decoration cost, effective == base', () => {
    const r = recomputeItemPricing({
      baseUnitPrice: 12.5,
      technique: 'Sin decorado',
      surface: '',
      size: '',
      qty: 50,
    });
    expect(r.error).toBeNull();
    expect(r.decorationTotal).toBe(0);
    expect(r.effectiveUnitPrice).toBe(12.5);
  });

  it('propagates a structured error for unknown technique', () => {
    const r = recomputeItemPricing({
      baseUnitPrice: 10,
      technique: 'NOPE',
      surface: 'TEXTIL',
      size: '4 x 4',
      qty: 100,
    });
    expect(r.error).toMatch(/no encontrado/i);
    expect(r.decorationTotal).toBe(0);
  });
});
