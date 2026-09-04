import {describe, it, expect} from 'vitest';
import {keepProducts} from './account.favoritos.jsx';
import {keepBrandProducts} from '~/lib/brand-colors';

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

describe('favoritos · colores de marca', () => {
  /* Un favorito guardado antes de que le asignaran la paleta puede quedar
     fuera de ella. Se oculta como en cualquier otra lista. */
  it('un favorito fuera de la paleta desaparece de la lista', () => {
    const favoritos = [
      {id: '1', colors: ['ROJO']},
      {id: '2', colors: ['VERDE']},
    ];
    expect(keepBrandProducts(favoritos, ['rojo']).map((p) => p.id)).toEqual(['1']);
  });
});
