import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getOrCreateDraftQuote, upsertQuoteItem, getQuoteWithItems} from '~/lib/quotes/repo';
import {recomputeItemPricing} from '~/lib/quotes/recompute';
import {getTechniques} from '~/lib/decoration/engine';
import {resolveBasePrices} from '~/lib/pricing.server';

// Authoritative product data for pricing: base price/image PLUS the decoration
// metafields (material = surface, tecnicas_de_impresion = offered techniques).
// Pricing reads these — never the client-supplied surface/technique — so a forged
// request can't pick a cheaper price group or a technique the product never offers.
const PRODUCT_PRICE_QUERY = `#graphql
  query QuoteVariant($id: ID!) {
    node(id: $id) {
      ... on ProductVariant {
        id
        title
        price { amount }
        image { url }
        product {
          handle
          title
          featuredImage { url }
          metafields(identifiers: [
            {namespace: "custom", key: "material"},
            {namespace: "custom", key: "tecnicas_de_impresion"}
          ]) { namespace key value }
        }
      }
    }
  }
`;

/** Read a custom.<key> metafield value from a Storefront metafields array. */
function readMetafield(metafields, key) {
  const mf = (metafields || []).find(
    (m) => m && m.namespace === 'custom' && m.key === key,
  );
  return mf?.value ?? null;
}

export async function action({request, context}) {
  assertSameOrigin(request);
  const sessionUser = await requireUser(context);
  const {env, storefront} = context;
  const db = getDb(env);

  const form = await request.formData();
  const variantId = String(form.get('variantId') || '');
  const technique = String(form.get('technique') || '');
  // Note: the client-supplied surface is intentionally NOT read — the product's
  // authoritative `custom.material` metafield is used for pricing instead.
  const size = String(form.get('size') || '');
  const qty = Math.max(1, Math.trunc(Number(form.get('qty')) || 1));
  if (!variantId) return Response.json({error: 'Falta variantId.'}, {status: 400});

  // Authoritative base price from the Storefront.
  const {node} = await storefront.query(PRODUCT_PRICE_QUERY, {variables: {id: variantId}});
  if (!node) return Response.json({error: 'Variante no encontrada.'}, {status: 404});
  // El precio base es el del cliente: costo / (1 − margen) si tiene
  // custom.margen, el de lista si no. Siempre del servidor, nunca del cliente.
  const listPrice = Number(node.price?.amount) || 0;
  const bases = await resolveBasePrices(context, [{variantId, listPrice}]);
  const baseUnitPrice = bases.get(variantId) ?? listPrice;
  // Prefer the selected variant's image; fall back to the product's featured
  // image so the quote/cart always shows something for variant products.
  const image = node.image?.url ?? node.product?.featuredImage?.url ?? null;

  // Authoritative decoration inputs from the product's own metafields. The
  // client-supplied `surface` is ignored for pricing; `technique` is validated
  // against what the product actually offers. A normal UI add always matches
  // (its options come from these same metafields) — this only blocks forgeries.
  const metafields = node.product?.metafields;
  const authoritativeSurface = String(readMetafield(metafields, 'material') ?? '');
  const offeredTechniques = getTechniques(readMetafield(metafields, 'tecnicas_de_impresion'));
  const wantsDecoration = Boolean(technique) && technique !== 'Sin decorado';
  if (wantsDecoration && !offeredTechniques.includes(technique)) {
    return Response.json(
      {error: 'Esa técnica de decorado no está disponible para este producto.'},
      {status: 422},
    );
  }

  const priced = recomputeItemPricing({
    baseUnitPrice,
    technique,
    surface: authoritativeSurface,
    size,
    qty,
  });
  if (priced.error) return Response.json({error: priced.error}, {status: 422});

  const quote = await getOrCreateDraftQuote(db, sessionUser.userId);
  await upsertQuoteItem(db, quote.id, {
    id: crypto.randomUUID(),
    quoteId: quote.id,
    variantId,
    productHandle: node.product?.handle ?? null,
    title: node.product?.title ?? node.title ?? null,
    qty,
    image,
    baseUnitPrice: priced.baseUnitPrice,
    technique: technique || null,
    surface: wantsDecoration ? authoritativeSurface || null : null,
    size: size || null,
    decorationTotal: priced.decorationTotal,
    effectiveUnitPrice: priced.effectiveUnitPrice,
  });

  const {items} = await getQuoteWithItems(db, quote.id);
  return Response.json({ok: true, quoteId: quote.id, items});
}
