// Server-only: persistence for quotes and quote items (Turso / libSQL).
// Quote shape: {id,userId,status,folio,notes,deadline,shopifyDraftOrderGid,shopifyInvoiceUrl}
// Item shape:  {id,quoteId,variantId,productHandle,title,qty,baseUnitPrice,technique,surface,size,decorationTotal,effectiveUnitPrice}
import {nextFolio} from './folio.js';

function nowIso() {
  return new Date().toISOString();
}

function isUniqueViolation(err) {
  const msg = String(err && (err.message || err)) || '';
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(msg);
}

function mapQuoteRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    status: r.status,
    folio: r.folio ?? null,
    notes: r.notes ?? null,
    deadline: r.deadline ?? null,
    shopifyDraftOrderGid: r.shopify_draft_order_gid ?? null,
    shopifyInvoiceUrl: r.shopify_invoice_url ?? null,
  };
}

function mapItemRow(r) {
  return {
    id: r.id,
    quoteId: r.quote_id,
    variantId: r.variant_id,
    productHandle: r.product_handle ?? null,
    title: r.title ?? null,
    qty: Number(r.qty),
    baseUnitPrice: Number(r.base_unit_price),
    technique: r.technique ?? null,
    surface: r.surface ?? null,
    size: r.size ?? null,
    decorationTotal: Number(r.decoration_total),
    effectiveUnitPrice: Number(r.effective_unit_price),
    image: r.image ?? null,
  };
}

async function selectDraft(db, userId) {
  const res = await db.execute({
    sql: `SELECT * FROM quotes WHERE user_id=? AND status='draft' LIMIT 1`,
    args: [userId],
  });
  return mapQuoteRow(res.rows[0]);
}

export async function getOrCreateDraftQuote(db, userId) {
  const existing = await selectDraft(db, userId);
  if (existing) return existing;
  const id = crypto.randomUUID();
  const ts = nowIso();
  try {
    await db.execute({
      sql: `INSERT INTO quotes (id,user_id,status,created_at,updated_at) VALUES (?,?,'draft',?,?)`,
      args: [id, userId, ts, ts],
    });
    return {
      id,
      userId,
      status: 'draft',
      notes: null,
      deadline: null,
      shopifyDraftOrderGid: null,
      shopifyInvoiceUrl: null,
    };
  } catch (err) {
    // Lost the race against idx_one_draft_per_user: re-select the winning draft.
    if (isUniqueViolation(err)) {
      const winner = await selectDraft(db, userId);
      if (winner) return winner;
    }
    throw err;
  }
}

export async function upsertQuoteItem(db, quoteId, item) {
  const ts = nowIso();
  await db.execute({
    sql: `INSERT INTO quote_items
            (id,quote_id,variant_id,product_handle,title,qty,base_unit_price,technique,surface,size,decoration_total,effective_unit_price,image,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            variant_id=excluded.variant_id,
            product_handle=excluded.product_handle,
            title=excluded.title,
            qty=excluded.qty,
            base_unit_price=excluded.base_unit_price,
            technique=excluded.technique,
            surface=excluded.surface,
            size=excluded.size,
            decoration_total=excluded.decoration_total,
            effective_unit_price=excluded.effective_unit_price,
            image=excluded.image`,
    args: [
      item.id,
      quoteId,
      item.variantId,
      item.productHandle ?? null,
      item.title ?? null,
      item.qty,
      item.baseUnitPrice,
      item.technique ?? null,
      item.surface ?? null,
      item.size ?? null,
      item.decorationTotal ?? 0,
      item.effectiveUnitPrice,
      item.image ?? null,
      ts,
    ],
  });
  await db.execute({
    sql: `UPDATE quotes SET updated_at=? WHERE id=?`,
    args: [ts, quoteId],
  });
}

export async function removeQuoteItem(db, quoteId, itemId) {
  await db.execute({
    sql: `DELETE FROM quote_items WHERE quote_id=? AND id=?`,
    args: [quoteId, itemId],
  });
  await db.execute({
    sql: `UPDATE quotes SET updated_at=? WHERE id=?`,
    args: [nowIso(), quoteId],
  });
}

export async function clearQuote(db, quoteId) {
  await db.execute({
    sql: `DELETE FROM quote_items WHERE quote_id=?`,
    args: [quoteId],
  });
  await db.execute({
    sql: `UPDATE quotes SET updated_at=? WHERE id=?`,
    args: [nowIso(), quoteId],
  });
}

export async function getQuoteWithItems(db, quoteId) {
  const qRes = await db.execute({
    sql: `SELECT * FROM quotes WHERE id=? LIMIT 1`,
    args: [quoteId],
  });
  const quote = mapQuoteRow(qRes.rows[0]);
  if (!quote) return {quote: null, items: []};
  const iRes = await db.execute({
    sql: `SELECT * FROM quote_items WHERE quote_id=? ORDER BY created_at ASC`,
    args: [quoteId],
  });
  return {quote, items: iRes.rows.map(mapItemRow)};
}

export async function listUserQuotes(db, userId) {
  const res = await db.execute({
    sql: `SELECT * FROM quotes WHERE user_id=? ORDER BY created_at DESC`,
    args: [userId],
  });
  return res.rows.map(mapQuoteRow);
}

export async function markSubmitted(db, quoteId, {gid, invoiceUrl}) {
  // El folio se reserva sólo la primera vez. Un reintento de envío no puede
  // renumerar: el cliente acabaría con dos documentos para la misma cotización.
  const previo = await db.execute({
    sql: `SELECT folio FROM quotes WHERE id=? LIMIT 1`,
    args: [quoteId],
  });
  const yaTiene = previo.rows[0] && previo.rows[0].folio;
  const folio = yaTiene || (await nextFolio(db));

  await db.execute({
    sql: `UPDATE quotes
          SET status='submitted', folio=?, shopify_draft_order_gid=?, shopify_invoice_url=?, updated_at=?
          WHERE id=?`,
    args: [folio, gid ?? null, invoiceUrl ?? null, nowIso(), quoteId],
  });

  return {folio};
}
