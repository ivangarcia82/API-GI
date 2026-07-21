import {describe, it, expect} from 'vitest';
import {normalizeProduct} from './gi.js';

function baseNode(overrides = {}) {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'taza-test',
    title: 'Taza Test',
    description: 'Producto de prueba',
    tags: [],
    priceRange: {minVariantPrice: {amount: '40.60', currencyCode: 'MXN'}},
    options: [],
    variants: {
      nodes: [
        {
          id: 'gid://shopify/ProductVariant/9',
          title: 'Default',
          sku: 'T1',
          availableForSale: true,
          price: {amount: '40.60', currencyCode: 'MXN'},
        },
      ],
    },
    ...overrides,
  };
}

describe('normalizeProduct hides products with no image', () => {
  it('returns null when there is no featuredImage and no variant image', () => {
    const p = normalizeProduct(baseNode());
    expect(p).toBeNull();
  });

  it('returns null even when other fields (price, description) are present', () => {
    const p = normalizeProduct(
      baseNode({
        variants: {
          nodes: [
            {
              id: 'gid://shopify/ProductVariant/9',
              title: 'Default',
              sku: 'T1',
              availableForSale: true,
              price: {amount: '40.60', currencyCode: 'MXN'},
              image: null,
            },
          ],
        },
      }),
    );
    expect(p).toBeNull();
  });

  it('returns a normal object when featuredImage is present', () => {
    const p = normalizeProduct(
      baseNode({featuredImage: {url: 'https://x/y.jpg', altText: 'Taza'}}),
    );
    expect(p).not.toBeNull();
    expect(p.image).toBe('https://x/y.jpg');
  });

  it('falls back to the first variant image when featuredImage is missing', () => {
    const p = normalizeProduct(
      baseNode({
        variants: {
          nodes: [
            {
              id: 'gid://shopify/ProductVariant/9',
              title: 'Default',
              sku: 'T1',
              availableForSale: true,
              price: {amount: '40.60', currencyCode: 'MXN'},
              image: {url: 'https://x/variant.jpg'},
            },
          ],
        },
      }),
    );
    expect(p).not.toBeNull();
    expect(p.image).toBe('https://x/variant.jpg');
  });

  it('returns null for a null/undefined node (unrelated to the image rule)', () => {
    expect(normalizeProduct(null)).toBeNull();
    expect(normalizeProduct(undefined)).toBeNull();
  });
});
