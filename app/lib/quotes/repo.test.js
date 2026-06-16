import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {
  getOrCreateDraftQuote,
  upsertQuoteItem,
  removeQuoteItem,
  clearQuote,
  getQuoteWithItems,
  listUserQuotes,
  markSubmitted,
} from './repo.js';

const USER = 'user-1';

async function makeDb() {
  const db = createClient({url: ':memory:'});
  await migrate(db);
  // satisfy the FK users(id): insert a minimal user row.
  await db.execute({
    sql: `INSERT INTO users (id,email,password_hash,password_salt,password_iterations,session_version,role,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [USER, 'u1@example.com', 'h', 's', 100000, 1, 'quoter', '2026-06-16T00:00:00Z', '2026-06-16T00:00:00Z'],
  });
  return db;
}

function sampleItem(over = {}) {
  return {
    variantId: 'gid://shopify/ProductVariant/1',
    productHandle: 'taza-clasica',
    title: 'Taza clásica',
    qty: 300,
    baseUnitPrice: 25,
    technique: 'SERIGRAFÍA',
    surface: 'TEXTIL',
    size: '4 x 4',
    decorationTotal: 1491.0447761194,
    effectiveUnitPrice: 29.97,
    ...over,
  };
}

describe('quotes/repo', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('getOrCreateDraftQuote is idempotent (one draft per user)', async () => {
    const a = await getOrCreateDraftQuote(db, USER);
    const b = await getOrCreateDraftQuote(db, USER);
    expect(a.id).toBe(b.id);
    expect(a.status).toBe('draft');
    expect(a.userId).toBe(USER);
    const rows = await db.execute({
      sql: `SELECT COUNT(*) AS c FROM quotes WHERE user_id=? AND status='draft'`,
      args: [USER],
    });
    expect(Number(rows.rows[0].c)).toBe(1);
  });

  it('upsert/remove/clear items and read them back', async () => {
    const q = await getOrCreateDraftQuote(db, USER);
    const item = {id: 'item-1', quoteId: q.id, ...sampleItem()};
    await upsertQuoteItem(db, q.id, item);
    let got = await getQuoteWithItems(db, q.id);
    expect(got.items).toHaveLength(1);
    expect(got.items[0].variantId).toBe('gid://shopify/ProductVariant/1');
    expect(got.items[0].effectiveUnitPrice).toBe(29.97);

    // upsert same id updates qty, does not duplicate
    await upsertQuoteItem(db, q.id, {...item, qty: 500});
    got = await getQuoteWithItems(db, q.id);
    expect(got.items).toHaveLength(1);
    expect(got.items[0].qty).toBe(500);

    await removeQuoteItem(db, q.id, 'item-1');
    got = await getQuoteWithItems(db, q.id);
    expect(got.items).toHaveLength(0);

    await upsertQuoteItem(db, q.id, {id: 'item-2', quoteId: q.id, ...sampleItem()});
    await clearQuote(db, q.id);
    got = await getQuoteWithItems(db, q.id);
    expect(got.items).toHaveLength(0);
  });

  it('listUserQuotes returns quotes for the user', async () => {
    const q = await getOrCreateDraftQuote(db, USER);
    const list = await listUserQuotes(db, USER);
    expect(list.map((x) => x.id)).toContain(q.id);
  });

  it('markSubmitted sets gid, invoiceUrl and status', async () => {
    const q = await getOrCreateDraftQuote(db, USER);
    await markSubmitted(db, q.id, {
      gid: 'gid://shopify/DraftOrder/9',
      invoiceUrl: 'https://shop.example/invoice/9',
    });
    const {quote} = await getQuoteWithItems(db, q.id);
    expect(quote.status).toBe('submitted');
    expect(quote.shopifyDraftOrderGid).toBe('gid://shopify/DraftOrder/9');
    expect(quote.shopifyInvoiceUrl).toBe('https://shop.example/invoice/9');
    // submitting frees the draft slot: a new getOrCreate makes a fresh draft
    const q2 = await getOrCreateDraftQuote(db, USER);
    expect(q2.id).not.toBe(q.id);
  });
});
