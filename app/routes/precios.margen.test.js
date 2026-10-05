import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('@shopify/hydrogen', async (importOriginal) => ({
  ...(await importOriginal()),
  getPaginationVariables: () => ({first: 24, endCursor: null}),
  Pagination: () => null,
}));
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: async () => null,
  getColorVocabulary: async () => null,
}));
vi.mock('~/lib/auth/guard', () => ({requireUser: async () => ({userId: 'u1'})}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({})}));
vi.mock('~/lib/wishlist/repo', () => ({listWishlist: async () => ['gid://shopify/Product/1']}));

const applyCustomerPrices = vi.fn();
const getCustomerMargin = vi.fn(async () => null);
vi.mock('~/lib/pricing.server', () => ({
  applyCustomerPrices: (...a) => applyCustomerPrices(...a),
  getCustomerMargin: (...a) => getCustomerMargin(...a),
}));

const storefrontQuery = vi.fn();
const context = {
  env: {},
  session: {},
  storefront: {query: (...a) => storefrontQuery(...a)},
};

const V = 'gid://shopify/ProductVariant/1';
const tarjeta = () => ({
  __typename: 'Product',
  id: 'gid://shopify/Product/1', handle: 'taza', title: 'Taza', description: '', tags: [],
  featuredImage: {url: 'x.jpg'},
  priceRange: {minVariantPrice: {amount: '333.33', currencyCode: 'MXN'}},
  options: [], metafields: [],
  variants: {nodes: [{id: V, price: {amount: '333.33', currencyCode: 'MXN'}, image: null}]},
});

beforeEach(() => {
  storefrontQuery.mockReset();
  applyCustomerPrices.mockReset();
  // Marca lo que pasó por aquí: el precio sale como 1.
  applyCustomerPrices.mockImplementation(async (_ctx, data) =>
    JSON.parse(JSON.stringify(data).replaceAll('"333.33"', '"1"')),
  );
});

describe('los loaders muestran el precio del cliente', () => {
  it('catálogo', async () => {
    storefrontQuery.mockResolvedValue({
      search: {totalCount: 1, nodes: [tarjeta()], pageInfo: {}, productFilters: []},
    });
    const {loader} = await import('./catalogo.jsx');
    const out = await loader({context, request: new Request('https://gi.test/catalogo')});
    expect(out.products.nodes[0].variants.nodes[0].price.amount).toBe('1');
  });

  it('colección', async () => {
    storefrontQuery.mockResolvedValue({
      collection: {id: 'c', handle: 'tazas', title: 'Tazas', products: {nodes: [tarjeta()], pageInfo: {}}},
    });
    const {loader} = await import('./collections.$handle.jsx');
    const out = await loader({
      context, params: {handle: 'tazas'}, request: new Request('https://gi.test/collections/tazas'),
    });
    expect(out.collection.products.nodes[0].variants.nodes[0].price.amount).toBe('1');
  });

  it('favoritos', async () => {
    storefrontQuery.mockResolvedValue({nodes: [tarjeta()]});
    const {loader} = await import('./account.favoritos.jsx');
    const out = await loader({context});
    // Sin el precio de la variante en la consulta no habría qué repreciar.
    expect(storefrontQuery.mock.calls[0][0]).toMatch(/variants\(first: 1\) \{ nodes \{ id price/);
    expect(out.products[0].price).toBe(1);
  });
});

describe('filtro de precio con margen', () => {
  it('el catálogo pide a Shopify el rango traducido', async () => {
    getCustomerMargin.mockResolvedValue(40);
    storefrontQuery.mockResolvedValue({
      search: {totalCount: 0, nodes: [], pageInfo: {}, productFilters: []},
    });
    const {loader} = await import('./catalogo.jsx');
    await loader({context, request: new Request('https://gi.test/catalogo?precioMin=0&precioMax=100')});
    const [, {variables}] = storefrontQuery.mock.calls.at(-1);
    expect(variables.productFilters).toContainEqual({price: {min: 0, max: 200}});
  });
});
