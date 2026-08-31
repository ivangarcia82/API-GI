import {describe, it, expect, vi, beforeEach} from 'vitest';

const linkSignupCustomer = vi.fn();
const createUser = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));
vi.mock('~/lib/auth/users', () => ({
  createUser: (...a) => createUser(...a),
  EmailTakenError: class EmailTakenError extends Error {},
}));
vi.mock('~/lib/auth/signup-link', () => ({
  linkSignupCustomer: (...a) => linkSignupCustomer(...a),
}));
vi.mock('~/lib/auth/verify-link', () => ({sendVerificationEmail: vi.fn()}));

import {action} from './auth.signup.jsx';

// data() devuelve un DataWithResponseInit, no un Response: la acción se invoca
// directo, fuera del pipeline del router. Mismo helper que
// account.profile.password.test.js.
async function read(res) {
  if (res instanceof Response) return {status: res.status, body: await res.json()};
  if (res?.init) return {status: res.init.status ?? 200, body: res.data};
  return {status: 200, body: res};
}

function signupRequest(fields = {}) {
  const body = new FormData();
  body.set('email', 'ana@empresa.mx');
  body.set('password', 'secreto123');
  body.set('privacy', '1');
  body.set('terms', '1');
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request('https://gi.test/registro', {method: 'POST', body});
}

/** Las opciones con que se llamó a linkSignupCustomer. */
function linkOptions() {
  return linkSignupCustomer.mock.calls[0][3];
}

/** El objeto que recibió createUser. */
function created() {
  return createUser.mock.calls[0][2];
}

const context = {env: {PRIVATE_ADMIN_API_TOKEN: 't'}};

beforeEach(() => {
  linkSignupCustomer.mockReset();
  createUser.mockReset();
  createUser.mockResolvedValue({id: 'u1', email: 'ana@empresa.mx'});
  linkSignupCustomer.mockResolvedValue('gid://shopify/Customer/7');
});

describe('signup action · aceptaciones legales', () => {
  it('rechaza sin aviso de privacidad', async () => {
    const body = new FormData();
    body.set('email', 'ana@empresa.mx');
    body.set('password', 'secreto123');
    body.set('terms', '1');
    const res = await action({
      request: new Request('https://gi.test/registro', {method: 'POST', body}),
      context,
    });
    expect((await read(res)).status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rechaza sin términos', async () => {
    const body = new FormData();
    body.set('email', 'ana@empresa.mx');
    body.set('password', 'secreto123');
    body.set('privacy', '1');
    const res = await action({
      request: new Request('https://gi.test/registro', {method: 'POST', body}),
      context,
    });
    expect((await read(res)).status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('guarda la fecha de ambas aceptaciones', async () => {
    await action({request: signupRequest(), context});
    expect(created().privacyAcceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(created().termsAcceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('signup action · perfil', () => {
  it('persiste los campos nuevos', async () => {
    await action({
      request: signupRequest({
        position: 'Compradora',
        area: 'Compras',
        heardAbout: 'Google o buscador',
        location: 'Jalisco',
        esCliente: 'no',
      }),
      context,
    });
    expect(created()).toMatchObject({
      position: 'Compradora',
      area: 'Compras',
      heardAbout: 'Google o buscador',
      location: 'Jalisco',
      esCliente: 'no',
    });
  });

  it('rechaza un valor fuera del catálogo', async () => {
    // El select sólo ofrece opciones válidas; un valor inventado significa
    // formulario manipulado.
    const res = await action({
      request: signupRequest({area: 'Departamento Inventado'}),
      context,
    });
    expect((await read(res)).status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('acepta que los catálogos vengan vacíos', async () => {
    await action({request: signupRequest(), context});
    expect(created().area).toBeNull();
    expect(created().heardAbout).toBeNull();
  });
});

describe('signup action · newsletter', () => {
  it('propaga la suscripción al enlace con Shopify', async () => {
    await action({request: signupRequest({newsletter: '1'}), context});
    expect(created().newsletterOptIn).toBe(true);
    expect(created().newsletterOptInAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(linkOptions()).toEqual({newsletterOptIn: true});
  });

  it('no suscribe cuando el check viene vacío', async () => {
    await action({request: signupRequest(), context});
    expect(created().newsletterOptIn).toBe(false);
    expect(created().newsletterOptInAt).toBeNull();
  });
});

describe('signup action · reclamo de asesor', () => {
  it('guarda el handle reclamado sin asignarlo', async () => {
    await action({
      request: signupRequest({esCliente: 'si', advisor: 'laura-vega'}),
      context,
    });
    expect(created().advisorHandle).toBe('laura-vega');
    // linkSignupCustomer ya no recibe handle alguno.
    expect(linkOptions()).toEqual({newsletterOptIn: false});
  });

  it('guarda null cuando el usuario no conoce a su asesor', async () => {
    await action({
      request: signupRequest({esCliente: 'si', advisor: '__desconocido__'}),
      context,
    });
    expect(created().advisorHandle).toBeNull();
    expect(created().esCliente).toBe('si');
  });

  it('guarda null cuando la persona no es cliente todavía', async () => {
    await action({request: signupRequest({esCliente: 'no'}), context});
    expect(created().advisorHandle).toBeNull();
  });
});
