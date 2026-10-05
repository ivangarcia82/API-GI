import {describe, it, expect, vi, beforeEach} from 'vitest';

const upsertQuoteItem = vi.fn();
const resolveBasePrices = vi.fn();
const storefrontQuery = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));
vi.mock('~/lib/auth/guard', () => ({
  requireUser: async () => ({userId: 'u1', sessionVersion: 1}),
}));
vi.mock('~/lib/quotes/repo', () => ({
  getOrCreateDraftQuote: async () => ({id: 'q1', userId: 'u1', status: 'draft'}),
  upsertQuoteItem: (...a) => upsertQuoteItem(...a),
  getQuoteWithItems: async () => ({quote: {id: 'q1'}, items: []}),
}));
vi.mock('~/lib/pricing.server', () => ({
  resolveBasePrices: (...a) => resolveBasePrices(...a),
}));

import {action} from './api.quote.add.jsx';

const V = 'gid://shopify/ProductVariant/1';

beforeEach(() => {
  upsertQuoteItem.mockReset();
  resolveBasePrices.mockReset();
  storefrontQuery.mockReset();
  storefrontQuery.mockResolvedValue({
    node: {
      id: V,
      title: 'Chica',
      price: {amount: '333.33'},
      image: null,
      product: {handle: 'taza', title: 'Taza', featuredImage: null, metafields: []},
    },
  });
});

function agregar() {
  const body = new FormData();
  body.set('variantId', V);
  body.set('qty', '10');
  body.set('technique', 'Sin decorado');
  return action({
    request: new Request('https://gi.test/api/quote/add', {method: 'POST', body}),
    context: {env: {}, storefront: {query: (...a) => storefrontQuery(...a)}},
  });
}

describe('api.quote.add con margen', () => {
  it('guarda el precio base que resuelve el margen del cliente', async () => {
    resolveBasePrices.mockResolvedValue(new Map([[V, 142.86]]));
    const res = await agregar();
    expect(res.status).toBe(200);
    expect(resolveBasePrices.mock.calls[0][1]).toEqual([{variantId: V, listPrice: 333.33}]);
    const guardado = upsertQuoteItem.mock.calls[0][2];
    expect(guardado.baseUnitPrice).toBe(142.86);
    expect(guardado.effectiveUnitPrice).toBe(142.86);
  });
});
