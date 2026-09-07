import {describe, it, expect, vi, beforeEach} from 'vitest';

const upsertQuoteItem = vi.fn();
const getQuoteWithItems = vi.fn();
const storefrontQuery = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));
vi.mock('~/lib/auth/guard', () => ({
  requireUser: async () => ({userId: 'u1', sessionVersion: 1}),
}));
vi.mock('~/lib/quotes/repo', () => ({
  getOrCreateDraftQuote: async () => ({id: 'q1', userId: 'u1', status: 'draft'}),
  upsertQuoteItem: (...a) => upsertQuoteItem(...a),
  getQuoteWithItems: (...a) => getQuoteWithItems(...a),
}));

import {action} from './api.quote.merge.jsx';

/* Una variante viva en la tienda, con su material y sus técnicas reales. */
const nodo = (over = {}) => ({
  id: 'gid://v1',
  title: 'Chica',
  price: {amount: '100.0'},
  image: {url: 'variante.jpg'},
  product: {
    handle: 'playera-basica',
    title: 'Playera Básica',
    featuredImage: {url: 'producto.jpg'},
    metafields: [
      {namespace: 'custom', key: 'material', value: 'TEXTIL'},
      {namespace: 'custom', key: 'tecnicas_de_impresion', value: 'BORDADO, Serigrafía'},
    ],
  },
  ...over,
});

const context = {env: {}, storefront: {query: (...a) => storefrontQuery(...a)}};

function pedir(lines) {
  const body = new FormData();
  body.set('lines', typeof lines === 'string' ? lines : JSON.stringify(lines));
  return action({
    request: new Request('https://gi.test/api/quote/merge', {method: 'POST', body}),
    context,
  });
}

/** Los items con que se llamó a upsertQuoteItem, en orden. */
function migrados() {
  return upsertQuoteItem.mock.calls.map((c) => c[2]);
}

beforeEach(() => {
  upsertQuoteItem.mockReset();
  getQuoteWithItems.mockReset();
  storefrontQuery.mockReset();
  getQuoteWithItems.mockResolvedValue({quote: {id: 'q1'}, items: [{id: 'srv1'}]});
  storefrontQuery.mockResolvedValue({nodes: [nodo()]});
});

describe('POST /api/quote/merge', () => {
  it('migra la línea del invitado al borrador y devuelve la lista autoritativa', async () => {
    const res = await pedir([
      {variantId: 'gid://v1', technique: 'Sin decorado', surface: '', size: '', qty: 25},
    ]);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.items).toEqual([{id: 'srv1'}]);
    expect(migrados()).toHaveLength(1);
    expect(migrados()[0]).toMatchObject({variantId: 'gid://v1', qty: 25, title: 'Playera Básica'});
  });

  it('toma el precio de Shopify y no el que venga en el cuerpo', async () => {
    await pedir([
      {variantId: 'gid://v1', technique: 'Sin decorado', qty: 10, baseUnitPrice: 1, effectiveUnitPrice: 1},
    ]);
    expect(migrados()[0].baseUnitPrice).toBe(100);
    expect(migrados()[0].effectiveUnitPrice).toBe(100);
  });

  it('usa el material del producto y no el sustrato que mande el cliente', async () => {
    await pedir([
      {variantId: 'gid://v1', technique: 'BORDADO', surface: 'MATERIAL-BARATO', size: '8 x 8', qty: 100},
    ]);
    expect(migrados()[0].surface).toBe('TEXTIL');
    expect(migrados()[0].decorationTotal).toBeGreaterThan(0);
  });

  it('descarta la variante que ya no existe y lo reporta', async () => {
    storefrontQuery.mockResolvedValue({nodes: [null]});
    const body = await (await pedir([{variantId: 'gid://muerta', qty: 5}])).json();
    expect(migrados()).toHaveLength(0);
    expect(body.descartadas).toBe(1);
  });

  it('descarta la técnica que el producto ya no ofrece en vez de cotizarla', async () => {
    const body = await (
      await pedir([{variantId: 'gid://v1', technique: 'PARCHE SUBLIMADO', size: '8 x 8', qty: 100}])
    ).json();
    expect(migrados()).toHaveLength(0);
    expect(body.descartadas).toBe(1);
  });

  it('migra las buenas aunque una del lote venga mala', async () => {
    storefrontQuery.mockResolvedValue({nodes: [nodo(), null]});
    const body = await (
      await pedir([
        {variantId: 'gid://v1', technique: 'Sin decorado', qty: 5},
        {variantId: 'gid://muerta', technique: 'Sin decorado', qty: 5},
      ])
    ).json();
    expect(migrados()).toHaveLength(1);
    expect(body.descartadas).toBe(1);
  });

  it('pide todas las variantes en una sola consulta, no una por línea', async () => {
    storefrontQuery.mockResolvedValue({nodes: [nodo(), nodo({id: 'gid://v2'})]});
    await pedir([
      {variantId: 'gid://v1', technique: 'Sin decorado', qty: 5},
      {variantId: 'gid://v2', technique: 'Sin decorado', qty: 5},
    ]);
    expect(storefrontQuery).toHaveBeenCalledTimes(1);
  });

  it('rechaza un cuerpo que no es una lista, sin tocar el borrador', async () => {
    const res = await pedir('{no es json');
    expect(res.status).toBe(400);
    expect(upsertQuoteItem).not.toHaveBeenCalled();
  });

  it('no acepta más líneas que el tope, aunque el cliente mande cien', async () => {
    const muchas = Array.from({length: 100}, () => ({
      variantId: 'gid://v1',
      technique: 'Sin decorado',
      qty: 1,
    }));
    storefrontQuery.mockResolvedValue({nodes: [nodo()]});
    await pedir(muchas);
    expect(migrados().length).toBeLessThanOrEqual(50);
  });
});
