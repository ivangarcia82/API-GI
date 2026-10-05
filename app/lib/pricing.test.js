import {describe, it, expect} from 'vitest';
import {LIST_MARGIN, parseMargin, customerPrice, listFactor, toListRange} from './pricing.js';

describe('parseMargin', () => {
  it('acepta porcentajes entre 0 y 100, exclusivos', () => {
    expect(parseMargin('30')).toBe(30);
    expect(parseMargin('30.5')).toBe(30.5);
    expect(parseMargin(' 27.5 ')).toBe(27.5);
    expect(parseMargin(45)).toBe(45);
  });

  it('descarta lo que no es un margen usable', () => {
    for (const raw of [null, undefined, '', 'abc', '0', 0, '-5', '100', '250', NaN, Infinity]) {
      expect(parseMargin(raw)).toBeNull();
    }
  });
});

describe('customerPrice', () => {
  it('aplica margen bruto sobre el costo', () => {
    expect(customerPrice({cost: 100, margin: 30, listPrice: 333.33})).toBe(142.86);
    expect(customerPrice({cost: 100, margin: 50, listPrice: 333.33})).toBe(200);
  });

  it('con margen 70 reproduce el precio de lista de la tienda', () => {
    // Muestra real: costo 40.01, lista 133.36.
    expect(customerPrice({cost: 40.01, margin: LIST_MARGIN, listPrice: 133.36})).toBeCloseTo(133.36, 1);
  });

  it('sin margen devuelve el precio de lista', () => {
    expect(customerPrice({cost: 100, margin: null, listPrice: 333.33})).toBe(333.33);
  });

  it('sin costo devuelve el precio de lista', () => {
    for (const cost of [null, undefined, 0, -1, NaN]) {
      expect(customerPrice({cost, margin: 30, listPrice: 50})).toBe(50);
    }
  });
});

describe('listFactor y toListRange', () => {
  it('sin margen no toca el rango', () => {
    expect(listFactor(null)).toBe(1);
    expect(toListRange({min: 10, max: 100}, null)).toEqual({min: 10, max: 100});
  });

  it('convierte el rango del cliente a rango de lista', () => {
    // margen 40: lista = cliente × 0.60 / 0.30 = cliente × 2
    expect(listFactor(40)).toBeCloseTo(2, 10);
    expect(toListRange({min: 0, max: 100}, 40)).toEqual({min: 0, max: 200});
    expect(toListRange({min: 50, max: null}, 40)).toEqual({min: 100, max: null});
  });

  it('el ruido de punto flotante no empuja el borde un centavo', () => {
    // 100 × 0.6 / 0.3 da 200.00000000000003 en JS.
    expect(toListRange({min: null, max: 100}, 40).max).toBe(200);
  });

  it('redondea hacia afuera cuando el valor cae entre centavos', () => {
    // margen 35: factor 0.65/0.30 = 2.1666…
    const r = toListRange({min: 10, max: 10}, 35);
    expect(r.min).toBe(21.66);
    expect(r.max).toBe(21.67);
  });
});
