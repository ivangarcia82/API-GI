import {describe, it, expect, vi, beforeEach} from 'vitest';

const createDraftOrder = vi.fn();
const upsertQuoteItem = vi.fn();
const repriceItems = vi.fn();
const notifyQuoteSubmitted = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({execute: async () => ({rows: []})})}));
vi.mock('~/lib/auth/guard', () => ({
  requireUser: async () => ({userId: 'u1', sessionVersion: 1}),
}));
vi.mock('~/lib/auth/users', () => ({
  findById: async () => ({
    id: 'u1', email: 'cliente@empresa.com', firstName: 'A', lastName: 'B',
    shopifyCustomerGid: 'gid://shopify/Customer/1',
  }),
  setShopifyGid: async () => {},
}));
vi.mock('~/lib/admin/client', () => ({isStubMode: () => false}));
vi.mock('~/lib/admin/operations', () => ({
  createCustomer: async () => ({gid: 'gid://shopify/Customer/1'}),
  createDraftOrder: (...a) => createDraftOrder(...a),
  getCustomerAdvisor: async () => ({email: null, gid: null, handle: null, fields: {}}),
  setDraftOrderAdvisor: async () => {},
  getDiscountByCode: async () => ({ok: false}),
}));
vi.mock('~/lib/quotes/notify', () => ({
  notifyQuoteSubmitted: (...a) => notifyQuoteSubmitted(...a),
  resolveAdvisorRecipient: () => 'ventas@gi.test',
}));
vi.mock('~/lib/quotes/repo', () => ({
  getOrCreateDraftQuote: async () => ({id: 'q1', userId: 'u1', status: 'draft'}),
  getQuoteWithItems: async () => ({
    quote: {id: 'q1', notes: null, deadline: null, discountCode: null, discountPercentage: null},
    items: [{id: 'i1', variantId: 'gid://shopify/ProductVariant/1', title: 'Taza', qty: 10,
             baseUnitPrice: 100, decorationTotal: 0, effectiveUnitPrice: 100, technique: 'Sin decorado'}],
  }),
  markSubmitted: async () => ({folio: 'GI-0001'}),
  setQuoteDiscount: async () => {},
  upsertQuoteItem: (...a) => upsertQuoteItem(...a),
}));
vi.mock('~/lib/quotes/reprice.server', () => ({
  repriceItems: (...a) => repriceItems(...a),
}));

import {action} from './api.quote.submit.jsx';

beforeEach(() => {
  createDraftOrder.mockReset();
  createDraftOrder.mockResolvedValue({gid: 'gid://shopify/DraftOrder/1', invoiceUrl: 'https://x'});
  upsertQuoteItem.mockReset();
  notifyQuoteSubmitted.mockReset();
  repriceItems.mockReset();
  repriceItems.mockImplementation(async (_ctx, items) =>
    items.map((i) => ({...i, baseUnitPrice: 80, effectiveUnitPrice: 80})),
  );
});

function enviar() {
  return action({
    request: new Request('https://gi.test/api/quote/submit', {method: 'POST', body: new FormData()}),
    context: {env: {ENVIRONMENT: 'development'}},
  });
}

describe('api.quote.submit reprecia', () => {
  it('persiste el precio nuevo antes de crear la draft order', async () => {
    await enviar();
    expect(upsertQuoteItem).toHaveBeenCalledWith(
      expect.anything(), 'q1', expect.objectContaining({id: 'i1', effectiveUnitPrice: 80}),
    );
    expect(upsertQuoteItem.mock.invocationCallOrder[0]).toBeLessThan(
      createDraftOrder.mock.invocationCallOrder[0],
    );
  });

  it('la draft order y el correo llevan el precio nuevo', async () => {
    await enviar();
    const input = createDraftOrder.mock.calls[0][1];
    expect(JSON.stringify(input)).toMatch(/"amount":"?80/);
    expect(notifyQuoteSubmitted.mock.calls[0][1].items[0].effectiveUnitPrice).toBe(80);
  });
});
