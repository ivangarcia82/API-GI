import {describe, it, expect, vi, beforeEach} from 'vitest';

const getDiscountByCode = vi.fn();
const setQuoteDiscount = vi.fn();
const createDraftOrder = vi.fn();
const getQuoteWithItems = vi.fn();
const notifyQuoteSubmitted = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({execute: async () => ({rows: []})})}));
vi.mock('~/lib/auth/guard', () => ({
  requireUser: async () => ({userId: 'u1', sessionVersion: 1}),
}));
vi.mock('~/lib/auth/users', () => ({
  findById: async () => ({
    id: 'u1',
    email: 'cliente@empresa.com',
    firstName: 'A',
    lastName: 'B',
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
  getDiscountByCode: (...a) => getDiscountByCode(...a),
}));
vi.mock('~/lib/quotes/notify', () => ({
  notifyQuoteSubmitted: (...a) => notifyQuoteSubmitted(...a),
  resolveAdvisorRecipient: () => 'ventas@gi.test',
}));
vi.mock('~/lib/quotes/repo', () => ({
  getOrCreateDraftQuote: async () => ({id: 'q1', userId: 'u1', status: 'draft'}),
  getQuoteWithItems: (...a) => getQuoteWithItems(...a),
  markSubmitted: async () => ({folio: 'GI-0001'}),
  setQuoteDiscount: (...a) => setQuoteDiscount(...a),
  upsertQuoteItem: async () => {},
}));

vi.mock('~/lib/quotes/reprice.server', () => ({repriceItems: async (_ctx, items) => items}));

import {action} from './api.quote.submit.jsx';

const ITEMS = [
  {id: 'i1', variantId: 'gid://shopify/ProductVariant/1', title: 'Taza', qty: 300,
   baseUnitPrice: 25, effectiveUnitPrice: 29.97, technique: 'Sin decorado'},
];

function conCupon(over = {}) {
  return {
    quote: {id: 'q1', notes: null, deadline: null, discountCode: 'BIENVENIDOANDANAC',
            discountPercentage: 20, ...over},
    items: ITEMS,
  };
}

function enviar() {
  return action({
    request: new Request('https://gi.test/api/quote/submit', {method: 'POST', body: new FormData()}),
    context: {env: {ENVIRONMENT: 'development'}},
  });
}

/** El DraftOrderInput con que se llamó a Shopify. */
function inputEnviado() {
  return createDraftOrder.mock.calls[0][1];
}

beforeEach(() => {
  getDiscountByCode.mockReset();
  setQuoteDiscount.mockReset();
  createDraftOrder.mockReset();
  getQuoteWithItems.mockReset();
  notifyQuoteSubmitted.mockReset();
  createDraftOrder.mockResolvedValue({
    gid: 'gid://shopify/DraftOrder/1',
    invoiceUrl: 'https://invoice',
    customerGid: 'gid://shopify/Customer/1',
  });
});

describe('/api/quote/submit · cupón', () => {
  it('revalida el cupón contra Shopify y refresca el porcentaje guardado', async () => {
    getQuoteWithItems.mockResolvedValue(conCupon());
    // El comercial bajó el cupón de 20% a 15% después de que el cliente lo aplicó.
    getDiscountByCode.mockResolvedValueOnce({
      ok: true, code: 'BIENVENIDOANDANAC', title: 'Bienvenida', percentage: 15,
    });
    const res = await enviar();
    expect(res.status).toBe(200);
    expect(setQuoteDiscount).toHaveBeenCalledWith(expect.anything(), 'q1', {
      code: 'BIENVENIDOANDANAC',
      percentage: 15,
    });
    expect(inputEnviado().discountCodes).toEqual(['BIENVENIDOANDANAC']);
  });

  it('un cupón que ya venció se retira: ni viaja a Shopify ni queda en el PDF', async () => {
    getQuoteWithItems.mockResolvedValue(conCupon());
    getDiscountByCode.mockResolvedValueOnce({ok: false, reason: 'inactivo'});
    const res = await enviar();
    expect(res.status).toBe(200);
    expect(setQuoteDiscount).toHaveBeenCalledWith(expect.anything(), 'q1', null);
    expect(inputEnviado()).not.toHaveProperty('discountCodes');
  });

  it('sin cupón no le pregunta nada a Shopify', async () => {
    getQuoteWithItems.mockResolvedValue(
      conCupon({discountCode: null, discountPercentage: null}),
    );
    await enviar();
    expect(getDiscountByCode).not.toHaveBeenCalled();
    expect(setQuoteDiscount).not.toHaveBeenCalled();
  });

  it('si la validación del cupón truena, el envío sigue con lo que ya estaba guardado', async () => {
    getQuoteWithItems.mockResolvedValue(conCupon());
    getDiscountByCode.mockRejectedValueOnce(new Error('Admin API error: 500'));
    const res = await enviar();
    // Una cotización armada no se pierde por un hipo en la consulta del cupón.
    expect(res.status).toBe(200);
    expect(setQuoteDiscount).not.toHaveBeenCalled();
    expect(inputEnviado().discountCodes).toEqual(['BIENVENIDOANDANAC']);
  });
});

describe('/api/quote/submit · el cupón que llega a los correos', () => {
  it('los correos reciben el cupón YA revalidado, no el que estaba guardado', async () => {
    getQuoteWithItems.mockResolvedValue(conCupon());
    getDiscountByCode.mockResolvedValueOnce({ok: false, reason: 'inactivo'});
    await enviar();
    const [, payload] = notifyQuoteSubmitted.mock.calls[0];
    // El cupón venció: el PDF y los correos no pueden prometer un 20%.
    expect(payload.quote.discountCode).toBeNull();
    expect(payload.quote.discountPercentage).toBeNull();
  });

  it('un cupón vigente sí viaja a los correos con su porcentaje fresco', async () => {
    getQuoteWithItems.mockResolvedValue(conCupon());
    getDiscountByCode.mockResolvedValueOnce({
      ok: true, code: 'BIENVENIDOANDANAC', title: 'Bienvenida', percentage: 15,
    });
    await enviar();
    const [, payload] = notifyQuoteSubmitted.mock.calls[0];
    expect(payload.quote.discountCode).toBe('BIENVENIDOANDANAC');
    expect(payload.quote.discountPercentage).toBe(15);
  });
});
