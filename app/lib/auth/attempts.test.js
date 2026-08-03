import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {clientIp, recentFailures, recordAttempt, MAX_ATTEMPTS, WINDOW_MS} from './attempts.js';

async function makeDb() {
  const db = createClient({url: ':memory:'});
  await migrate(db);
  return db;
}

describe('auth/attempts: clientIp', () => {
  it('prefiere CF-Connecting-IP', () => {
    const req = new Request('http://x/', {
      headers: {'CF-Connecting-IP': '1.1.1.1', 'X-Forwarded-For': '2.2.2.2'},
    });
    expect(clientIp(req)).toBe('1.1.1.1');
  });

  it('usa el primer valor de X-Forwarded-For cuando no hay CF-Connecting-IP', () => {
    const req = new Request('http://x/', {
      headers: {'X-Forwarded-For': '2.2.2.2, 3.3.3.3'},
    });
    expect(clientIp(req)).toBe('2.2.2.2');
  });

  it('cae a "unknown" sin encabezados', () => {
    expect(clientIp(new Request('http://x/'))).toBe('unknown');
  });
});

describe('auth/attempts: conteo', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('cuenta sólo los fallos', async () => {
    await recordAttempt(db, 'a@b.com', '1.1.1.1', false);
    await recordAttempt(db, 'a@b.com', '1.1.1.1', false);
    await recordAttempt(db, 'a@b.com', '1.1.1.1', true);
    expect(await recentFailures(db, 'a@b.com', '1.1.1.1')).toBe(2);
  });

  it('cuenta por email O por IP', async () => {
    await recordAttempt(db, 'otro@b.com', '1.1.1.1', false);
    await recordAttempt(db, 'a@b.com', '9.9.9.9', false);
    // Coincide por IP el primero, por email el segundo.
    expect(await recentFailures(db, 'a@b.com', '1.1.1.1')).toBe(2);
  });

  it('ignora fallos fuera de la ventana de 15 minutos', async () => {
    const viejo = new Date(Date.now() - WINDOW_MS - 60000).toISOString();
    await db.execute({
      sql: `INSERT INTO login_attempts (id, email, ip, success, created_at) VALUES (?, ?, ?, 0, ?)`,
      args: [crypto.randomUUID(), 'a@b.com', '1.1.1.1', viejo],
    });
    expect(await recentFailures(db, 'a@b.com', '1.1.1.1')).toBe(0);
  });

  it('expone el umbral usado por las rutas', () => {
    expect(MAX_ATTEMPTS).toBe(8);
  });
});
