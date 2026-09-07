import {describe, it, expect, vi, beforeEach} from 'vitest';

const findByEmail = vi.fn();
const verifyPassword = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));
vi.mock('~/lib/auth/users', () => ({
  findByEmail: (...a) => findByEmail(...a),
  normalizeEmail: (v) => String(v).trim().toLowerCase(),
  getPasswordRecord: async () => ({hash: 'h', salt: 's', iterations: 100000}),
}));
vi.mock('~/lib/auth/password', () => ({
  verifyPassword: (...a) => verifyPassword(...a),
  hashPassword: async () => 'x',
}));
vi.mock('~/lib/auth/session', () => ({loginSession: vi.fn()}));
vi.mock('~/lib/auth/attempts', () => ({
  clientIp: () => '1.1.1.1',
  recentFailures: async () => 0,
  recordAttempt: async () => {},
  MAX_ATTEMPTS: 5,
}));
vi.mock('~/lib/auth/verify-link', () => ({sendVerificationEmail: async () => {}}));

import {action} from './auth.login.jsx';

const context = {env: {}, session: {destroy: async () => {}}};

function entrar(fields = {}) {
  const body = new FormData();
  body.set('email', 'ana@empresa.mx');
  body.set('password', 'secreto123');
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return action({
    request: new Request('https://gi.test/login', {method: 'POST', body}),
    context,
  });
}

beforeEach(() => {
  findByEmail.mockReset();
  verifyPassword.mockReset();
  findByEmail.mockResolvedValue({
    id: 'u1',
    role: 'cliente',
    shopifyCustomerGid: 'gid://c1',
    sessionVersion: 1,
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  });
  verifyPassword.mockResolvedValue(true);
});

/* El invitado que venía armando su cotización tiene que volver a donde estaba,
   no a /account: mandarlo a su cuenta es justo donde se le perdía el hilo. */
describe('destino después de iniciar sesión', () => {
  it('va a /account cuando nadie pidió otra cosa', async () => {
    const res = await entrar();
    expect(res.headers.get('Location')).toBe('/account');
  });

  it('vuelve a la ficha desde la que se fue a iniciar sesión', async () => {
    const res = await entrar({redirectTo: '/products/termo-carich'});
    expect(res.headers.get('Location')).toBe('/products/termo-carich');
  });

  it('no se deja usar de trampolín hacia otro dominio', async () => {
    const res = await entrar({redirectTo: 'https://sitio-falso.test/cobrar'});
    expect(res.headers.get('Location')).toBe('/account');
  });

  it('tampoco con la doble diagonal', async () => {
    const res = await entrar({redirectTo: '//sitio-falso.test'});
    expect(res.headers.get('Location')).toBe('/account');
  });

  it('no redirige a ningún lado si la contraseña estaba mal', async () => {
    verifyPassword.mockResolvedValue(false);
    const res = await entrar({redirectTo: '/products/termo-carich'});
    expect(res.init?.status ?? res.status).toBe(401);
  });
});
