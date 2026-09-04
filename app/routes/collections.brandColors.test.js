import {describe, it, expect, vi, beforeEach} from 'vitest';

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
});
