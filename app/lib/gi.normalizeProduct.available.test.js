import {describe, it, expect} from 'vitest';
import {normalizeProduct} from './gi.js';

const base = {
  id: 'gid://shopify/Product/1',
  handle: 'termo',
  title: 'Termo',
  featuredImage: {url: 'https://cdn/x.jpg'},
  priceRange: {minVariantPrice: {amount: '10', currencyCode: 'MXN'}},
  options: [],
};

describe('normalizeProduct · disponibilidad', () => {
  it('usa la del producto: agotado sólo si no queda ninguna variante', () => {
    const p = normalizeProduct({
      ...base,
      availableForSale: true,
      // La primera variante (la que trae la tarjeta) puede estar agotada
      // aunque otro color siga disponible.
      variants: {nodes: [{id: 'v1', availableForSale: false}]},
    });
    expect(p.available).toBe(true);
  });

  it('agotado cuando el producto entero lo está', () => {
    const p = normalizeProduct({...base, availableForSale: false, variants: {nodes: [{id: 'v1', availableForSale: false}]}});
    expect(p.available).toBe(false);
  });

  it('sin el dato del producto cae a la primera variante', () => {
    const p = normalizeProduct({...base, variants: {nodes: [{id: 'v1', availableForSale: false}]}});
    expect(p.available).toBe(false);
  });
});
