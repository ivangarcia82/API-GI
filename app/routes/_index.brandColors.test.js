import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('~/lib/pricing.server', () => ({
  applyCustomerPrices: async (_ctx, data) => data,
  getCustomerMargin: async () => null,
}));

/* Sin mock de @shopify/hydrogen: _index.jsx no lo importa directamente, y
   mockearlo a medias rompería a los componentes que sí lo hacen de paso. */
const storefrontQuery = vi.fn();

const getBrandColors = vi.fn();
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: (...a) => getBrandColors(...a),
  getColorVocabulary: vi.fn(async () => []),
}));

vi.mock('~/lib/giFragments', async (original) => ({
  ...(await original()),
  fetchCollectionCards: vi.fn(async () => []),
}));

import {loader} from './_index.jsx';

const producto = (id, colors) => ({
  id,
  handle: `p-${id}`,
  title: `P${id}`,
  featuredImage: {url: `https://img/${id}.jpg`, altText: ''},
  priceRange: {minVariantPrice: {amount: '10.0', currencyCode: 'MXN'}},
  options: [{name: 'Color', optionValues: colors.map((name) => ({name}))}],
  variants: {nodes: [{id: `v-${id}`, availableForSale: true}]},
});

const context = {
  storefront: {query: (...a) => storefrontQuery(...a)},
  session: {},
  env: {PUBLIC_STORE_DOMAIN: 'x.myshopify.com'},
};

beforeEach(() => {
  storefrontQuery.mockReset();
  storefrontQuery.mockResolvedValue({
    products: {nodes: [producto('1', ['ROJO']), producto('2', ['VERDE'])]},
  });
  getBrandColors.mockReset();
});

describe('home · colores de marca', () => {
  it('sin paleta muestra todo', async () => {
    getBrandColors.mockResolvedValue(null);
    const out = await loader({context, request: new Request('https://gi.test/')});
    expect(out.products.map((p) => p.id)).toEqual(['1', '2']);
  });

  it('con paleta deja sólo los que se pueden pedir en sus colores', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    const out = await loader({context, request: new Request('https://gi.test/')});
    expect(out.products.map((p) => p.id)).toEqual(['1']);
  });

  /* El post-filtro se come parte de la tira, así que hay que sobre-pedir para
     que a un cliente con paleta no le queden cuatro productos. */
  it('pide de más para poder recortar', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    await loader({context, request: new Request('https://gi.test/')});
    const [, opciones] = storefrontQuery.mock.calls[0];
    expect(opciones.variables.first).toBe(60);
  });
});
