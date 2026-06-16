import {describe, it, expect} from 'vitest';
import {calcDecoration, effectiveUnitPrice, round2} from './engine.js';

describe('calcDecoration — parity with scripthhglobal.liquid', () => {
  it('SERIGRAFÍA / TEXTIL / "4 x 4" / qty=300 ⇒ (300*3.33)/0.67', () => {
    const r = calcDecoration('SERIGRAFÍA', 'TEXTIL', 300, '4 x 4');
    expect(r.error).toBeNull();
    expect(r.isMinPriceUsed).toBe(true);
    expect(r.neededQtyForMin).toBe(300);
    expect(r.totalPrice).toBeCloseTo((300 * 3.33) / 0.67, 6); // 1491.044776...
    expect(r.unitPrice).toBeCloseTo(((300 * 3.33) / 0.67) / 300, 6); // 4.970149...
  });

  it('SERIGRAFÍA / metal / "10 X 10" (uppercase X) matches case-insensitively', () => {
    const r = calcDecoration('SERIGRAFÍA', 'metal', 500, '10 x 10'); // lowercase x input
    expect(r.error).toBeNull();
    expect(r.neededQtyForMin).toBe(500);
    expect(r.totalPrice).toBeCloseTo((500 * 2.1) / 0.67, 6);
  });

  it('qty=1 below minimum ⇒ flat precioMaximo as total', () => {
    const r = calcDecoration('SERIGRAFÍA', 'TEXTIL', 1, '4 x 4');
    expect(r.error).toBeNull();
    expect(r.isMinPriceUsed).toBe(false);
    expect(r.totalPrice).toBe(1641.8); // precioMaximo
    expect(r.unitPrice).toBe(1641.8); // total / 1
    expect(r.neededQtyForMin).toBe(300);
  });

  it('"Sin decorado" short-circuits to total 0 with no error', () => {
    const r = calcDecoration('Sin decorado', 'TEXTIL', 300, '4 x 4');
    expect(r).toEqual({error: null, totalPrice: 0, unitPrice: 0, neededQtyForMin: 0, isMinPriceUsed: false});
  });

  it('qty=0 yields unitPrice 0 (no divide-by-zero)', () => {
    const r = calcDecoration('SERIGRAFÍA', 'TEXTIL', 0, '4 x 4');
    expect(r.error).toBeNull();
    expect(r.totalPrice).toBe(1641.8); // 0 < min ⇒ precioMaximo
    expect(r.unitPrice).toBe(0);
  });

  it('unknown technique ⇒ structured error', () => {
    const r = calcDecoration('NOPE', 'TEXTIL', 10, '4 x 4');
    expect(r.error).toBe('Tipo de decorado no encontrado: NOPE');
    expect(r.totalPrice).toBe(0);
  });

  it('unknown surface ⇒ falls back to the most expensive group (no error)', () => {
    const r = calcDecoration('SERIGRAFÍA', 'papel', 10, '4 x 4');
    expect(r.error).toBeNull();
    expect(r.surfaceFallback).toBe(true);
    expect(r.surfaceUsed).toBe('RUBBER / VIDRIO');
    // qty 10 < min(500) ⇒ flat precioMaximo of RUBBER / VIDRIO
    expect(r.totalPrice).toBe(2686.56);
  });

  it('exact surface match reports no fallback', () => {
    const r = calcDecoration('SERIGRAFÍA', 'TEXTIL', 300, '4 x 4');
    expect(r.surfaceFallback).toBe(false);
    expect(r.surfaceUsed).toBe('TEXTIL');
  });

  it('unknown measure ⇒ structured error', () => {
    const r = calcDecoration('SERIGRAFÍA', 'TEXTIL', 10, '99 x 99');
    expect(r.error).toBe('Medida no encontrada: 99 x 99');
    expect(r.totalPrice).toBe(0);
  });
});

describe('effectiveUnitPrice + round2', () => {
  it('amortizes decoration total over qty on top of base price', () => {
    // base 40.60, decoration total 1491.0447..., qty 300
    const deco = (300 * 3.33) / 0.67;
    expect(effectiveUnitPrice(40.6, deco, 300)).toBeCloseTo(40.6 + deco / 300, 6);
  });

  it('qty=0 ⇒ returns base price only', () => {
    expect(effectiveUnitPrice(40.6, 1641.8, 0)).toBe(40.6);
  });

  it('round2 matches Math.round(n*100)/100', () => {
    expect(round2(4.970149253731343)).toBe(4.97);
    expect(round2(45.57014925373134)).toBe(45.57);
    expect(round2(1641.805)).toBe(1641.81);
  });
});
