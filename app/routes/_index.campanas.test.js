import {describe, it, expect, vi} from 'vitest';

vi.mock('~/lib/giFragments', () => ({fetchCollectionCards: async () => []}));

import {campanasConProductos} from './_index.jsx';

const storefront = (porHandle) => ({
  query: vi.fn(async (_q, {variables}) => {
    const r = porHandle[variables.handle];
    if (r instanceof Error) throw r;
    return {collection: {products: {nodes: Array.from({length: r}, (_, i) => ({id: i}))}}};
  }),
});

describe('home · campañas con productos', () => {
  it('no anuncia una campaña cuya colección está vacía', async () => {
    const out = await campanasConProductos(storefront({'octubre-rosa': 1, 'agendas-2027': 0}), [
      {handle: 'octubre-rosa'},
      {handle: 'agendas-2027'},
    ]);
    expect(out.map((c) => c.handle)).toEqual(['octubre-rosa']);
  });

  it('si la consulta falla, la anuncia igual', async () => {
    const out = await campanasConProductos(storefront({navidad: new Error('hipo')}), [{handle: 'navidad'}]);
    expect(out.map((c) => c.handle)).toEqual(['navidad']);
  });
});
