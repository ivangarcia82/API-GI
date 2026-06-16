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

    const l0 = input.lineItems[0];
    expect(l0.title).toBe('Taza clásica — SERIGRAFÍA 4 x 4');
    expect(l0.quantity).toBe(300);
    expect(l0.originalUnitPriceWithCurrency).toEqual({amount: '29.97', currencyCode: 'MXN'});
    expect(l0.variantId).toBeUndefined(); // custom line, no variant
    expect(l0.customAttributes).toEqual([
      {key: 'Decorado', value: 'SERIGRAFÍA - 4 x 4'},
      {key: 'VariantRef', value: 'gid://shopify/ProductVariant/111'},
    ]);

    const l1 = input.lineItems[1];
    expect(l1.title).toBe('Pluma metálica'); // no decoration suffix when "Sin decorado"
    expect(l1.originalUnitPriceWithCurrency).toEqual({amount: '12.50', currencyCode: 'MXN'});
    expect(l1.customAttributes).toEqual([
      {key: 'VariantRef', value: 'gid://shopify/ProductVariant/222'},
    ]);
  });

  it('formats amount with exactly 2 decimals', () => {
    const input = buildDraftOrderInput({
      quote: QUOTE,
      items: [{...ITEMS[0], effectiveUnitPrice: 5}],
      customerGid: 'gid://shopify/Customer/1',
      email: 'x@y.z',
    });
    expect(input.lineItems[0].originalUnitPriceWithCurrency.amount).toBe('5.00');
  });
});
