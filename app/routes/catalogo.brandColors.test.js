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

const getBrandColors = vi.fn();
const getColorVocabulary = vi.fn();
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: (...a) => getBrandColors(...a),
  getColorVocabulary: (...a) => getColorVocabulary(...a),
}));

import {loader, estadoVacio, lineasDeSeleccion} from './catalogo.jsx';

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

  /* Un visitante anónimo no tiene nada que expandir: pedir el vocabulario le
     costaría una consulta entera por delante de la del catálogo, cada vez que
     la entrada de CacheLong estuviera fría. */
  it('sin paleta ni colores elegidos no pide el vocabulario', async () => {
    getBrandColors.mockResolvedValue(null);
    await pedir('/catalogo');
    expect(getColorVocabulary).not.toHaveBeenCalled();
  });

  it('lo pide en cuanto hay colores elegidos', async () => {
    getBrandColors.mockResolvedValue(null);
    await pedir('/catalogo?color=rojo');
    expect(getColorVocabulary).toHaveBeenCalled();
  });

  it('y lo pide siempre que hay paleta', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    await pedir('/catalogo');
    expect(getColorVocabulary).toHaveBeenCalled();
  });

  /* Fail-closed: el vocabulario llegó entero y no hay un solo tono morado en
     la tienda. 0 productos es la verdad. */
  it('con vocabulario y sin tonos de su paleta pide lo imposible', async () => {
    getBrandColors.mockResolvedValue({families: ['morado'], raw: '["Morado"]'});
    await pedir('/catalogo');
    expect(coloresPedidos()).toEqual(['GI-SIN-COINCIDENCIA']);
  });

  /* Fail-open: sin vocabulario no se puede afirmar que su paleta no exista en
     la tienda, y un hipo de la faceta no puede apagarle el catálogo entero a
     un cliente que paga. */
  it('sin vocabulario sirve el catálogo sin filtrar, no una pantalla vacía', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    getColorVocabulary.mockResolvedValue(null);
    await pedir('/catalogo');
    const [, opciones] = storefrontQuery.mock.calls.at(-1);
    expect(opciones.variables.productFilters).toBeNull();
  });

  it('sin vocabulario tampoco vacía la ruta por colección', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    getColorVocabulary.mockResolvedValue(null);
    storefrontQuery.mockResolvedValue({collection: null});
    await pedir('/catalogo?cat=textil');
    const [, opciones] = storefrontQuery.mock.calls.at(-1);
    expect(opciones.variables.productFilters).toBeNull();
  });
});

/* El estado vacío nunca puede ser un callejón sin salida: si el texto pide
   quitar filtros tiene que haber un botón que los quite, y si no hay ninguno
   que quitar tiene que ofrecer otra cosa. */
describe('catálogo · estado vacío', () => {
  it('con paleta y filtros ofrece limpiarlos', () => {
    expect(estadoVacio({marcaColores: ['rojo'], hayFiltros: true})).toEqual({
      texto:
        'No hay productos en los colores de tu marca con estos filtros. Prueba a quitar alguno.',
      accion: 'limpiar',
    });
  });

  /* El caso que se quedaba mudo: /catalogo desnudo, la paleta del cliente no
     existe en la tienda, y el mensaje pedía quitar filtros que no había. */
  it('con paleta y sin filtros no pide quitar nada, y ofrece salida', () => {
    const out = estadoVacio({marcaColores: ['morado'], hayFiltros: false});
    expect(out.accion).toBe('contacto');
    expect(out.texto).not.toMatch(/filtro/i);
  });

  /* Un cliente sin paleta ve exactamente lo de siempre. */
  it('sin paleta y con filtros ofrece limpiarlos', () => {
    expect(estadoVacio({marcaColores: [], hayFiltros: true})).toEqual({
      texto: 'Ninguna combinación de estos filtros devuelve productos. Prueba a quitar alguno.',
      accion: 'limpiar',
    });
  });

  it('sin paleta y sin filtros sigue mandando a reformular la búsqueda', () => {
    expect(estadoVacio({marcaColores: [], hayFiltros: false})).toEqual({
      texto: 'Intenta con otras palabras de búsqueda.',
      accion: null,
    });
  });

  it('nunca pide quitar filtros sin ofrecer el botón que los quita', () => {
    for (const marcaColores of [[], ['rojo']]) {
      for (const hayFiltros of [true, false]) {
        const {texto, accion} = estadoVacio({marcaColores, hayFiltros});
        if (/quitar/i.test(texto)) expect(accion).toBe('limpiar');
      }
    }
  });
});

/* La barra de selección múltiple cotizaba `firstVariantId` a secas, que es la
   primera variante que devolvió la consulta y puede ser de cualquier color: a
   un cliente con paleta le metía en la cotización variantes que no puede pedir,
   y en lote, sin que llegara a ver el color por ningún lado. */

const seleccionado = (id, colorVariants, firstVariantId) => ({
  id,
  handle: `p-${id}`,
  title: `Producto ${id}`,
  sku: `SKU-${id}`,
  image: `https://cdn.test/${id}.jpg`,
  price: 100,
  firstVariantId,
  colorVariants,
});

const CON_ROJO = seleccionado(
  '1',
  [
    {name: 'AZUL', variantId: 'gid://variant/AZUL'},
    {name: 'ROJO', variantId: 'gid://variant/ROJO'},
  ],
  'gid://variant/AZUL',
);

describe('catálogo · cotizar en lote respetando la paleta', () => {
  it('sin paleta cotiza la variante por defecto', () => {
    const {lineas, sinVariante} = lineasDeSeleccion([CON_ROJO], []);
    expect(lineas.map((l) => l.variantId)).toEqual(['gid://variant/AZUL']);
    expect(sinVariante).toBe(0);
  });

  it('con paleta cotiza la variante de su color', () => {
    const {lineas} = lineasDeSeleccion([CON_ROJO], ['rojo']);
    expect(lineas[0].variantId).toBe('gid://variant/ROJO');
  });

  it('conserva los datos que la línea necesita para pintarse', () => {
    const {lineas} = lineasDeSeleccion([CON_ROJO], ['rojo']);
    expect(lineas[0]).toEqual({
      variantId: 'gid://variant/ROJO',
      productId: '1',
      handle: 'p-1',
      title: 'Producto 1',
      sku: 'SKU-1',
      image: 'https://cdn.test/1.jpg',
      price: 100,
      qty: 1,
    });
  });

  /* Sin variante no se puede cotizar sin crear una línea de $0 y sin foto: se
     cuentan aparte para poder decirle al cliente cuántas quedaron fuera. */
  it('cuenta aparte los que no tienen ninguna variante', () => {
    const sinNada = seleccionado('2', [], null);
    const {lineas, sinVariante} = lineasDeSeleccion([CON_ROJO, sinNada], ['rojo']);
    expect(lineas).toHaveLength(1);
    expect(sinVariante).toBe(1);
  });
});
