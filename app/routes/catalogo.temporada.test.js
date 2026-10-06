import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('~/lib/pricing.server', () => ({
  applyCustomerPrices: async (_ctx, data) => data,
  getCustomerMargin: async () => null,
}));

const storefrontQuery = vi.fn();
vi.mock('@shopify/hydrogen', () => ({
  getPaginationVariables: () => ({first: 24, endCursor: null}),
  Pagination: () => null,
}));

vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: () => Promise.resolve(null),
  getColorVocabulary: () => Promise.resolve([]),
}));

import {loader} from './catalogo.jsx';

const context = {storefront: {query: (...a) => storefrontQuery(...a)}};
// /temporada/:handle es el mismo loader con el parámetro de la ruta.
const temporada = (handle, query = '') =>
  loader({
    context,
    params: {handle},
    request: new Request(`https://gi.test/temporada/${handle}${query}`),
  });

const COLECCION = {
  collection: {
    handle: 'octubre-rosa',
    title: 'Octubre Rosa',
    description: 'Porque cuidarnos también es un acto de amor.',
    image: {url: 'https://cdn/banner.jpg', altText: null, width: 1440, height: 800},
    products: {nodes: [], filters: [], pageInfo: {hasNextPage: false}},
  },
};

beforeEach(() => storefrontQuery.mockReset());

describe('landing de temporada', () => {
  it('consulta la colección de la campaña aunque la URL no traiga cat', async () => {
    storefrontQuery.mockResolvedValue(COLECCION);
    await temporada('octubre-rosa');
    expect(storefrontQuery.mock.calls[0][1].variables.handle).toBe('octubre-rosa');
  });

  it('no deja que ?cat ni ?q de la URL saquen los productos de la campaña', async () => {
    storefrontQuery.mockResolvedValue(COLECCION);
    await temporada('octubre-rosa', '?cat=bebidas&q=termo');
    expect(storefrontQuery.mock.calls[0][1].variables.handle).toBe('octubre-rosa');
  });

  it('devuelve la campaña y el encabezado de su colección, sin chip de categoría', async () => {
    storefrontQuery.mockResolvedValue(COLECCION);
    const out = await temporada('octubre-rosa', '?color=rosa');
    expect(out.campana.handle).toBe('octubre-rosa');
    expect(out.coleccion.image.url).toBe('https://cdn/banner.jpg');
    expect(out.filtros.cat).toBe('');
    expect(out.filtros.color).toEqual(['rosa']);
  });

  it('una campaña que no existe es un 404', async () => {
    await expect(temporada('no-existe')).rejects.toMatchObject({status: 404});
    expect(storefrontQuery).not.toHaveBeenCalled();
  });
});
