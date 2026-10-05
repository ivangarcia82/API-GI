import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('~/lib/pricing.server', () => ({
  applyCustomerPrices: async (_ctx, data) => data,
  getCustomerMargin: async () => null,
}));

/* Sin mock de @shopify/hydrogen: el módulo real importa bien bajo Vitest, y un
   mock parcial se rompe en cuanto un componente importado de paso necesita algo
   que no está en él. Esta prueba no mira la paginación, sólo los filtros. */
const storefrontQuery = vi.fn();

const getBrandColors = vi.fn();
const getColorVocabulary = vi.fn();
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: (...a) => getBrandColors(...a),
  getColorVocabulary: (...a) => getColorVocabulary(...a),
}));

import {loader} from './collections.$handle.jsx';

const context = {storefront: {query: (...a) => storefrontQuery(...a)}, session: {}};
const pedir = () =>
  loader({
    context,
    params: {handle: 'textil'},
    request: new Request('https://gi.test/collections/textil'),
  });

beforeEach(() => {
  storefrontQuery.mockReset();
  storefrontQuery.mockResolvedValue({
    collection: {
      id: 'gid://c/1',
      handle: 'textil',
      title: 'Textil',
      products: {nodes: [], pageInfo: {}},
    },
  });
  getBrandColors.mockReset();
  getColorVocabulary.mockReset();
  getColorVocabulary.mockResolvedValue([
    {label: 'ROJO', count: 66},
    {label: 'VERDE', count: 18},
  ]);
});

describe('colección · colores de marca', () => {
  it('sin paleta no manda filtros', async () => {
    getBrandColors.mockResolvedValue(null);
    await pedir();
    const [, opciones] = storefrontQuery.mock.calls[0];
    expect(opciones.variables.filters).toBeNull();
  });

  it('con paleta manda sólo sus tonos', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    await pedir();
    const [, opciones] = storefrontQuery.mock.calls[0];
    expect(opciones.variables.filters).toEqual([{variantOption: {name: 'color', value: 'ROJO'}}]);
  });

  /* Un visitante anónimo no tiene ninguna familia que expandir: pedir el
     vocabulario le costaría una consulta entera por delante de la real cada
     vez que la entrada de CacheLong estuviera fría. */
  it('sin paleta no pide el vocabulario', async () => {
    getBrandColors.mockResolvedValue(null);
    await pedir();
    expect(getColorVocabulary).not.toHaveBeenCalled();
  });

  it('con paleta sí lo pide', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    await pedir();
    expect(getColorVocabulary).toHaveBeenCalled();
  });

  /* Fail-closed: el vocabulario llegó y no hay nada morado en la tienda. */
  it('con vocabulario y sin tonos de su paleta pide lo imposible', async () => {
    getBrandColors.mockResolvedValue({families: ['morado'], raw: '["Morado"]'});
    await pedir();
    const [, opciones] = storefrontQuery.mock.calls[0];
    expect(opciones.variables.filters).toEqual([
      {variantOption: {name: 'color', value: 'GI-SIN-COINCIDENCIA'}},
    ]);
  });

  /* Fail-open: sin vocabulario no se filtra, porque no se puede afirmar nada.
     Lo que se sirve es el catálogo público, no el de otro cliente. */
  it('sin vocabulario no filtra, en vez de dejar la colección vacía', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    getColorVocabulary.mockResolvedValue(null);
    await pedir();
    const [, opciones] = storefrontQuery.mock.calls[0];
    expect(opciones.variables.filters).toBeNull();
  });
});
