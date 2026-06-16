// Pure server-side recompute. Client never supplies prices.
import {calcDecoration, effectiveUnitPrice, round2} from '~/lib/decoration/engine';

export function recomputeItemPricing({baseUnitPrice, technique, surface, size, qty}) {
  const base = Number(baseUnitPrice) || 0;
  const q = Math.max(1, Math.trunc(Number(qty) || 1));
  const dec = calcDecoration(technique, surface, q, size);
  if (dec.error) {
    return {error: dec.error, baseUnitPrice: base, decorationTotal: 0, effectiveUnitPrice: round2(base)};
  }
  const decorationTotal = dec.totalPrice;
  const effective = round2(effectiveUnitPrice(base, decorationTotal, q));
  return {
    error: null,
    baseUnitPrice: base,
    decorationTotal,
    effectiveUnitPrice: effective,
  };
}
