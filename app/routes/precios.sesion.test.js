/* El precio es sólo para quien inició sesión. La garantía vive en un solo
   sitio (applyCustomerPrices); lo que estas pruebas fijan es que ninguna ruta
   que devuelve productos se lo salte. Catálogo, colección y favoritos están en
   precios.margen.test.js; aquí, el buscador instantáneo. La búsqueda completa
   ya no devuelve productos: redirige al catálogo (search.redirige.test.js). */
import {describe, it, expect, vi, beforeEach} from 'vitest';

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
  it('buscador instantáneo (/search?predictive)', async () => {
    storefrontQuery.mockResolvedValue({
      predictiveSearch: {
        articles: [],
        collections: [],
        pages: [],
        queries: [],
        products: [producto()],
      },
    });
    const {loader} = await import('./search.jsx');
    const out = await loader({
      context,
      request: new Request('https://gi.test/search?q=taza&predictive=true&limit=6'),
    });
    expect(JSON.stringify(out)).not.toContain('333.33');
    expect(out.result.items.products[0].selectedOrFirstAvailableVariant.price.amount).toBe('1');
  });
});
