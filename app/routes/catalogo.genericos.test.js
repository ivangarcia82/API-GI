import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('@shopify/hydrogen', () => ({
  getPaginationVariables: () => ({first: 24, endCursor: null}),
  Pagination: () => null,
}));
vi.mock('~/lib/pricing.server', () => ({
  applyCustomerPrices: async (_ctx, data) => data,
  getCustomerMargin: async () => null,
}));

const getFacetValues = vi.fn();
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: async () => null,
  getColorVocabulary: async () => null,
  getFacetValues: (...a) => getFacetValues(...a),
}));

import {loader} from './catalogo.jsx';

const VOCAB = {
  'filter.p.m.custom.tecnicas_de_impresion': [
    {label: 'BORDADO', count: 39},
    {label: 'BORDADO-SERIGRAFÍA', count: 167},
    {label: 'SERIGRAFÍA', count: 3550},
  ],
  'filter.v.option.talla': [
    {label: 'XG', count: 39},
    {label: 'EXTRA GRANDE', count: 12},
    {label: 'CH', count: 39},
  ],
};

const storefrontQuery = vi.fn();
const context = {storefront: {query: (...a) => storefrontQuery(...a)}, session: {}};
const pedir = (qs) => loader({context, request: new Request(`https://gi.test/catalogo${qs}`)});
const filtrosPedidos = () => storefrontQuery.mock.calls.at(-1)[1].variables.productFilters || [];

beforeEach(() => {
  getFacetValues.mockReset();
  getFacetValues.mockImplementation(async (_ctx, id) => VOCAB[id] ?? null);
  storefrontQuery.mockReset();
  storefrontQuery.mockResolvedValue({
    search: {
      totalCount: 0,
      nodes: [],
      pageInfo: {},
      productFilters: [
        {id: 'filter.p.m.custom.tecnicas_de_impresion', values: VOCAB['filter.p.m.custom.tecnicas_de_impresion']},
        {id: 'filter.v.option.talla', values: VOCAB['filter.v.option.talla']},
      ],
    },
  });
});

describe('catálogo · técnicas y tallas genéricas', () => {
  it('el panel ofrece las técnicas y tallas agrupadas', async () => {
    const out = await pedir('');
    expect(out.facetas.tecnicas.map((t) => t.label)).toEqual(['Serigrafía', 'Bordado']);
    expect(out.facetas.tecnicas[1]).toMatchObject({value: 'bordado', count: 39 + 167});
    expect(out.facetas.tallas.map((t) => t.label)).toEqual(['CH', 'XG']);
  });

  it('una técnica elegida se expande a todas sus combinaciones', async () => {
    await pedir('?tecnica=bordado');
    const tecnicas = filtrosPedidos().filter((f) => f.productMetafield).map((f) => f.productMetafield.value);
    expect(tecnicas).toEqual(['BORDADO', 'BORDADO-SERIGRAFÍA']);
  });

  it('una talla elegida se expande a sus nombres', async () => {
    await pedir('?talla=xg');
    expect(filtrosPedidos()).toEqual([
      {variantOption: {name: 'talla', value: 'XG'}},
      {variantOption: {name: 'talla', value: 'EXTRA GRANDE'}},
    ]);
  });

  it('sin técnica ni talla elegidas no pide el vocabulario', async () => {
    await pedir('');
    expect(getFacetValues).not.toHaveBeenCalled();
  });
});
