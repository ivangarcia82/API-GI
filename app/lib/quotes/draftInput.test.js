import {describe, it, expect} from 'vitest';
import {buildDraftOrderInput} from './draftInput.js';

const QUOTE = {
  id: 'q-1',
  userId: 'user-1',
  status: 'draft',
  notes: 'Para evento de junio',
  deadline: null,
  shopifyDraftOrderGid: null,
  shopifyInvoiceUrl: null,
};

const ITEMS = [
  {
    id: 'i-1',
    quoteId: 'q-1',
    variantId: 'gid://shopify/ProductVariant/111',
    productHandle: 'taza',
    title: 'Taza clásica',
    qty: 300,
    baseUnitPrice: 25,
    technique: 'SERIGRAFÍA',
    surface: 'TEXTIL',
    size: '4 x 4',
    decorationTotal: 1491.0447761194,
    effectiveUnitPrice: 29.97,
  },
  {
    id: 'i-2',
    quoteId: 'q-1',
    variantId: 'gid://shopify/ProductVariant/222',
    productHandle: 'pluma',
    title: 'Pluma metálica',
    qty: 50,
    baseUnitPrice: 12.5,
    technique: 'Sin decorado',
    surface: '',
    size: '',
    decorationTotal: 0,
    effectiveUnitPrice: 12.5,
  },
];

describe('buildDraftOrderInput', () => {
  it('maps quote + items + customer gid to a DraftOrderInput', () => {
    const input = buildDraftOrderInput({
      quote: QUOTE,
      items: ITEMS,
      customerGid: 'gid://shopify/Customer/999',
      email: 'u1@example.com',
    });

    expect(input.purchasingEntity).toEqual({customerId: 'gid://shopify/Customer/999'});
    expect(input.email).toBe('u1@example.com');
    expect(input.presentmentCurrencyCode).toBe('MXN');
    expect(input.note).toBe('Para evento de junio');
    expect(input.lineItems).toHaveLength(2);

    // Variant line items (so the draft order shows the product image); the
    // decoration-inclusive price rides on priceOverride.
    const l0 = input.lineItems[0];
    expect(l0.variantId).toBe('gid://shopify/ProductVariant/111');
    expect(l0.quantity).toBe(300);
    expect(l0.priceOverride).toEqual({amount: '29.97', currencyCode: 'MXN'});
    expect(l0.title).toBeUndefined(); // ignored when variantId is set
    expect(l0.originalUnitPriceWithCurrency).toBeUndefined();
    expect(l0.customAttributes).toEqual([{key: 'Decorado', value: 'SERIGRAFÍA - 4 x 4'}]);

    const l1 = input.lineItems[1];
    expect(l1.variantId).toBe('gid://shopify/ProductVariant/222');
    expect(l1.priceOverride).toEqual({amount: '12.50', currencyCode: 'MXN'});
    expect(l1.customAttributes).toEqual([]); // "Sin decorado" → no decoration attribute
  });

  it('falls back to a custom line (no variant) when there is no ProductVariant gid', () => {
    const input = buildDraftOrderInput({
      quote: QUOTE,
      items: [{...ITEMS[0], variantId: 'gid://shopify/Product/1'}],
      customerGid: 'gid://shopify/Customer/1',
      email: 'x@y.z',
    });
    const l = input.lineItems[0];
    expect(l.variantId).toBeUndefined();
    expect(l.title).toBe('Taza clásica — SERIGRAFÍA 4 x 4');
    expect(l.originalUnitPriceWithCurrency).toEqual({amount: '29.97', currencyCode: 'MXN'});
    expect(l.priceOverride).toBeUndefined();
    expect(l.customAttributes).toEqual([
      {key: 'Decorado', value: 'SERIGRAFÍA - 4 x 4'},
      {key: 'VariantRef', value: 'gid://shopify/Product/1'},
    ]);
  });

  it('omits purchasingEntity and links by email when there is no real customer gid', () => {
    const withNull = buildDraftOrderInput({
      quote: QUOTE,
      items: ITEMS,
      customerGid: null,
      email: 'u1@example.com',
    });
    expect(withNull.purchasingEntity).toBeUndefined();
    expect(withNull.email).toBe('u1@example.com');

    const withStub = buildDraftOrderInput({
      quote: QUOTE,
      items: ITEMS,
      customerGid: 'gid://shopify/Customer/STUB-abc',
      email: 'u1@example.com',
    });
    expect(withStub.purchasingEntity).toBeUndefined();
  });

  it('formats amount with exactly 2 decimals', () => {
    const input = buildDraftOrderInput({
      quote: QUOTE,
      items: [{...ITEMS[0], effectiveUnitPrice: 5}],
      customerGid: 'gid://shopify/Customer/1',
      email: 'x@y.z',
    });
    expect(input.lineItems[0].priceOverride.amount).toBe('5.00');
  });
});
