import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {createToken, verifyAndConsumeToken, hashToken} from './tokens.js';

const USER = 'user-1';

async function makeDb() {
  const db = createClient({url: ':memory:'});
  await migrate(db);
  await db.execute({
    sql: `INSERT INTO users (id,email,password_hash,password_salt,password_iterations,session_version,role,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [USER, 'u1@example.com', 'h', 's', 100000, 1, 'quoter', '2026-06-16T00:00:00Z', '2026-06-16T00:00:00Z'],
  });
  return db;
}

describe('auth/tokens', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('stores only the hash, never the raw token', async () => {
    const {token} = await createToken(db, {userId: USER, type: 'reset', ttlMs: 60_000});
    const r = await db.execute('SELECT token_hash FROM email_tokens');
    expect(r.rows[0].token_hash).toBe(await hashToken(token));
    expect(r.rows[0].token_hash).not.toBe(token);
  });

  it('verifies a fresh token and returns its user_id + type', async () => {
    const {token} = await createToken(db, {userId: USER, type: 'verify', ttlMs: 60_000});
    const res = await verifyAndConsumeToken(db, {token, type: 'verify'});
    expect(res).toEqual({userId: USER, type: 'verify'});
  });

  it('is single-use: a consumed token fails the second time', async () => {
    const {token} = await createToken(db, {userId: USER, type: 'reset', ttlMs: 60_000});
    expect(await verifyAndConsumeToken(db, {token, type: 'reset'})).toEqual({userId: USER, type: 'reset'});
    expect(await verifyAndConsumeToken(db, {token, type: 'reset'})).toBeNull();
  });

  it('rejects an expired token', async () => {
    const {token} = await createToken(db, {userId: USER, type: 'reset', ttlMs: -1000});
    expect(await verifyAndConsumeToken(db, {token, type: 'reset'})).toBeNull();
  });

  it('rejects a token whose type does not match', async () => {
    const {token} = await createToken(db, {userId: USER, type: 'verify', ttlMs: 60_000});
    expect(await verifyAndConsumeToken(db, {token, type: 'reset'})).toBeNull();
  });

  it('rejects a garbage / unknown token without throwing', async () => {
    expect(await verifyAndConsumeToken(db, {token: 'not-a-real-token', type: 'reset'})).toBeNull();
  });
});
