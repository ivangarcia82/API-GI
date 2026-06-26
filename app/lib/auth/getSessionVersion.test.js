import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {getSessionVersion, bumpSessionVersion} from './users.js';

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

describe('auth/getSessionVersion', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('returns the current session_version for an existing user', async () => {
    expect(await getSessionVersion(db, USER)).toBe(1);
  });

  it('returns null for an unknown user', async () => {
    expect(await getSessionVersion(db, 'does-not-exist')).toBeNull();
  });

  it('reflects bumpSessionVersion (the password-reset invalidation path)', async () => {
    expect(await getSessionVersion(db, USER)).toBe(1);
    const next = await bumpSessionVersion(db, USER);
    expect(next).toBe(2);
    // A cookie minted at version 1 no longer matches the live record → stale.
    expect(await getSessionVersion(db, USER)).toBe(2);
    expect(await getSessionVersion(db, USER)).not.toBe(1);
  });
});
