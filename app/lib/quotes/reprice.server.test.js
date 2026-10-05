import {describe, it, expect, vi, beforeEach} from 'vitest';

const resolveBasePrices = vi.fn();
vi.mock('../pricing.server.js', () => ({
  resolveBasePrices: (...a) => resolveBasePrices(...a),
}));

import {repriceItems} from './reprice.server.js';

const V = (n) => `gid://shopify/ProductVariant/${n}`;
const item = (over = {}) => ({
  id: 'i1', variantId: V(1), qty: 10, technique: 'Sin decorado', surface: null, size: null,
  baseUnitPrice: 100, decorationTotal: 0, effectiveUnitPrice: 100, ...over,
});

const storefrontQuery = vi.fn();
const ctx = () => ({storefront: {query: (...a) => storefrontQuery(...a)}});

beforeEach(() => {
  resolveBasePrices.mockReset();
  storefrontQuery.mockReset();
});

describe('repriceItems', () => {
  it('recalcula con el precio de lista actual y el margen', async () => {
    storefrontQuery.mockResolvedValue({nodes: [{id: V(1), price: {amount: '120.0'}}]});
    resolveBasePrices.mockResolvedValue(new Map([[V(1), 90]]));
    const [out] = await repriceItems(ctx(), [item()]);
    expect(resolveBasePrices.mock.calls[0][1]).toEqual([{variantId: V(1), listPrice: 120}]);
    expect(out).toMatchObject({id: 'i1', baseUnitPrice: 90, effectiveUnitPrice: 90});
  });

  it('una variante que ya no existe conserva lo guardado', async () => {
    storefrontQuery.mockResolvedValue({nodes: [null]});
    resolveBasePrices.mockResolvedValue(new Map());
    const original = item();
    const [out] = await repriceItems(ctx(), [original]);
    expect(out).toBe(original);
  });

  it('si Storefront falla devuelve los items tal cual', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    storefrontQuery.mockRejectedValue(new Error('caído'));
    const items = [item()];
    expect(await repriceItems(ctx(), items)).toBe(items);
    error.mockRestore();
  });

  it('lista vacía no consulta', async () => {
    expect(await repriceItems(ctx(), [])).toEqual([]);
    expect(storefrontQuery).not.toHaveBeenCalled();
  });
});
