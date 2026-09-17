import {describe, it, expect} from 'vitest';
import {quoteTotals} from './discount.js';

const items = [
  {effectiveUnitPrice: 25.5, qty: 100}, // 2550
  {effectiveUnitPrice: 12, qty: 200},   // 2400
];

describe('quoteTotals', () => {
  it('sin descuento deja el subtotal intacto y el IVA sobre el subtotal', () => {
    const t = quoteTotals(items, null);
    expect(t.subtotal).toBe(4950);
    expect(t.descuento).toBe(0);
    expect(t.subtotalNeto).toBe(4950);
    expect(t.iva).toBe(792);
    expect(t.total).toBe(5742);
  });

  it('el descuento baja el subtotal y el IVA se calcula sobre el neto', () => {
    const t = quoteTotals(items, {code: 'BIENVENIDOANDANAC', percentage: 20});
    expect(t.subtotal).toBe(4950);
    expect(t.descuento).toBe(990);
    expect(t.subtotalNeto).toBe(3960);
    // IVA sobre 3960, no sobre 4950: 633.60 y no 792.
    expect(t.iva).toBe(633.6);
    expect(t.total).toBe(4593.6);
  });

  it('redondea a dos decimales en lugar de arrastrar centésimas', () => {
    const t = quoteTotals([{effectiveUnitPrice: 33.33, qty: 7}], {
      code: 'X',
      percentage: 20,
    });
    expect(t.subtotal).toBe(233.31);
    expect(t.descuento).toBe(46.66);
    expect(t.subtotalNeto).toBe(186.65);
    expect(t.iva).toBe(29.86);
    expect(t.total).toBe(216.51);
  });

  it('un porcentaje ausente o cero se trata como sin descuento', () => {
    expect(quoteTotals(items, {code: 'X', percentage: 0}).descuento).toBe(0);
    expect(quoteTotals(items, {code: 'X'}).descuento).toBe(0);
    expect(quoteTotals(items, undefined).descuento).toBe(0);
  });

  it('una lista vacía o basura da ceros en vez de NaN', () => {
    expect(quoteTotals([], {code: 'X', percentage: 20})).toEqual({
      subtotal: 0, descuento: 0, subtotalNeto: 0, iva: 0, total: 0,
    });
    expect(quoteTotals(null, null).total).toBe(0);
    expect(quoteTotals([{effectiveUnitPrice: null, qty: 3}], null).subtotal).toBe(0);
  });

  it('ignora un porcentaje fuera de rango en vez de inventar un total negativo', () => {
    expect(quoteTotals(items, {code: 'X', percentage: 150}).descuento).toBe(0);
    expect(quoteTotals(items, {code: 'X', percentage: -5}).descuento).toBe(0);
  });
});
