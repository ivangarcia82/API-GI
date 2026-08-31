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
  listAdvisorQuotes,
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

describe('folio al enviar', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('asigna folio al marcar como enviada', async () => {
    const q = await getOrCreateDraftQuote(db, USER);
    await markSubmitted(db, q.id, {gid: null, invoiceUrl: null});
    const {quote} = await getQuoteWithItems(db, q.id);
    expect(quote.folio).toMatch(/^GIV\.CDMX\.\d{8}$/);
  });

  it('un borrador todavía no tiene folio', async () => {
    const q = await getOrCreateDraftQuote(db, USER);
    const {quote} = await getQuoteWithItems(db, q.id);
    expect(quote.folio).toBeNull();
  });

  it('cotizaciones distintas reciben folios distintos y consecutivos', async () => {
    const a = await getOrCreateDraftQuote(db, USER);
    await markSubmitted(db, a.id, {gid: null, invoiceUrl: null});
    // El mismo usuario puede abrir otro borrador: el índice único sólo aplica
    // mientras el anterior siga en estado 'draft'.
    const b = await getOrCreateDraftQuote(db, USER);
    await markSubmitted(db, b.id, {gid: null, invoiceUrl: null});

    const {quote: qa} = await getQuoteWithItems(db, a.id);
    const {quote: qb} = await getQuoteWithItems(db, b.id);
    expect(qa.folio).not.toBe(qb.folio);
    expect(Number(qb.folio.slice(-4))).toBe(Number(qa.folio.slice(-4)) + 1);
  });

  it('reenviar la misma cotización no le cambia el folio', async () => {
    // Si un reintento renumerara, el cliente tendría dos documentos con folios
    // distintos para la misma cotización.
    const q = await getOrCreateDraftQuote(db, USER);
    await markSubmitted(db, q.id, {gid: null, invoiceUrl: null});
    const {quote: primero} = await getQuoteWithItems(db, q.id);
    await markSubmitted(db, q.id, {gid: 'gid://x/1', invoiceUrl: 'https://x/1'});
    const {quote: segundo} = await getQuoteWithItems(db, q.id);
    expect(segundo.folio).toBe(primero.folio);
  });
});

describe('asignación de ejecutivo a la cotización', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('guarda el correo del ejecutivo al enviar, normalizado', async () => {
    const q = await getOrCreateDraftQuote(db, USER);
    await markSubmitted(db, q.id, {
      gid: null,
      invoiceUrl: null,
      advisorEmail: '  LVega@GenerandoIdeas.com ',
    });
    const {quote} = await getQuoteWithItems(db, q.id);
    expect(quote.advisorEmail).toBe('lvega@generandoideas.com');
  });

  it('deja null cuando la cotización no tiene ejecutivo', async () => {
    const q = await getOrCreateDraftQuote(db, USER);
    await markSubmitted(db, q.id, {gid: null, invoiceUrl: null});
    const {quote} = await getQuoteWithItems(db, q.id);
    expect(quote.advisorEmail).toBeNull();
  });

  it('listAdvisorQuotes devuelve sólo las del ejecutivo', async () => {
    const a = await getOrCreateDraftQuote(db, USER);
    await markSubmitted(db, a.id, {gid: null, invoiceUrl: null, advisorEmail: 'lvega@gi.com'});
    const b = await getOrCreateDraftQuote(db, USER);
    await markSubmitted(db, b.id, {gid: null, invoiceUrl: null, advisorEmail: 'otro@gi.com'});

    const suyas = await listAdvisorQuotes(db, 'lvega@gi.com');
    expect(suyas.map((q) => q.id)).toEqual([a.id]);
  });

  it('listAdvisorQuotes ignora borradores y correos vacíos', async () => {
    await getOrCreateDraftQuote(db, USER); // queda en draft, sin ejecutivo
    expect(await listAdvisorQuotes(db, '')).toEqual([]);
    expect(await listAdvisorQuotes(db, null)).toEqual([]);
    expect(await listAdvisorQuotes(db, 'lvega@gi.com')).toEqual([]);
  });

  it('listAdvisorQuotes ignora mayúsculas del correo consultado', async () => {
    const a = await getOrCreateDraftQuote(db, USER);
    await markSubmitted(db, a.id, {gid: null, invoiceUrl: null, advisorEmail: 'lvega@gi.com'});
    expect((await listAdvisorQuotes(db, 'LVega@GI.com')).map((q) => q.id)).toEqual([a.id]);
  });
});
