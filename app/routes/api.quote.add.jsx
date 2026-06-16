import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getOrCreateDraftQuote, upsertQuoteItem, getQuoteWithItems} from '~/lib/quotes/repo';
import {recomputeItemPricing} from '~/lib/quotes/recompute';

const PRODUCT_PRICE_QUERY = `#graphql
  query QuoteVariant($id: ID!) {
    node(id: $id) {
      ... on ProductVariant {
        id
        title
        price { amount }
        product { handle title }
      }
    }
  }
`;

export async function action({request, context}) {
  assertSameOrigin(request);
  const sessionUser = await requireUser(context);
  const {env, storefront} = context;
  const db = getDb(env);

  const form = await request.formData();
  const variantId = String(form.get('variantId') || '');
  const technique = String(form.get('technique') || '');
  const surface = String(form.get('surface') || '');
  const size = String(form.get('size') || '');
  const qty = Math.max(1, Math.trunc(Number(form.get('qty')) || 1));
  if (!variantId) return Response.json({error: 'Falta variantId.'}, {status: 400});

  // Authoritative base price from the Storefront.
  const {node} = await storefront.query(PRODUCT_PRICE_QUERY, {variables: {id: variantId}});
  if (!node) return Response.json({error: 'Variante no encontrada.'}, {status: 404});
  const baseUnitPrice = Number(node.price?.amount) || 0;

  const priced = recomputeItemPricing({baseUnitPrice, technique, surface, size, qty});
  if (priced.error) return Response.json({error: priced.error}, {status: 422});

  const quote = await getOrCreateDraftQuote(db, sessionUser.userId);
  await upsertQuoteItem(db, quote.id, {
    id: crypto.randomUUID(),
    quoteId: quote.id,
    variantId,
    productHandle: node.product?.handle ?? null,
    title: node.product?.title ?? node.title ?? null,
    qty,
    baseUnitPrice: priced.baseUnitPrice,
    technique: technique || null,
    surface: surface || null,
    size: size || null,
    decorationTotal: priced.decorationTotal,
    effectiveUnitPrice: priced.effectiveUnitPrice,
  });

  const {items} = await getQuoteWithItems(db, quote.id);
  return Response.json({ok: true, quoteId: quote.id, items});
}
