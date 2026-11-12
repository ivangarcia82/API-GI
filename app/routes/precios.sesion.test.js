/* El precio es sólo para quien inició sesión. La garantía vive en un solo
   sitio (applyCustomerPrices); lo que estas pruebas fijan es que ninguna ruta
   que devuelve productos se lo salte. La búsqueda normal lo hacía: mandaba la
   respuesta cruda de Shopify, con el precio de lista dentro. */
import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('@shopify/hydrogen', async (importOriginal) => ({
  ...(await importOriginal()),
  getPaginationVariables: () => ({first: 8, endCursor: null}),
}));
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: async () => null,
  getColorVocabulary: async () => null,
}));

const applyCustomerPrices = vi.fn();
vi.mock('~/lib/pricing.server', () => ({
  applyCustomerPrices: (...a) => applyCustomerPrices(...a),
}));

const storefrontQuery = vi.fn();
const context = {
  env: {},
  session: {},
  storefront: {query: (...a) => storefrontQuery(...a)},
};

const producto = () => ({
  __typename: 'Product',
  id: 'gid://shopify/Product/1',
  handle: 'taza',
  title: 'Taza',
  selectedOrFirstAvailableVariant: {
    id: 'gid://shopify/ProductVariant/1',
    price: {amount: '333.33', currencyCode: 'MXN'},
  },
});

beforeEach(() => {
  storefrontQuery.mockReset();
  applyCustomerPrices.mockReset();
  // Marca lo que pasó por la capa de precios: el importe sale como 1.
  applyCustomerPrices.mockImplementation(async (_ctx, data) =>
    JSON.parse(JSON.stringify(data).replaceAll('"333.33"', '"1"')),
  );
});

describe('ninguna ruta entrega el precio crudo de Shopify', () => {
  it('búsqueda normal (/search?q=)', async () => {
    storefrontQuery.mockResolvedValue({
      products: {nodes: [producto()], pageInfo: {}},
      pages: {nodes: []},
      articles: {nodes: []},
    });
    const {loader} = await import('./search.jsx');
    const out = await loader({context, request: new Request('https://gi.test/search?q=taza')});
    expect(JSON.stringify(out)).not.toContain('333.33');
    expect(out.result.items.products.nodes[0].selectedOrFirstAvailableVariant.price.amount).toBe('1');
    expect(out.result.total).toBe(1);
  });
});
