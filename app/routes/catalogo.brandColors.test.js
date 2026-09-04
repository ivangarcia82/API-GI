import {describe, it, expect, vi, beforeEach} from 'vitest';

const storefrontQuery = vi.fn();
vi.mock('@shopify/hydrogen', () => ({
  getPaginationVariables: () => ({first: 24, endCursor: null}),
  Pagination: () => null,
}));

const getBrandColors = vi.fn();
const getColorVocabulary = vi.fn();
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: (...a) => getBrandColors(...a),
  getColorVocabulary: (...a) => getColorVocabulary(...a),
}));

import {loader} from './catalogo.jsx';

const VOCABULARIO = [
  {label: 'ROJO', count: 66},
  {label: 'NEGRO', count: 61},
  {label: 'VERDE', count: 18},
];

const context = {storefront: {query: (...a) => storefrontQuery(...a)}, session: {}};
const pedir = (url) => loader({context, request: new Request('https://gi.test' + url)});

/** Los valores de color de los productFilters de la última consulta. */
const coloresPedidos = () => {
  const [, opciones] = storefrontQuery.mock.calls.at(-1);
  return (opciones.variables.productFilters || [])
    .filter((f) => f.variantOption)
    .map((f) => f.variantOption.value);
};

beforeEach(() => {
  storefrontQuery.mockReset();
  storefrontQuery.mockResolvedValue({
    search: {
      totalCount: 0,
      nodes: [],
      productFilters: [],
      pageInfo: {hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null},
    },
  });
  getBrandColors.mockReset();
  getColorVocabulary.mockReset();
  getColorVocabulary.mockResolvedValue(VOCABULARIO);
});

describe('catálogo · colores de marca', () => {
  it('un cliente sin paleta consulta sin filtro de color', async () => {
    getBrandColors.mockResolvedValue(null);
    const out = await pedir('/catalogo');
    expect(coloresPedidos()).toEqual([]);
    expect(out.marcaColores).toEqual([]);
  });

  it('un cliente con paleta consulta sólo sus tonos', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo', 'negro'], raw: '["Rojo","Negro"]'});
    const out = await pedir('/catalogo');
    expect(coloresPedidos().sort()).toEqual(['NEGRO', 'ROJO']);
    expect(out.marcaColores).toEqual(['rojo', 'negro']);
  });

  it('elegir un color de su paleta lo estrecha a ese', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo', 'negro'], raw: '["Rojo","Negro"]'});
    await pedir('/catalogo?color=rojo');
    expect(coloresPedidos()).toEqual(['ROJO']);
  });

  /* Forzoso, sin escape: no hay URL que saque al cliente de su paleta. */
  it('pedir un color ajeno por URL no lo saca de su paleta', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo', 'negro'], raw: '["Rojo","Negro"]'});
    const out = await pedir('/catalogo?color=verde');
    expect(coloresPedidos().sort()).toEqual(['NEGRO', 'ROJO']);
    // Y el chip no promete un verde que no se está aplicando.
    expect(out.filtros.color).toEqual([]);
  });

  it('el panel sólo ofrece los colores de su paleta', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    storefrontQuery.mockResolvedValue({
      search: {
        totalCount: 1,
        nodes: [],
        productFilters: [
          {
            id: 'filter.v.option.color',
            values: [
              {label: 'ROJO', count: 10},
              {label: 'VERDE', count: 4},
            ],
          },
        ],
        pageInfo: {hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null},
      },
    });
    const out = await pedir('/catalogo');
    expect(out.facetas.colores.map((c) => c.family)).toEqual(['rojo']);
  });

  it('la paleta también viaja en la ruta por colección', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    storefrontQuery.mockResolvedValue({collection: null});
    await pedir('/catalogo?cat=textil');
    expect(coloresPedidos()).toEqual(['ROJO']);
  });

  /* Ya no hace falta una pre-consulta para descubrir el vocabulario: viene
     cacheado. Una sola consulta por carga. */
  it('no hace una consulta extra para el vocabulario de color', async () => {
    getBrandColors.mockResolvedValue(null);
    await pedir('/catalogo?color=rojo');
    expect(storefrontQuery).toHaveBeenCalledTimes(1);
  });
});
