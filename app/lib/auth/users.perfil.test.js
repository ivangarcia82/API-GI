import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {createUser, findByEmail} from './users.js';

const ENV = {AUTH_PEPPER: 'test-pepper'};

async function makeDb() {
  const db = createClient({url: ':memory:'});
  await migrate(db);
  return db;
}

const PERFIL = {
  email: 'ana@acme.mx',
  password: 'clavesegura1',
  position: 'Compradora',
  area: 'Compras',
  heardAbout: 'Google o buscador',
  location: 'Jalisco',
  esCliente: 'si',
  advisorHandle: 'laura-vega',
  privacyAcceptedAt: '2026-08-30T10:00:00.000Z',
  termsAcceptedAt: '2026-08-30T10:00:00.000Z',
  newsletterOptIn: true,
  newsletterOptInAt: '2026-08-30T10:00:00.000Z',
};

describe('users: perfil ampliado y consentimiento', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('devuelve los campos nuevos en el objeto recién creado', async () => {
    const u = await createUser(db, ENV, PERFIL);
    expect(u).toMatchObject({
      position: 'Compradora',
      area: 'Compras',
      heardAbout: 'Google o buscador',
      location: 'Jalisco',
      esCliente: 'si',
      advisorHandle: 'laura-vega',
      newsletterOptIn: true,
    });
  });

  it('los persiste y los relee tal cual', async () => {
    await createUser(db, ENV, PERFIL);
    const u = await findByEmail(db, 'ana@acme.mx');
    expect(u).toMatchObject({
      position: 'Compradora',
      area: 'Compras',
      heardAbout: 'Google o buscador',
      location: 'Jalisco',
      esCliente: 'si',
      advisorHandle: 'laura-vega',
      privacyAcceptedAt: '2026-08-30T10:00:00.000Z',
      termsAcceptedAt: '2026-08-30T10:00:00.000Z',
      newsletterOptIn: true,
      newsletterOptInAt: '2026-08-30T10:00:00.000Z',
    });
  });

  it('un alta sin los campos nuevos los deja nulos y sin suscripción', async () => {
    await createUser(db, ENV, {email: 'basico@acme.mx', password: 'clavesegura1'});
    const u = await findByEmail(db, 'basico@acme.mx');
    expect(u.position).toBeNull();
    expect(u.area).toBeNull();
    expect(u.advisorHandle).toBeNull();
    expect(u.privacyAcceptedAt).toBeNull();
    expect(u.newsletterOptIn).toBe(false);
    expect(u.newsletterOptInAt).toBeNull();
  });
});
