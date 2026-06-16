import {describe, it, expect} from 'vitest';
import {keepProducts} from './account.favoritos.jsx';

describe('keepProducts', () => {
  it('keeps only non-null Product nodes', () => {
    const nodes = [
      {__typename: 'Product', id: 'gid://shopify/Product/1', handle: 'a'},
      null,
      {__typename: 'Collection', id: 'gid://shopify/Collection/9'},
      {__typename: 'Product', id: 'gid://shopify/Product/2', handle: 'b'},
    ];
    const out = keepProducts(nodes);
    expect(out.map((p) => p.id)).toEqual([
      'gid://shopify/Product/1',
      'gid://shopify/Product/2',
    ]);
  });

  it('returns an empty array for null/undefined input', () => {
    expect(keepProducts(null)).toEqual([]);
    expect(keepProducts(undefined)).toEqual([]);
  });
});
