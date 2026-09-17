import {describe, it, expect, vi, beforeEach} from 'vitest';

const clearQuote = vi.fn();
const removeQuoteItem = vi.fn();
const setQuoteDiscount = vi.fn();
const getQuoteWithItems = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));
vi.mock('~/lib/auth/guard', () => ({
  requireUser: async () => ({userId: 'u1', sessionVersion: 1}),
}));
vi.mock('~/lib/quotes/repo', () => ({
  getOrCreateDraftQuote: async () => ({id: 'q1', userId: 'u1', status: 'draft'}),
  clearQuote: (...a) => clearQuote(...a),
  removeQuoteItem: (...a) => removeQuoteItem(...a),
  setQuoteDiscount: (...a) => setQuoteDiscount(...a),
  getQuoteWithItems: (...a) => getQuoteWithItems(...a),
}));

import {action} from './api.quote.remove.jsx';

function pedir(campos) {
  const body = new FormData();
  for (const [k, v] of Object.entries(campos)) body.set(k, v);
  return action({
    request: new Request('https://gi.test/api/quote/remove', {method: 'POST', body}),
    context: {env: {}},
  });
}

beforeEach(() => {
  clearQuote.mockReset();
  removeQuoteItem.mockReset();
  setQuoteDiscount.mockReset();
  getQuoteWithItems.mockReset().mockResolvedValue({quote: {id: 'q1'}, items: []});
});

describe('/api/quote/remove · cupón', () => {
  /* Vaciar la lista arranca de cero. Si el cupón sobreviviera, el cajón lo
     seguiría pintando sobre una cotización que en el servidor ya no lo tiene
     —y eso es justo lo que pasa al enviar, porque el envío vacía la lista. */
  it('vaciar la lista también retira el cupón y lo dice en la respuesta', async () => {
    const res = await pedir({clear: 'true'});
    expect(setQuoteDiscount).toHaveBeenCalledWith({__db: true}, 'q1', null);
    expect(await res.json()).toMatchObject({ok: true, discount: null});
  });

  it('quitar UN producto no toca el cupón', async () => {
    getQuoteWithItems.mockResolvedValue({quote: {id: 'q1'}, items: [{id: 'i2'}]});
    const res = await pedir({itemId: 'i1'});
    expect(setQuoteDiscount).not.toHaveBeenCalled();
    // Sin la llave `discount`, el cliente conserva el cupón que ya tenía.
    expect(await res.json()).not.toHaveProperty('discount');
  });
});
