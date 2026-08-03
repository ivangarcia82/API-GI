import {describe, it, expect, beforeEach, vi} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '~/lib/db/migrate.js';
import {createUser, getPasswordRecord, findById} from '~/lib/auth/users.js';
import {verifyPassword} from '~/lib/auth/password.js';

// getDb crea un cliente HTTP contra Turso y exige una URL https://, así que no
// sirve en pruebas. Se sustituye por el cliente SQLite en memoria que arma cada
// caso. El mock se declara antes de importar la ruta (vi.mock se iza igual, pero
// el orden deja claro por qué el import de la acción va después).
let dbActual = null;
vi.mock('~/lib/db/client', () => ({
  getDb: () => dbActual,
}));

const {action} = await import('./account.profile.jsx');

const ENV = {AUTH_PEPPER: 'test-pepper'};

// Sesión mínima con la misma superficie que usa la ruta (get/set/unset).
function fakeSession(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    isPending: false,
    get: (k) => store.get(k),
    set: (k, v) => store.set(k, v),
    unset: (k) => store.delete(k),
  };
}

async function setup() {
  const db = createClient({url: ':memory:'});
  await migrate(db);
  dbActual = db; // lo que devolverá el getDb mockeado
  const user = await createUser(db, ENV, {
    email: 'a@b.com',
    password: 'claveactual1',
    role: 'quoter',
  });
  const session = fakeSession({
    gi_user: {userId: user.id, role: 'quoter', gid: null, sessionVersion: 1},
  });
  const context = {env: ENV, session};
  return {db, user, session, context};
}

function postRequest(fields) {
  const body = new URLSearchParams(fields);
  return new Request('http://localhost/account/profile', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
}

describe('account.profile action: cambio de contraseña', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  it('cambia la contraseña y re-emite la sesión con el session_version nuevo', async () => {
    const res = await action({
      request: postRequest({
        currentPassword: 'claveactual1',
        newPassword: 'clavenueva22',
        confirmPassword: 'clavenueva22',
      }),
      context: ctx.context,
    });
    const payload = res.passwordChanged !== undefined ? res : await res.json();

    expect(payload.error).toBeNull();
    expect(payload.passwordChanged).toBe(true);

    // La contraseña nueva verifica y la vieja ya no.
    const rec = await getPasswordRecord(ctx.db, ctx.user.id);
    expect(await verifyPassword('clavenueva22', rec, ENV)).toBe(true);
    expect(await verifyPassword('claveactual1', rec, ENV)).toBe(false);

    // La cookie quedó sincronizada con la versión nueva de la base.
    const enBase = (await findById(ctx.db, ctx.user.id)).sessionVersion;
    expect(enBase).toBe(2);
    expect(ctx.session.get('gi_user').sessionVersion).toBe(enBase);
  });

  it('rechaza una contraseña actual incorrecta y no cambia nada', async () => {
    const res = await action({
      request: postRequest({
        currentPassword: 'equivocada99',
        newPassword: 'clavenueva22',
        confirmPassword: 'clavenueva22',
      }),
      context: ctx.context,
    });
    expect(res.status).toBe(401);
    const payload = await res.json();
    expect(payload.error).toBe('La contraseña actual es incorrecta.');

    const rec = await getPasswordRecord(ctx.db, ctx.user.id);
    expect(await verifyPassword('claveactual1', rec, ENV)).toBe(true);
    expect((await findById(ctx.db, ctx.user.id)).sessionVersion).toBe(1);
  });

  it('rechaza cuando la confirmación no coincide', async () => {
    const res = await action({
      request: postRequest({
        currentPassword: 'claveactual1',
        newPassword: 'clavenueva22',
        confirmPassword: 'clavedistinta9',
      }),
      context: ctx.context,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Las contraseñas no coinciden.');
  });

  it('bloquea con 429 tras superar el umbral de intentos', async () => {
    for (let i = 0; i < 8; i++) {
      await ctx.db.execute({
        sql: `INSERT INTO login_attempts (id, email, ip, success, created_at)
              VALUES (?, ?, ?, 0, ?)`,
        args: [crypto.randomUUID(), 'a@b.com', 'unknown', new Date().toISOString()],
      });
    }
    const res = await action({
      request: postRequest({
        currentPassword: 'claveactual1',
        newPassword: 'clavenueva22',
        confirmPassword: 'clavenueva22',
      }),
      context: ctx.context,
    });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe(
      'Demasiados intentos. Intenta de nuevo en unos minutos.',
    );
  });
});
