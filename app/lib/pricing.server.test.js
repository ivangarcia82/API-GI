import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('@shopify/hydrogen', () => ({CacheShort: (o) => ({mode: 'short', ...o})}));

const getCustomerMarginRaw = vi.fn();
const getVariantCosts = vi.fn();
vi.mock('./admin/operations.js', () => ({
  getCustomerMarginRaw: (...a) => getCustomerMarginRaw(...a),
  getVariantCosts: (...a) => getVariantCosts(...a),
}));

const getSessionUser = vi.fn();
vi.mock('./auth/session.js', () => ({getSessionUser: (...a) => getSessionUser(...a)}));

import {getCustomerMargin, resolveBasePrices, applyCustomerPrices} from './pricing.server.js';

const opcionesDeCache = [];
const hazContexto = () => ({
  env: {PRIVATE_ADMIN_API_TOKEN: 't'},
  session: {},
  withCache: {
    run: (opciones, fn) => {
      opcionesDeCache.push(opciones);
      return fn();
    },
  },
});

const V = (n) => `gid://shopify/ProductVariant/${n}`;
const conMargen = (raw = '30') => {
  getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://shopify/Customer/1'});
  getCustomerMarginRaw.mockResolvedValue(raw);
};

beforeEach(() => {
  getCustomerMarginRaw.mockReset();
  getVariantCosts.mockReset();
  getSessionUser.mockReset();
  opcionesDeCache.length = 0;
});

describe('getCustomerMargin', () => {
  it('lee y valida el margen del cliente', async () => {
    conMargen('30.0');
    expect(await getCustomerMargin(hazContexto())).toBe(30);
  });

  it('la clave de caché lleva el gid del cliente', async () => {
    conMargen();
    await getCustomerMargin(hazContexto());
    expect(opcionesDeCache[0].cacheKey).toEqual(['gi-margin', 'gid://shopify/Customer/1']);
  });

  it('sin sesión o sin gid no toca la red', async () => {
    getSessionUser.mockReturnValue(null);
    expect(await getCustomerMargin(hazContexto())).toBeNull();
    getSessionUser.mockReturnValue({userId: 'u1', gid: null});
    expect(await getCustomerMargin(hazContexto())).toBeNull();
    expect(getCustomerMarginRaw).not.toHaveBeenCalled();
  });

  it('un valor inválido es lista, con aviso', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    conMargen('100');
    expect(await getCustomerMargin(hazContexto())).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('si el Admin API falla es lista', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://x'});
    getCustomerMarginRaw.mockRejectedValue(new Error('caído'));
    expect(await getCustomerMargin(hazContexto())).toBeNull();
    error.mockRestore();
  });

  it('se lee una sola vez por request', async () => {
    conMargen();
    const ctx = hazContexto();
    await Promise.all([getCustomerMargin(ctx), getCustomerMargin(ctx)]);
    expect(getCustomerMarginRaw).toHaveBeenCalledTimes(1);
  });
});

describe('resolveBasePrices', () => {
  it('sin margen devuelve la lista y no pide costos', async () => {
    getSessionUser.mockReturnValue(null);
    const out = await resolveBasePrices(hazContexto(), [{variantId: V(1), listPrice: 50}]);
    expect(out.get(V(1))).toBe(50);
    expect(getVariantCosts).not.toHaveBeenCalled();
  });

  it('con margen calcula sobre el costo; sin costo, lista', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({[V(1)]: 100, [V(2)]: null});
    const out = await resolveBasePrices(hazContexto(), [
      {variantId: V(1), listPrice: 333.33},
      {variantId: V(2), listPrice: 50},
    ]);
    expect(out.get(V(1))).toBe(142.86);
    expect(out.get(V(2))).toBe(50);
  });

  it('si los costos fallan es lista', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    conMargen('30');
    getVariantCosts.mockRejectedValue(new Error('caído'));
    const out = await resolveBasePrices(hazContexto(), [{variantId: V(1), listPrice: 50}]);
    expect(out.get(V(1))).toBe(50);
    error.mockRestore();
  });
});

