import {describe, it, expect} from 'vitest';
import {
  mostExpensiveSurfaceKey,
  resolveSurfaceKey,
  calcDecoration,
} from './engine.js';

describe('mostExpensiveSurfaceKey', () => {
  it('picks the SERIGRAFÍA group with the highest ceiling (RUBBER / VIDRIO)', () => {
    // precioMaximo: ACERO 1641.8, TEXTIL 1641.8, RUBBER/VIDRIO 2686.56, TRANSFER 1791.04
    expect(mostExpensiveSurfaceKey('SERIGRAFÍA')).toBe('RUBBER / VIDRIO');
  });

  it('returns the single group when a technique has only one', () => {
    expect(mostExpensiveSurfaceKey('BORDADO')).toBe('TEXTIL');
  });

  it('resolves aliased/lower-case technique labels before choosing', () => {
    expect(mostExpensiveSurfaceKey('Grabado en láser')).toBe('MADERA / METAL / VIDRIO');
  });

  it('returns undefined for an unknown technique', () => {
    expect(mostExpensiveSurfaceKey('NOPE')).toBeUndefined();
  });
});

describe('resolveSurfaceKey', () => {
  it('returns the exact group with fallback=false on a real match', () => {
    expect(resolveSurfaceKey('SERIGRAFÍA', 'TEXTIL')).toEqual({key: 'TEXTIL', fallback: false});
  });

  it('matches multi-surface keys by exact membership', () => {
    expect(resolveSurfaceKey('SERIGRAFÍA', 'metal')).toEqual({
      key: 'ACERO / METAL / MADERA / PLÁSTICO',
      fallback: false,
    });
  });

  it('falls back to the most expensive group with fallback=true when unmatched', () => {
    expect(resolveSurfaceKey('SERIGRAFÍA', 'papel')).toEqual({
      key: 'RUBBER / VIDRIO',
      fallback: true,
    });
  });

  it('returns no key for an unknown technique', () => {
    expect(resolveSurfaceKey('NOPE', 'TEXTIL')).toEqual({key: undefined, fallback: false});
  });
});

describe('calcDecoration with fallback material', () => {
  it('prices a fallback material at/above the minimum using the priciest group', () => {
    // RUBBER / VIDRIO '4 x 4': precioMinimo 3.6, cantidadMinima 500.
    const r = calcDecoration('SERIGRAFÍA', 'plastico-raro', 500, '4 x 4');
    expect(r.error).toBeNull();
    expect(r.surfaceFallback).toBe(true);
    expect(r.surfaceUsed).toBe('RUBBER / VIDRIO');
    expect(r.isMinPriceUsed).toBe(true);
    expect(r.totalPrice).toBeCloseTo((500 * 3.6) / 0.67, 6);
  });
});
