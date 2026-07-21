import {describe, it, expect} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from './migrate.js';

async function columnas(db, tabla) {
  const res = await db.execute(`PRAGMA table_info(${tabla})`);
  return res.rows.map((r) => r.name);
}

describe('migración rfc -> razon_social', () => {
  it('renombra la columna y conserva el dato en una base existente', async () => {
    const db = createClient({url: ':memory:'});
    await db.execute(`CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL,
      password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL, session_version INTEGER NOT NULL DEFAULT 1,
      rfc TEXT, role TEXT NOT NULL DEFAULT 'quoter',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    await db.execute({
      sql: `INSERT INTO users (id,email,password_hash,password_salt,password_iterations,rfc,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?)`,
      args: ['u1', 'a@b.mx', 'h', 's', 1, 'ACM010203XXX', '2026-01-01', '2026-01-01'],
    });

    await migrate(db);

    const cols = await columnas(db, 'users');
    expect(cols).toContain('razon_social');
    expect(cols).not.toContain('rfc');

    const res = await db.execute(`SELECT razon_social FROM users WHERE id = 'u1'`);
    expect(res.rows[0].razon_social).toBe('ACM010203XXX');
  });

  it('en una base nueva crea razon_social y no falla al correr dos veces', async () => {
    const db = createClient({url: ':memory:'});
    await migrate(db);
    await migrate(db);

    const cols = await columnas(db, 'users');
    expect(cols).toContain('razon_social');
    expect(cols).not.toContain('rfc');
  });

  it('en una base existente con rfc y datos, corre migrate() dos veces sin fallar y conserva el dato', async () => {
    const db = createClient({url: ':memory:'});
    await db.execute(`CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL,
      password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL, session_version INTEGER NOT NULL DEFAULT 1,
      rfc TEXT, role TEXT NOT NULL DEFAULT 'quoter',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    await db.execute({
      sql: `INSERT INTO users (id,email,password_hash,password_salt,password_iterations,rfc,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?)`,
      args: ['u1', 'a@b.mx', 'h', 's', 1, 'ACM010203XXX', '2026-01-01', '2026-01-01'],
    });

    await migrate(db);
    await migrate(db);

    const cols = await columnas(db, 'users');
    expect(cols).toContain('razon_social');
    expect(cols).not.toContain('rfc');

    const res = await db.execute(`SELECT razon_social FROM users WHERE id = 'u1'`);
    expect(res.rows[0].razon_social).toBe('ACM010203XXX');
  });
});
