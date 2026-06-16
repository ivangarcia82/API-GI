// Pure mapping: quote + items -> Shopify DraftOrderInput (Admin API 2026-04).
// Decoration price is integrated into originalUnitPriceWithCurrency, never as an attribute.

const CURRENCY = 'MXN';

function hasDecoration(item) {
  return Boolean(item.technique) && item.technique !== 'Sin decorado';
}

function lineTitle(item) {
  if (hasDecoration(item)) {
    const parts = [item.technique, item.size].filter(Boolean).join(' ');
    return `${item.title} — ${parts}`.trim();
  }
  return item.title;
}

function lineAttributes(item) {
  const attrs = [];
  if (hasDecoration(item)) {
    attrs.push({key: 'Decorado', value: `${item.technique} - ${item.size}`});
  }
  attrs.push({key: 'VariantRef', value: item.variantId});
  return attrs;
}

export function buildDraftOrderInput({quote, items, customerGid, email}) {
  const input = {
    email,
    presentmentCurrencyCode: CURRENCY,
    note: quote.notes ?? null,
    lineItems: items.map((item) => ({
      title: lineTitle(item),
      quantity: item.qty,
      originalUnitPriceWithCurrency: {
        amount: Number(item.effectiveUnitPrice).toFixed(2),
        currencyCode: CURRENCY,
      },
      customAttributes: lineAttributes(item),
    })),
  };
  // Link the customer explicitly when we resolved a real gid; otherwise Shopify
  // associates the draft order with the customer by email (existing or new).
  if (customerGid && !String(customerGid).includes('STUB-')) {
    input.purchasingEntity = {customerId: customerGid};
  }
  return input;
}
