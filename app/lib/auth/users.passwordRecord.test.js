import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {createUser, getPasswordRecord} from './users.js';
import {verifyPassword} from './password.js';

const ENV = {AUTH_PEPPER: 'test-pepper'};

async function makeDb() {
  const db = createClient({url: ':memory:'});
  await migrate(db);
  return db;
}

describe('users: getPasswordRecord', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('devuelve un registro que verifica la contraseña correcta', async () => {
    const u = await createUser(db, ENV, {
      email: 'a@b.com',
      password: 'clavesegura1',
      role: 'quoter',
    });
    const rec = await getPasswordRecord(db, u.id);

    expect(typeof rec.hash).toBe('string');
    expect(typeof rec.salt).toBe('string');
    expect(Number.isInteger(rec.iterations)).toBe(true);
    expect(await verifyPassword('clavesegura1', rec, ENV)).toBe(true);
    expect(await verifyPassword('otraclave999', rec, ENV)).toBe(false);
  });

  it('devuelve null cuando el usuario no existe', async () => {
    expect(await getPasswordRecord(db, 'no-existe')).toBeNull();
  });
});
