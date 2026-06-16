import {describe, it, expect} from 'vitest';
import {normalizeProduct} from './gi.js';
import {getMeasures} from './decoration/engine.js';

function baseNode(metafields) {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'taza-test',
    title: 'Taza Test',
    description: 'Producto de prueba',
    vendor: 'GI',
    tags: [],
    featuredImage: {url: 'https://x/y.jpg', altText: 'Taza'},
    priceRange: {minVariantPrice: {amount: '40.60', currencyCode: 'MXN'}},
    options: [],
    variants: {nodes: [{id: 'gid://shopify/ProductVariant/9', title: 'Default', sku: 'T1', availableForSale: true, price: {amount: '40.60', currencyCode: 'MXN'}}]},
    metafields,
  };
}

describe('normalizeProduct decoration fields', () => {
  it('exposes techniques from a dash-delimited metafield and raw surface', () => {
    const p = normalizeProduct(
      baseNode([
        {namespace: 'custom', key: 'tecnicas_de_impresion', value: 'SERIGRAFÍA-BORDADO'},
        {namespace: 'custom', key: 'superficie', value: 'TEXTIL'},
      ]),
    );
    expect(p.techniques).toEqual(['SERIGRAFÍA', 'BORDADO']);
    expect(p.surface).toBe('TEXTIL');
  });

  it('exposes techniques from a JSON-array (list) metafield shape', () => {
    const p = normalizeProduct(
      baseNode([
        {namespace: 'custom', key: 'tecnicas_de_impresion', value: '["SERIGRAFÍA", "SUBLIMACION"]'},
        {namespace: 'custom', key: 'superficie', value: 'textil'},
      ]),
    );
    expect(p.techniques).toEqual(['SERIGRAFÍA', 'SUBLIMACION']);
    expect(p.surface).toBe('textil');
  });

  it('every parsed technique + surface maps to at least one measure in PRICE_MATRIX', () => {
    const p = normalizeProduct(
      baseNode([
        {namespace: 'custom', key: 'tecnicas_de_impresion', value: 'SERIGRAFÍA-BORDADO'},
        {namespace: 'custom', key: 'superficie', value: 'TEXTIL'},
      ]),
    );
    for (const t of p.techniques) {
      expect(getMeasures(t, p.surface).length).toBeGreaterThan(0);
    }
  });

  it('defaults to [] techniques and "" surface when metafields absent or null', () => {
    const p = normalizeProduct(baseNode([null, null]));
    expect(p.techniques).toEqual([]);
    expect(p.surface).toBe('');
    const p2 = normalizeProduct(baseNode(null));
    expect(p2.techniques).toEqual([]);
    expect(p2.surface).toBe('');
  });
});
