import {describe, it, expect, vi, beforeEach} from 'vitest';

const setQuoteDiscount = vi.fn();
const getQuoteWithItems = vi.fn();
const getDiscountByCode = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));
vi.mock('~/lib/auth/guard', () => ({
  requireUser: async () => ({userId: 'u1', sessionVersion: 1}),
}));
vi.mock('~/lib/quotes/repo', () => ({
  getOrCreateDraftQuote: async () => ({id: 'q1', userId: 'u1', status: 'draft'}),
  setQuoteDiscount: (...a) => setQuoteDiscount(...a),
  getQuoteWithItems: (...a) => getQuoteWithItems(...a),
}));
vi.mock('~/lib/admin/operations', () => ({
  getDiscountByCode: (...a) => getDiscountByCode(...a),
}));

import {action} from './api.quote.discount.jsx';

const ITEMS = [{id: 'i1', effectiveUnitPrice: 29.97, qty: 300}];

function pedir(campos) {
  const body = new FormData();
  for (const [k, v] of Object.entries(campos)) body.set(k, v);
  return action({
    request: new Request('https://gi.test/api/quote/discount', {method: 'POST', body}),
    context: {env: {}},
  });
}

beforeEach(() => {
  setQuoteDiscount.mockReset();
  getQuoteWithItems.mockReset();
  getDiscountByCode.mockReset();
  getQuoteWithItems.mockResolvedValue({quote: {id: 'q1'}, items: ITEMS});
});

describe('/api/quote/discount', () => {
  it('un cupón válido se guarda y vuelve con el porcentaje de Shopify', async () => {
    getDiscountByCode.mockResolvedValueOnce({
      ok: true,
      code: 'BIENVENIDOANDANAC',
      title: 'Bienvenida ANDANAC',
      percentage: 20,
    });
    const res = await pedir({code: 'bienvenidoandanac'});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.discount).toEqual({
      code: 'BIENVENIDOANDANAC',
      title: 'Bienvenida ANDANAC',
      percentage: 20,
    });
    expect(setQuoteDiscount).toHaveBeenCalledWith({__db: true}, 'q1', {
      code: 'BIENVENIDOANDANAC',
      percentage: 20,
    });
    // El cajón reconcilia su lista con la respuesta, igual que las otras rutas.
    expect(data.items).toEqual(ITEMS);
  });

  it('un cupón inexistente responde 422 y NO toca la cotización', async () => {
    getDiscountByCode.mockResolvedValueOnce({ok: false, reason: 'no-existe'});
    const res = await pedir({code: 'NOEXISTE'});
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toMatch(/no existe|no es válido/i);
    expect(setQuoteDiscount).not.toHaveBeenCalled();
  });

  it('cada motivo de rechazo trae su propio mensaje, no uno genérico', async () => {
    const mensajes = [];
    for (const reason of ['inactivo', 'no-porcentaje', 'restringido']) {
      getDiscountByCode.mockResolvedValueOnce({ok: false, reason});
      const res = await pedir({code: 'X'});
      expect(res.status).toBe(422);
      mensajes.push((await res.json()).error);
    }
    expect(new Set(mensajes).size).toBe(3);
    expect(mensajes[0]).toMatch(/vigente|activo|venc/i);
  });

  it('quitar el cupón lo borra sin preguntarle nada a Shopify', async () => {
    const res = await pedir({clear: 'true'});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.discount).toBeNull();
    expect(setQuoteDiscount).toHaveBeenCalledWith({__db: true}, 'q1', null);
    expect(getDiscountByCode).not.toHaveBeenCalled();
  });

  it('un código vacío se responde como falta de código, no como cupón inválido', async () => {
    const res = await pedir({code: '   '});
    expect(res.status).toBe(400);
    expect(setQuoteDiscount).not.toHaveBeenCalled();
    expect(getDiscountByCode).not.toHaveBeenCalled();
  });

  it('si el Admin API falla, el cupón no se guarda a medias', async () => {
    getDiscountByCode.mockRejectedValueOnce(new Error('Admin API error: 401'));
    const res = await pedir({code: 'BIENVENIDOANDANAC'});
    expect(res.status).toBe(502);
    expect(setQuoteDiscount).not.toHaveBeenCalled();
  });
});
