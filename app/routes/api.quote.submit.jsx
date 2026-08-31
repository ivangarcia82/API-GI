import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {findById, setShopifyGid} from '~/lib/auth/users';
import {isStubMode} from '~/lib/admin/client';
import {
  createCustomer,
  createDraftOrder,
  getCustomerAdvisor,
  setDraftOrderAdvisor,
} from '~/lib/admin/operations';
import {notifyQuoteSubmitted} from '~/lib/quotes/notify';
import {getOrCreateDraftQuote, getQuoteWithItems, markSubmitted} from '~/lib/quotes/repo';
import {buildDraftOrderInput} from '~/lib/quotes/draftInput';

export async function action({request, context}) {
  assertSameOrigin(request);
  const sessionUser = await requireUser(context);
  const {env} = context;
  const db = getDb(env);

  // Buyer-supplied notes/deadline come from the submit form body (cotizacion.jsx
  // posts {notes, deadline}). Read them so they are NOT dropped.
  const form = await request.formData();
  const notes = form.get('notes') != null ? String(form.get('notes')).trim() : '';
  const deadline = form.get('deadline') != null ? String(form.get('deadline')).trim() : '';

  const draft = await getOrCreateDraftQuote(db, sessionUser.userId);

  // Persist notes/deadline onto the draft BEFORE we read it back and build the
  // DraftOrderInput — otherwise quote.notes is never written and the buyer's
  // notes/deadline are silently dropped. Empty strings -> null.
  await db.execute({
    sql: `UPDATE quotes SET notes=?, deadline=?, updated_at=? WHERE id=?`,
    args: [notes || null, deadline || null, new Date().toISOString(), draft.id],
  });

  const {quote, items} = await getQuoteWithItems(db, draft.id);
  if (!quote || items.length === 0) {
    return Response.json({error: 'La cotización está vacía.'}, {status: 400});
  }

  const user = await findById(db, sessionUser.userId);

  // Best-effort customer reconcile. If it fails (e.g. email taken but not
  // surfaced by search), DON'T abort — the draft order links by email and we
  // capture the real customer gid from the draft response below.
  let customerGid = user.shopifyCustomerGid;
  const needsReconcile = !customerGid || String(customerGid).includes('STUB-');
  if (needsReconcile && !isStubMode(env)) {
    try {
      const created = await createCustomer(env, {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      customerGid = created.gid;
      await setShopifyGid(db, user.id, customerGid);
    } catch (err) {
      console.error('[quote.submit] customer reconcile failed; linking draft by email:', err);
      customerGid = null;
    }
  }

  // Create the draft order. A real failure here (auth/scope/validation) aborts
  // and surfaces a clean error (the real cause in non-production).
  let gid;
  let invoiceUrl;
  try {
    const input = buildDraftOrderInput({quote, items, customerGid, email: user.email});
    const result = await createDraftOrder(env, input);
    gid = result.gid;
    invoiceUrl = result.invoiceUrl;
    // Capture the customer Shopify linked (by email) when we had no real gid,
    // so the advisor lookup works on the quote detail.
    if (result.customerGid && (!customerGid || String(customerGid).includes('STUB-'))) {
      customerGid = result.customerGid;
      await setShopifyGid(db, user.id, customerGid);
    }
  } catch (err) {
    console.error('[quote.submit] draft order creation failed:', err);
    const detail = err instanceof Error ? err.message : String(err);
    const message =
      env.ENVIRONMENT === 'production'
        ? 'No se pudo generar la cotización en Shopify. Intenta de nuevo o contacta a soporte.'
        : `No se pudo generar la cotización: ${detail}`;
    return Response.json({error: message}, {status: 502});
  }

  // El asesor se resuelve UNA vez y alimenta tres cosas: la columna
  // advisor_email de la cotización (el portal del ejecutivo), el metafield de
  // la draft order (el filtro en el admin) y la notificación.
  let advisor = {email: null, gid: null, fields: {}};
  try {
    advisor = await getCustomerAdvisor(env, customerGid);
  } catch (err) {
    console.error('[quote.submit] advisor lookup failed:', err);
  }

  // Marca de ejecutivo en la draft order, para filtrar por asesor en el admin.
  // Best-effort: la draft order ya existe y la cotización se guarda igual.
  try {
    await setDraftOrderAdvisor(env, gid, advisor.gid);
  } catch (err) {
    console.error('[quote.submit] draft order advisor metafield failed:', err);
  }

  // Vía markSubmitted, no con un UPDATE propio: ahí vive la reserva del folio.
  // Duplicar el SQL aquí ya había dejado esta ruta sin folio una vez.
  const {folio} = await markSubmitted(db, quote.id, {
    gid,
    invoiceUrl,
    advisorEmail: advisor.email,
  });

  // Best-effort notifications: the internal copy (advisor, or the sales inbox
  // when the customer has none) and the buyer's confirmation. The quote is
  // already submitted and persisted, so notifyQuoteSubmitted never throws.
  await notifyQuoteSubmitted(
    env,
    {
      quote: {id: quote.id, folio, notes: quote.notes, deadline: quote.deadline},
      user,
      items,
      invoiceUrl, // raw url; goes to internal staff only, never to the buyer
      customerGid,
      origin: new URL(request.url).origin,
    },
    // Reutiliza el asesor ya resuelto en vez de pedirlo otra vez al Admin API.
    {getCustomerAdvisor: async () => advisor},
  );

  // Never surface a stub invoice URL to the user.
  const safeInvoiceUrl = isStubMode(env) ? null : invoiceUrl;
  return Response.json({folio, draftOrderGid: gid, invoiceUrl: safeInvoiceUrl});
}
