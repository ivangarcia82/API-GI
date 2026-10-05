import {describe, it, expect, vi, beforeEach} from 'vitest';

const upsertQuoteItem = vi.fn();
const repriceItems = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));
vi.mock('~/lib/auth/guard', () => ({
  requireUser: async () => ({userId: 'u1', sessionVersion: 1}),
}));
vi.mock('~/lib/quotes/repo', () => ({
  getOrCreateDraftQuote: async () => ({id: 'borrador', userId: 'u1', status: 'draft'}),
  getQuoteWithItems: async (_db, id) =>
    id === 'vieja'
      ? {
          quote: {id: 'vieja', userId: 'u1'},
          items: [{id: 'i1', variantId: 'gid://shopify/ProductVariant/1', title: 'Taza', qty: 10,
                   baseUnitPrice: 100, decorationTotal: 0, effectiveUnitPrice: 100,
                   technique: 'Sin decorado', surface: null, size: null}],
        }
      : {quote: {id}, items: []},
  upsertQuoteItem: (...a) => upsertQuoteItem(...a),
}));
vi.mock('~/lib/quotes/reprice.server', () => ({
  repriceItems: (...a) => repriceItems(...a),
}));

import {action} from './api.quote.reorder.jsx';

beforeEach(() => {
  upsertQuoteItem.mockReset();
  repriceItems.mockReset();
  repriceItems.mockImplementation(async (_ctx, items) =>
    items.map((i) => ({...i, baseUnitPrice: 80, effectiveUnitPrice: 80})),
  );
});

describe('api.quote.reorder con margen', () => {
  it('copia las líneas al precio de hoy, no al guardado', async () => {
    const body = new FormData();
    body.set('sourceQuoteId', 'vieja');
    await action({
      request: new Request('https://gi.test/api/quote/reorder', {method: 'POST', body}),
      context: {env: {}},
    });
    expect(repriceItems).toHaveBeenCalledTimes(1);
    const copiada = upsertQuoteItem.mock.calls[0][2];
    expect(copiada).toMatchObject({quoteId: 'borrador', baseUnitPrice: 80, effectiveUnitPrice: 80});
  });
});
