import {describe, it, expect} from 'vitest';
import {parseMoq, normalizeProduct} from '~/lib/gi';

describe('parseMoq stays in the data model (informational only)', () => {
  it('parses "La compra mínima es de N piezas"', () => {
    expect(parseMoq('La compra mínima es de 144 piezas.')).toBe(144);
  });

  it('returns null when no minimum is present', () => {
    expect(parseMoq('Producto promocional sin texto de mínimo.')).toBe(null);
  });

  it('handles thousands separators', () => {
    expect(parseMoq('La compra mínima es de 1,000 piezas')).toBe(1000);
  });
});

describe('normalizeProduct keeps moq as a number', () => {
  const node = {
    id: 'gid://shopify/Product/1',
    handle: 'taza-promo',
    title: 'Taza Promo',
    description: 'La compra mínima es de 72 piezas.',
    priceRange: {minVariantPrice: {amount: '25.50', currencyCode: 'MXN'}},
    tags: [],
    options: [],
    variants: {nodes: []},
  };

  it('exposes the parsed moq value', () => {
    const p = normalizeProduct(node);
    expect(p.moq).toBe(72);
  });

  it('falls back to 50 when description has no minimum', () => {
    const p = normalizeProduct({...node, description: 'Sin minimo'});
    expect(p.moq).toBe(50);
  });

  it('still returns a valid normalized shape', () => {
    const p = normalizeProduct(node);
    expect(p).toMatchObject({
      id: 'gid://shopify/Product/1',
      handle: 'taza-promo',
      title: 'Taza Promo',
      price: 25.5,
      currency: 'MXN',
    });
  });
});
