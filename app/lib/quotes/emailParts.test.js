import {describe, it, expect} from 'vitest';
import {itemsTableHtml} from './emailParts.js';

const ITEMS = [
  {title: 'Termo', qty: 100, technique: 'Sin decorado', effectiveUnitPrice: 100},
];

/** Los importes de la última columna del pie de la tabla. */
function pie(html) {
  const tfoot = html.split('<tfoot>')[1]?.split('</tfoot>')[0] ?? '';
  return [...tfoot.matchAll(/>(-?)\$([\d,]+\.\d{2})</g)].map((m) => m[1] + m[2]);
}

describe('itemsTableHtml · cupón', () => {
  it('sin cupón el pie sigue siendo una sola línea de total', () => {
    const html = itemsTableHtml(ITEMS, {totalLabel: 'Total estimado'});
    expect(html).not.toMatch(/Descuento/);
    expect(pie(html)).toEqual(['10,000.00']);
  });

  it('con cupón desglosa subtotal, descuento y total ya descontado', () => {
    const html = itemsTableHtml(ITEMS, {
      totalLabel: 'Total estimado',
      discount: {code: 'BIENVENIDOANDANAC', percentage: 20},
    });
    expect(html).toMatch(/Descuento/);
    expect(html).toMatch(/BIENVENIDOANDANAC/);
    expect(pie(html)).toEqual(['10,000.00', '-2,000.00', '8,000.00']);
  });

  it('un cupón sin porcentaje utilizable no ensucia el pie', () => {
    const html = itemsTableHtml(ITEMS, {discount: {code: 'X', percentage: 0}});
    expect(html).not.toMatch(/Descuento/);
    expect(pie(html)).toEqual(['10,000.00']);
  });
});

describe('itemsTableHtml · variante', () => {
  it('pone el color y la talla debajo del producto', () => {
    const html = itemsTableHtml([
      {title: 'Playera Liberty', qty: 50, technique: 'Sin decorado', effectiveUnitPrice: 120,
        options: [{name: 'Color', value: 'ROSA'}, {name: 'Talla', value: 'M'}]},
    ]);
    expect(html).toContain('Color: ROSA · Talla: M');
  });

  it('una línea sin opciones no deja un renglón vacío', () => {
    const html = itemsTableHtml([
      {title: 'Taza', qty: 10, technique: 'Sin decorado', effectiveUnitPrice: 30, options: []},
    ]);
    expect(html).not.toContain('font-size:12px;margin-top:2px');
  });
});
