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

// El loader ahora también resuelve la paleta de marca del cliente: sin este
// mock, getBrandColors intentaría leer context.session, que este arnés no
// provee.
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: () => Promise.resolve(null),
  getColorVocabulary: () => Promise.resolve([]),
}));

import {loader} from './catalogo.jsx';

const context = {storefront: {query: (...a) => storefrontQuery(...a)}};
const pedir = (url) => loader({context, request: new Request('https://gi.test' + url)});

/* <Pagination> lanza si a pageInfo le falta cualquiera de sus cuatro campos, y
   eso devolvía un 500 en toda la ruta. Producción lo destapó con una colección
   que allí no existe.
   El caso de "la consulta falla" desemboca en la misma rama EMPTY que
   "la colección no existe", así que no se prueba aparte: el mock que rechaza
   deja una promesa sin manejar que Vitest atribuye al archivo. */
const CAMPOS = ['hasNextPage', 'hasPreviousPage', 'startCursor', 'endCursor'];

beforeEach(() => storefrontQuery.mockReset());

describe('catálogo · pageInfo siempre completo', () => {
  it('cuando la colección no existe', async () => {
    storefrontQuery.mockResolvedValue({collection: null});
    const out = await pedir('/catalogo?cat=no-existe');
    for (const c of CAMPOS) expect(out.products.pageInfo).toHaveProperty(c);
  });


  it('cuando la búsqueda devuelve un pageInfo incompleto', async () => {
    storefrontQuery.mockResolvedValue({
      search: {totalCount: 3, nodes: [], pageInfo: {hasNextPage: true}, productFilters: []},
    });
    const out = await pedir('/catalogo');
    for (const c of CAMPOS) expect(out.products.pageInfo).toHaveProperty(c);
    // No se pisa lo que sí vino.
    expect(out.products.pageInfo.hasNextPage).toBe(true);
  });

  it('la colección sin resultados no rompe el total', async () => {
    storefrontQuery.mockResolvedValue({collection: null});
    const out = await pedir('/catalogo?cat=no-existe');
    expect(out.totalCount).toBeNull();
    expect(out.products.nodes).toEqual([]);
  });
});