describe('applyCustomerPrices', () => {
  /* Forma de un producto de GiProductCard. */
  const producto = () => ({
    id: 'gid://shopify/Product/9',
    priceRange: {minVariantPrice: {amount: '333.33', currencyCode: 'MXN'}},
    options: [{name: 'color', optionValues: [{name: 'ROJO', firstSelectableVariant: {id: V(7)}}]}],
    variants: {
      nodes: [{id: V(1), price: {amount: '333.33', currencyCode: 'MXN'}, compareAtPrice: {amount: '400.0'}}],
    },
  });

  it('sin margen devuelve lo mismo y no pide costos', async () => {
    getSessionUser.mockReturnValue(null);
    const data = {nodes: [producto()]};
    expect(await applyCustomerPrices(hazContexto(), data)).toBe(data);
    expect(getVariantCosts).not.toHaveBeenCalled();
  });

  it('reescribe precio de variante y priceRange, y quita compareAtPrice', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({[V(1)]: 100});
    const data = {nodes: [producto()]};
    const out = await applyCustomerPrices(hazContexto(), data);
    const p = out.nodes[0];
    expect(p.variants.nodes[0].price).toEqual({amount: '142.86', currencyCode: 'MXN'});
    expect(p.variants.nodes[0].compareAtPrice).toBeNull();
    expect(p.priceRange.minVariantPrice).toEqual({amount: '142.86', currencyCode: 'MXN'});
    // El original no se toca.
    expect(data.nodes[0].variants.nodes[0].price.amount).toBe('333.33');
  });

  it('sólo pide costos de variantes con precio, en una sola consulta', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({});
    await applyCustomerPrices(hazContexto(), {a: [producto()], b: {x: producto()}});
    expect(getVariantCosts).toHaveBeenCalledTimes(1);
    // V(7) sólo trae id (firstSelectableVariant de la tarjeta): no se pide.
    expect(getVariantCosts.mock.calls[0][1]).toEqual([V(1)]);
  });

  it('la clave de caché de costos es la misma para cualquier cliente', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({});
    await applyCustomerPrices(hazContexto(), {nodes: [producto()]});
    const claveCostos = opcionesDeCache.find((o) => o.cacheKey[0] === 'gi-variant-costs').cacheKey;
    expect(claveCostos).toEqual(['gi-variant-costs', V(1)]);
  });

  it('sin costo deja la lista en esa variante', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({[V(1)]: null});
    const out = await applyCustomerPrices(hazContexto(), {nodes: [producto()]});
    expect(Number(out.nodes[0].variants.nodes[0].price.amount)).toBe(333.33);
  });

  it('nunca devuelve el costo', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({[V(1)]: 100});
    const out = await applyCustomerPrices(hazContexto(), {nodes: [producto()]});
    expect(JSON.stringify(out)).not.toMatch(/unitCost|inventoryItem|"100"/);
  });

  it('tolera null', async () => {
    conMargen('30');
    expect(await applyCustomerPrices(hazContexto(), null)).toBeNull();
  });
});

describe('resolveBasePrices estricto (para repreciar cotizaciones)', () => {
  it('si los costos fallan, lanza en vez de caer a lista', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    conMargen('30');
    getVariantCosts.mockRejectedValue(new Error('caído'));
    await expect(
      resolveBasePrices(hazContexto(), [{variantId: V(1), listPrice: 50}], {strict: true}),
    ).rejects.toThrow();
    error.mockRestore();
  });

  it('si el margen no se pudo leer, lanza en vez de caer a lista', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://x'});
    getCustomerMarginRaw.mockRejectedValue(new Error('caído'));
    await expect(
      resolveBasePrices(hazContexto(), [{variantId: V(1), listPrice: 50}], {strict: true}),
    ).rejects.toThrow();
    error.mockRestore();
  });

  it('un cliente sin margen no es un fallo: lista', async () => {
    getSessionUser.mockReturnValue(null);
    const out = await resolveBasePrices(hazContexto(), [{variantId: V(1), listPrice: 50}], {strict: true});
    expect(out.get(V(1))).toBe(50);
  });
});

describe('caché de costos', () => {
  it('dura minutos, no segundos: el costo casi no cambia', async () => {
    conMargen('30');
    getVariantCosts.mockResolvedValue({});
    await applyCustomerPrices(hazContexto(), {nodes: [{id: V(1), price: {amount: '1'}}]});
    const {cacheStrategy} = opcionesDeCache.find((o) => o.cacheKey[0] === 'gi-variant-costs');
    expect(cacheStrategy.maxAge).toBeGreaterThanOrEqual(300);
  });
});
