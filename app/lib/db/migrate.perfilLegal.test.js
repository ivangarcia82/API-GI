import {describe, it, expect} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from './migrate.js';

const NUEVAS = [
  'position',
  'area',
  'heard_about',
  'location',
  'es_cliente',
  'advisor_handle',
  'privacy_accepted_at',
  'terms_accepted_at',
  'newsletter_opt_in',
  'newsletter_opt_in_at',
];

async function columnas(db, tabla) {
  const res = await db.execute(`PRAGMA table_info(${tabla})`);
  return res.rows.map((r) => r.name);
}

describe('migración perfil + legal', () => {
  it('crea las diez columnas en una base nueva y es idempotente', async () => {
    const db = createClient({url: ':memory:'});
    await migrate(db);
    await migrate(db);

    const cols = await columnas(db, 'users');
    for (const c of NUEVAS) expect(cols).toContain(c);
  });

  it('las añade a una base preexistente sin perder datos', async () => {
    const db = createClient({url: ':memory:'});
    await db.execute(`CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL,
      password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL, session_version INTEGER NOT NULL DEFAULT 1,
      role TEXT NOT NULL DEFAULT 'quoter',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    await db.execute({
      sql: `INSERT INTO users (id,email,password_hash,password_salt,password_iterations,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?)`,
      args: ['u1', 'a@b.mx', 'h', 's', 1, '2026-01-01', '2026-01-01'],
    });

    await migrate(db);

    const cols = await columnas(db, 'users');
    for (const c of NUEVAS) expect(cols).toContain(c);

    // El usuario viejo sigue ahí, con las columnas nuevas vacías.
    const res = await db.execute(
      `SELECT email, position, newsletter_opt_in FROM users WHERE id='u1'`,
    );
    expect(res.rows[0].email).toBe('a@b.mx');
    expect(res.rows[0].position).toBeNull();
    expect(res.rows[0].newsletter_opt_in).toBeNull();
  });
});
