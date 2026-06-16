// Pure mapping: quote + items -> Shopify DraftOrderInput (Admin API 2026-04).
// Prefer VARIANT line items (variantId + priceOverride) so the draft order shows
// the product image; the decoration is folded into priceOverride (which replaces
// the variant's catalog price). Falls back to a custom line (no image) only when
// there is no real ProductVariant gid. Decoration detail rides as a line attribute.

const CURRENCY = 'MXN';

function hasDecoration(item) {
  return Boolean(item.technique) && item.technique !== 'Sin decorado';
}

function isVariantGid(variantId) {
  return typeof variantId === 'string' && variantId.includes('/ProductVariant/');
}

function lineTitle(item) {
  if (hasDecoration(item)) {
    const parts = [item.technique, item.size].filter(Boolean).join(' ');
    return `${item.title} — ${parts}`.trim();
  }
  return item.title;
}

/** The decoration descriptor as a line attribute (empty when "Sin decorado"). */
function decorationAttribute(item) {
  return hasDecoration(item)
    ? [{key: 'Decorado', value: `${item.technique} - ${item.size}`}]
    : [];
}

function lineItem(item) {
  const price = {
    amount: Number(item.effectiveUnitPrice).toFixed(2),
    currencyCode: CURRENCY,
  };
  if (isVariantGid(item.variantId)) {
    // Variant line: Shopify shows the product image; priceOverride replaces the
    // catalog price with our decoration-inclusive unit price.
    return {
      variantId: item.variantId,
      quantity: item.qty,
      priceOverride: price,
      customAttributes: decorationAttribute(item),
    };
  }
  // Fallback custom line (no image) when there's no real variant id.
  return {
    title: lineTitle(item),
    quantity: item.qty,
    originalUnitPriceWithCurrency: price,
    customAttributes: [
      ...decorationAttribute(item),
      {key: 'VariantRef', value: String(item.variantId)},
    ],
  };
}

export function buildDraftOrderInput({quote, items, customerGid, email}) {
  const input = {
    email,
    presentmentCurrencyCode: CURRENCY,
    note: quote.notes ?? null,
    lineItems: items.map(lineItem),
  };
  // Link the customer explicitly when we resolved a real gid; otherwise Shopify
  // associates the draft order with the customer by email (existing or new).
  if (customerGid && !String(customerGid).includes('STUB-')) {
    input.purchasingEntity = {customerId: customerGid};
  }
  return input;
}
