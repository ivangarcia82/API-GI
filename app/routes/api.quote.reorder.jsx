import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getOrCreateDraftQuote, getQuoteWithItems, upsertQuoteItem} from '~/lib/quotes/repo';
import {recomputeItemPricing} from '~/lib/quotes/recompute';

// Copy a past quote's items into the user's active draft ("Volver a cotizar").
// Pricing is recomputed server-side from the persisted decoration inputs; the
// advisor still confirms current catalog pricing before issuing the real quote.
export async function action({request, context}) {
  assertSameOrigin(request);
  const sessionUser = await requireUser(context);
  const db = getDb(context.env);

  const form = await request.formData();
  const sourceQuoteId = String(form.get('sourceQuoteId') || '');
  if (!sourceQuoteId) return Response.json({error: 'Falta sourceQuoteId.'}, {status: 400});

  const source = await getQuoteWithItems(db, sourceQuoteId);
  // Ownership check: never copy another user's quote.
  if (!source.quote || source.quote.userId !== sessionUser.userId) {
    return Response.json({error: 'Cotización no encontrada.'}, {status: 404});
  }
  if (source.items.length === 0) {
    return Response.json({error: 'Esa cotización no tiene productos.'}, {status: 400});
  }

  const draft = await getOrCreateDraftQuote(db, sessionUser.userId);
  for (const item of source.items) {
    const priced = recomputeItemPricing({
      baseUnitPrice: item.baseUnitPrice,
      technique: item.technique,
      surface: item.surface,
      size: item.size,
      qty: item.qty,
    });
    // Skip an item whose decoration no longer resolves (e.g. retired technique).
    if (priced.error) continue;
    await upsertQuoteItem(db, draft.id, {
      id: crypto.randomUUID(),
      quoteId: draft.id,
      variantId: item.variantId,
      productHandle: item.productHandle,
      title: item.title,
      qty: item.qty,
      image: item.image,
      baseUnitPrice: priced.baseUnitPrice,
      technique: item.technique,
      surface: item.surface,
      size: item.size,
      decorationTotal: priced.decorationTotal,
      effectiveUnitPrice: priced.effectiveUnitPrice,
    });
  }

  const {items} = await getQuoteWithItems(db, draft.id);
  return Response.json({ok: true, quoteId: draft.id, items});
}
