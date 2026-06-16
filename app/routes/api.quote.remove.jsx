import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getOrCreateDraftQuote, removeQuoteItem, clearQuote, getQuoteWithItems} from '~/lib/quotes/repo';

export async function action({request, context}) {
  assertSameOrigin(request);
  const sessionUser = await requireUser(context);
  const {env} = context;
  const db = getDb(env);

  const form = await request.formData();
  const itemId = String(form.get('itemId') || '');
  const clearAll = String(form.get('clear') || '') === 'true';

  const quote = await getOrCreateDraftQuote(db, sessionUser.userId);
  if (clearAll) {
    await clearQuote(db, quote.id);
  } else {
    if (!itemId) return Response.json({error: 'Falta itemId.'}, {status: 400});
    await removeQuoteItem(db, quote.id, itemId);
  }

  const {items} = await getQuoteWithItems(db, quote.id);
  return Response.json({ok: true, quoteId: quote.id, items});
}
