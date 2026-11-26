/* La página de colección: cuando la colección no tiene texto propio en
   Shopify, su descripción sale de sus facetas (ver collection-description).
   Cuando mercadotecnia sí le escribió uno, ése manda. */
import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('~/lib/pricing.server', () => ({
  applyCustomerPrices: async (_ctx, data) => data,
  getCustomerMargin: async () => null,
}));
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: async () => null,
  getColorVocabulary: async () => null,
}));

import {loader, meta} from './collections.$handle.jsx';

const storefrontQuery = vi.fn();
const context = {storefront: {query: (...a) => storefrontQuery(...a)}, session: {}};
const pedir = () =>
  loader({
    context,
    params: {handle: 'bebidas'},
    request: new Request('https://generandoideas.com/collections/bebidas'),
  });

const FACETAS = [
  {id: 'filter.p.m.custom.material', values: [{label: 'METAL', count: 640}, {label: 'PLÁSTICO', count: 598}]},
  {
    id: 'filter.p.m.custom.tecnicas_de_impresion',
    values: [{label: 'SERIGRAFÍA', count: 990}, {label: 'GRABADO LÁSER', count: 670}],
  },
  {id: 'filter.v.option.color', values: [{label: 'ROJO', count: 80}]},
];

const coleccion = (extra = {}) => ({
  collection: {
    id: 'gid://c/1',
    handle: 'bebidas',
    title: 'Bebidas',
    description: '',
    products: {nodes: [], pageInfo: {}, filters: FACETAS},
    ...extra,
  },
});

beforeEach(() => storefrontQuery.mockReset());

describe('colección sin texto propio', () => {
  beforeEach(() => storefrontQuery.mockResolvedValue(coleccion()));

  it('le pide a Shopify las facetas con sus conteos', async () => {
    await pedir();
    expect(storefrontQuery.mock.calls[0][0]).toMatch(/filters\s*\{\s*id\s+values\s*\{\s*label\s+count\s*\}\s*\}/);
  });

  it('entrega la descripción armada con sus datos', async () => {
    const out = await pedir();
    expect(out.descripcion.texto).toContain('La colección Bebidas de Generando Ideas reúne más de 1,230');
    expect(out.descripcion.texto).toContain('Predominan los de metal y plástico.');
  });

  it('no manda las facetas al navegador: sólo sirven para describir', async () => {
    const out = await pedir();
    expect(out.collection.products.filters).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('ROJO');
    // La paginación conserva lo que necesita.
    expect(out.collection.products).toHaveProperty('nodes');
    expect(out.collection.products).toHaveProperty('pageInfo');
  });

  it('la descripción para buscadores es la de la colección, no una genérica', async () => {
    const data = await pedir();
    const desc = meta({data}).find((d) => d.name === 'description').content;
    expect(desc).toContain('Más de 1,230 artículos promocionales de Bebidas');
    expect(desc).not.toMatch(/Productos de la colección/);
    expect(meta({data}).find((d) => d.property === 'og:description').content).toBe(desc);
  });
});

describe('colección con texto propio en Shopify', () => {
  it('manda el texto de mercadotecnia, en la página y para buscadores', async () => {
    storefrontQuery.mockResolvedValue(coleccion({description: 'Regalos de fin de año elegidos por el equipo.'}));
    const data = await pedir();
    expect(data.descripcion).toBeNull();
    expect(meta({data}).find((d) => d.name === 'description').content).toBe(
      'Regalos de fin de año elegidos por el equipo.',
    );
  });
});
