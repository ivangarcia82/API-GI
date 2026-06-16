import {describe, it, expect, beforeEach} from 'vitest';
// Test-only: node build supports ':memory:'. App code imports '@libsql/client/web'.
import {createClient} from '@libsql/client';
import {toggleWishlist, listWishlist, mergeWishlist} from './repo.js';

/**
 * In-memory libSQL client. The same `@libsql/client/web` entry used in
 * production resolves to a local in-memory DB under Node when url is ':memory:'.
 */
async function freshDb() {
  const db = createClient({url: ':memory:'});
  await db.execute(`CREATE TABLE wishlist (
    user_id    TEXT NOT NULL,
    product_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, product_id)
  )`);
  return db;
}

const U = 'user-1';
const P1 = 'gid://shopify/Product/1';
const P2 = 'gid://shopify/Product/2';

describe('wishlist/repo', () => {
  let db;
  beforeEach(async () => {
    db = await freshDb();
  });

  it('toggleWishlist adds when absent and returns true', async () => {
    const added = await toggleWishlist(db, U, P1);
    expect(added).toBe(true);
    expect(await listWishlist(db, U)).toEqual([P1]);
  });

  it('toggleWishlist removes when present and returns false', async () => {
    await toggleWishlist(db, U, P1);
    const stillThere = await toggleWishlist(db, U, P1);
    expect(stillThere).toBe(false);
    expect(await listWishlist(db, U)).toEqual([]);
  });

  it('toggleWishlist is idempotent across an even number of calls', async () => {
    await toggleWishlist(db, U, P1);
    await toggleWishlist(db, U, P1);
    await toggleWishlist(db, U, P1);
    await toggleWishlist(db, U, P1);
    expect(await listWishlist(db, U)).toEqual([]);
    const odd = await toggleWishlist(db, U, P1);
    expect(odd).toBe(true);
    expect(await listWishlist(db, U)).toEqual([P1]);
  });

  it('listWishlist is scoped per user', async () => {
    await toggleWishlist(db, U, P1);
    await toggleWishlist(db, 'user-2', P2);
    expect(await listWishlist(db, U)).toEqual([P1]);
    expect(await listWishlist(db, 'user-2')).toEqual([P2]);
  });

  it('mergeWishlist inserts new ids and ignores duplicates without throwing', async () => {
    await toggleWishlist(db, U, P1);
    await mergeWishlist(db, U, [P1, P2]);
    const list = await listWishlist(db, U);
    expect(list.slice().sort()).toEqual([P1, P2].slice().sort());
  });

  it('mergeWishlist with empty array is a no-op', async () => {
    await toggleWishlist(db, U, P1);
    await mergeWishlist(db, U, []);
    expect(await listWishlist(db, U)).toEqual([P1]);
  });

  it('mergeWishlist filters out empty/blank ids', async () => {
    await mergeWishlist(db, U, ['', '   ', P1]);
    expect(await listWishlist(db, U)).toEqual([P1]);
  });
});
