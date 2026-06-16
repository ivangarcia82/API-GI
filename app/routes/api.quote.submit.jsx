import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {findById, setShopifyGid} from '~/lib/auth/users';
import {isStubMode} from '~/lib/admin/client';
import {createCustomer, createDraftOrder} from '~/lib/admin/operations';
import {getOrCreateDraftQuote, getQuoteWithItems} from '~/lib/quotes/repo';
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

  // Lazy gid reconcile: never build purchasingEntity with a null/STUB customerId
  // when a real Admin token is available.
  let customerGid = user.shopifyCustomerGid;
  const needsReconcile = !customerGid || String(customerGid).includes('STUB-');
  if (needsReconcile && !isStubMode(env)) {
    const created = await createCustomer(env, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    customerGid = created.gid;
    await setShopifyGid(db, user.id, customerGid);
  }

  const input = buildDraftOrderInput({quote, items, customerGid, email: user.email});
  const {gid, invoiceUrl} = await createDraftOrder(env, input);

  // Collapse the status write + any bookkeeping into one libSQL round-trip.
  await db.batch(
    [
      {
        sql: `UPDATE quotes
              SET status='submitted', shopify_draft_order_gid=?, shopify_invoice_url=?, updated_at=?
              WHERE id=?`,
        args: [gid ?? null, invoiceUrl ?? null, new Date().toISOString(), quote.id],
      },
    ],
    'write',
  );

  // Never surface a stub invoice URL to the user.
  const safeInvoiceUrl = isStubMode(env) ? null : invoiceUrl;
  return Response.json({folio: quote.id, draftOrderGid: gid, invoiceUrl: safeInvoiceUrl});
}
