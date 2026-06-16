import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {createUser, findById, markEmailVerified, updatePassword} from './users.js';
import {verifyPassword} from './password.js';

const ENV = {AUTH_PEPPER: 'test-pepper'};

async function makeDb() {
  const db = createClient({url: ':memory:'});
  await migrate(db);
  return db;
}

describe('users: markEmailVerified + updatePassword', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('markEmailVerified sets email_verified_at', async () => {
    const u = await createUser(db, ENV, {email: 'a@b.com', password: 'password1', role: 'quoter'});
    expect((await findById(db, u.id)).emailVerifiedAt).toBeNull();
    await markEmailVerified(db, u.id);
    expect((await findById(db, u.id)).emailVerifiedAt).not.toBeNull();
  });

  it('updatePassword stores a new hash that verifies and bumps session_version', async () => {
    const u = await createUser(db, ENV, {email: 'a@b.com', password: 'password1', role: 'quoter'});
    const before = (await findById(db, u.id)).sessionVersion;
    await updatePassword(db, ENV, u.id, 'newpassword2');

    const r = await db.execute({
      sql: `SELECT password_hash, password_salt, password_iterations FROM users WHERE id = ?`,
      args: [u.id],
    });
    const rec = {
      hash: r.rows[0].password_hash,
      salt: r.rows[0].password_salt,
      iterations: r.rows[0].password_iterations,
    };
    expect(await verifyPassword('newpassword2', rec, ENV)).toBe(true);
    expect(await verifyPassword('password1', rec, ENV)).toBe(false);
    expect((await findById(db, u.id)).sessionVersion).toBe(before + 1);
  });
});
