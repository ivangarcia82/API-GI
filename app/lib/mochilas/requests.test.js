import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '~/lib/db/migrate.js';
import {
  createMochilaRequest,
  findMochilaRequest,
  deleteMochilaRequest,
} from './requests.js';

const REQUEST = {
  userId: 'u1',
  email: 'ana@generandoideas.com',
  line: 'Takayama',
  model: 'Zen',
  color: 'Negro',
  variantId: 'gid://shopify/ProductVariant/1',
  image: 'https://cdn/zen.png',
  foraneo: true,
  details: {phone: '5512345678', shipping: {city: 'Guadalajara'}},
};

let db;
beforeEach(async () => {
  db = createClient({url: ':memory:'});
  await migrate(db);
  for (const id of ['u1', 'u2']) {
    await db.execute({
      sql: `INSERT INTO users (id, email, password_hash, password_salt, password_iterations,
              created_at, updated_at) VALUES (?, ?, 'h', 's', 1, 'now', 'now')`,
      args: [id, `${id}@generandoideas.com`],
    });
  }
});

describe('migrate: mochila_requests', () => {
  it('crea la tabla y es idempotente', async () => {
    const r = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='mochila_requests'",
    );
    expect(r.rows.length).toBe(1);
    await expect(migrate(db)).resolves.toBeUndefined();
  });
});

describe('solicitudes de mochila', () => {
  it('guarda la primera solicitud del colaborador', async () => {
    expect(await createMochilaRequest(db, REQUEST)).toEqual({created: true});
    expect(await findMochilaRequest(db, 'u1')).toMatchObject({
      line: 'Takayama',
      model: 'Zen',
      color: 'Negro',
      image: 'https://cdn/zen.png',
      foraneo: true,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it('una segunda solicitud del mismo colaborador no se guarda ni pisa la primera', async () => {
    await createMochilaRequest(db, REQUEST);
    const again = await createMochilaRequest(db, {...REQUEST, model: 'Evo'});
    expect(again).toEqual({created: false});
    expect((await findMochilaRequest(db, 'u1')).model).toBe('Zen');
  });

  it('dos colaboradores distintos sí pueden pedir', async () => {
    await createMochilaRequest(db, REQUEST);
    expect(await createMochilaRequest(db, {...REQUEST, userId: 'u2'})).toEqual({created: true});
  });

  it('borrar libera al colaborador para volver a pedir', async () => {
    await createMochilaRequest(db, REQUEST);
    await deleteMochilaRequest(db, 'u1');
    expect(await findMochilaRequest(db, 'u1')).toBeNull();
    expect(await createMochilaRequest(db, REQUEST)).toEqual({created: true});
  });

  it('null si el colaborador no ha pedido', async () => {
    expect(await findMochilaRequest(db, 'nadie')).toBeNull();
  });
});
