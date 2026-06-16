import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from './migrate.js';

describe('migrate: email_tokens', () => {
  let db;
  beforeEach(async () => {
    db = createClient({url: ':memory:'});
    await migrate(db);
  });

  it('creates the email_tokens table', async () => {
    const r = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='email_tokens'",
    );
    expect(r.rows.length).toBe(1);
  });

  it('has the expected columns', async () => {
    const r = await db.execute('PRAGMA table_info(email_tokens)');
    const cols = r.rows.map((x) => x.name).sort();
    expect(cols).toEqual(
      ['created_at', 'expires_at', 'id', 'token_hash', 'type', 'used_at', 'user_id'].sort(),
    );
  });

  it("rejects a type outside ('verify','reset')", async () => {
    await expect(
      db.execute({
        sql: `INSERT INTO email_tokens (id,user_id,type,token_hash,expires_at,created_at)
              VALUES (?,?,?,?,?,?)`,
        args: ['t1', 'u1', 'bogus', 'h', '2026-06-17T00:00:00Z', '2026-06-16T00:00:00Z'],
      }),
    ).rejects.toThrow();
  });

  it('is idempotent (running migrate twice does not throw)', async () => {
    await expect(migrate(db)).resolves.toBeUndefined();
  });
});
