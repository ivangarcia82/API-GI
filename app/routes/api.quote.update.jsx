import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getOrCreateDraftQuote, getQuoteWithItems, upsertQuoteItem} from '~/lib/quotes/repo';
import {recomputeItemPricing} from '~/lib/quotes/recompute';

export async function action({request, context}) {
  assertSameOrigin(request);
  const sessionUser = await requireUser(context);
  const {env} = context;
  const db = getDb(env);

  const form = await request.formData();
  const itemId = String(form.get('itemId') || '');
  const qty = Math.max(1, Math.trunc(Number(form.get('qty')) || 1));
  if (!itemId) return Response.json({error: 'Falta itemId.'}, {status: 400});

  const quote = await getOrCreateDraftQuote(db, sessionUser.userId);
  const {items} = await getQuoteWithItems(db, quote.id);
  const existing = items.find((i) => i.id === itemId);
  if (!existing) return Response.json({error: 'Ítem no encontrado.'}, {status: 404});

  // Recompute from the persisted base price (never trust client prices) + new qty.
  const priced = recomputeItemPricing({
    baseUnitPrice: existing.baseUnitPrice,
    technique: existing.technique,
    surface: existing.surface,
    size: existing.size,
    qty,
  });
  if (priced.error) return Response.json({error: priced.error}, {status: 422});

  await upsertQuoteItem(db, quote.id, {
    ...existing,
    qty,
    decorationTotal: priced.decorationTotal,
    effectiveUnitPrice: priced.effectiveUnitPrice,
  });

  const after = await getQuoteWithItems(db, quote.id);
  return Response.json({ok: true, quoteId: quote.id, items: after.items});
}
