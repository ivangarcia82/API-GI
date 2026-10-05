import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getOrCreateDraftQuote, upsertQuoteItem, getQuoteWithItems} from '~/lib/quotes/repo';
import {recomputeItemPricing} from '~/lib/quotes/recompute';
import {getTechniques} from '~/lib/decoration/engine';
import {resolveBasePrices} from '~/lib/pricing.server';
import {MAX_GUEST_LINES} from '~/lib/quote-guest';

// Migra el carrito que el invitado armo en localStorage al borrador del
// usuario que acaba de entrar. El cuerpo trae SÓLO intención (variante,
// técnica, sustrato, talla, cantidad): precio, título e imagen se vuelven a
// pedir aquí, igual que en /api/quote/add, para que un localStorage
// manipulado no pueda abaratar una cotización.
//
// Una sola consulta para todo el lote: cincuenta líneas serían cincuenta
// viajes a la Storefront justo en el primer render después del login.
const VARIANTS_QUERY = `#graphql
  query QuoteMergeVariants($ids: [ID!]!) {
    nodes(ids: $ids) {
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

/** Lee un metafield custom.<key> del arreglo que devuelve la Storefront. */
function readMetafield(metafields, key) {
  const mf = (metafields || []).find(
    (m) => m && m.namespace === 'custom' && m.key === key,
  );
  return mf?.value ?? null;
}

/** El cuerpo lo escribe el navegador: se sanea antes de mirarlo. */
function sanearLinea(raw) {
  const variantId = String(raw?.variantId ?? '').trim();
  if (!variantId) return null;
  const qty = Math.max(1, Math.trunc(Number(raw?.qty) || 1));
  return {
    variantId,
    technique: String(raw?.technique ?? '').trim() || 'Sin decorado',
    size: String(raw?.size ?? ''),
    qty,
  };
}

export async function action({request, context}) {
  assertSameOrigin(request);
  const sessionUser = await requireUser(context);
  const {env, storefront} = context;

  const form = await request.formData();
  let crudas;
  try {
    crudas = JSON.parse(String(form.get('lines') ?? ''));
  } catch {
    return Response.json({error: 'Cuerpo inválido.'}, {status: 400});
  }
  if (!Array.isArray(crudas)) {
    return Response.json({error: 'Cuerpo inválido.'}, {status: 400});
  }

  const lineas = crudas.slice(0, MAX_GUEST_LINES).map(sanearLinea).filter(Boolean);
  const descartadasDeEntrada = crudas.slice(0, MAX_GUEST_LINES).length - lineas.length;

  const db = getDb(env);
  const quote = await getOrCreateDraftQuote(db, sessionUser.userId);

  if (lineas.length === 0) {
    const {items} = await getQuoteWithItems(db, quote.id);
    return Response.json({
      ok: true,
      quoteId: quote.id,
      items,
      migradas: 0,
      descartadas: descartadasDeEntrada,
    });
  }

  const ids = [...new Set(lineas.map((l) => l.variantId))];
  const {nodes} = await storefront.query(VARIANTS_QUERY, {variables: {ids}});
  const porId = new Map(
    (nodes || []).filter((n) => n && n.id).map((n) => [n.id, n]),
  );

  // Una sola resolución para todo el lote, como la consulta de arriba.
  const bases = await resolveBasePrices(
    context,
    [...porId.values()].map((n) => ({variantId: n.id, listPrice: Number(n.price?.amount) || 0})),
  );

  let migradas = 0;
  let descartadas = descartadasDeEntrada;

  // En serie y no en paralelo: upsertQuoteItem toca la misma fila de `quotes`
  // (updated_at) en cada llamada.
  for (const linea of lineas) {
    const node = porId.get(linea.variantId);
    if (!node) {
      // La variante murió o dejó de publicarse desde que la agregó.
      descartadas += 1;
      continue;
    }

    const metafields = node.product?.metafields;
    // El sustrato autoritativo es el del producto; el que mande el cliente se
    // ignora, igual que en /api/quote/add.
    const surface = String(readMetafield(metafields, 'material') ?? '');
    const ofrecidas = getTechniques(readMetafield(metafields, 'tecnicas_de_impresion'));
    const quiereDecorado = Boolean(linea.technique) && linea.technique !== 'Sin decorado';
    if (quiereDecorado && !ofrecidas.includes(linea.technique)) {
      // El producto dejó de ofrecer esa técnica: no se cotiza a la brava.
      descartadas += 1;
      continue;
    }

    const priced = recomputeItemPricing({
      baseUnitPrice: bases.get(node.id) ?? (Number(node.price?.amount) || 0),
      technique: linea.technique,
      surface,
      size: linea.size,
      qty: linea.qty,
    });
    if (priced.error) {
      descartadas += 1;
      continue;
    }

    await upsertQuoteItem(db, quote.id, {
      id: crypto.randomUUID(),
      quoteId: quote.id,
      variantId: linea.variantId,
      productHandle: node.product?.handle ?? null,
      title: node.product?.title ?? node.title ?? null,
      qty: linea.qty,
      image: node.image?.url ?? node.product?.featuredImage?.url ?? null,
      baseUnitPrice: priced.baseUnitPrice,
      technique: linea.technique || null,
      surface: quiereDecorado ? surface || null : null,
      size: linea.size || null,
      decorationTotal: priced.decorationTotal,
      effectiveUnitPrice: priced.effectiveUnitPrice,
    });
    migradas += 1;
  }

  const {items} = await getQuoteWithItems(db, quote.id);
  return Response.json({ok: true, quoteId: quote.id, items, migradas, descartadas});
}
