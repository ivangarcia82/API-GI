import {describe, it, expect, vi} from 'vitest';

const fetchCollectionCards = vi.fn();
vi.mock('~/lib/giFragments', () => ({
  fetchCollectionCards: (...a) => fetchCollectionCards(...a),
}));

import {loader} from './collections._index.jsx';
import {HOME_CATEGORIES} from '~/lib/gi';

describe('/collections · las 8 categorías principales', () => {
  it('pide sólo las 8 del home, no todas las colecciones de la tienda', async () => {
    fetchCollectionCards.mockResolvedValue(
      HOME_CATEGORIES.map((c) => ({id: c.handle, handle: c.handle, title: c.handle.toUpperCase(), image: null})),
    );
    const {collections} = await loader({context: {storefront: {}}});
    expect(fetchCollectionCards.mock.calls[0][1]).toEqual(HOME_CATEGORIES.map((c) => c.handle));
    expect(collections).toHaveLength(8);
    // En el orden y con el nombre del home.
    expect(collections.map((c) => c.title)).toEqual(HOME_CATEGORIES.map((c) => c.name));
  });
});
