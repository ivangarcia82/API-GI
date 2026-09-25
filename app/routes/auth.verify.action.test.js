import {describe, it, expect, vi, beforeEach} from 'vitest';

const verifyAndConsumeToken = vi.fn();
const markEmailVerified = vi.fn();
const findById = vi.fn();
const loginSession = vi.fn();
const notifyAdvisorOfSignup = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));
vi.mock('~/lib/auth/tokens', () => ({
  verifyAndConsumeToken: (...a) => verifyAndConsumeToken(...a),
}));
vi.mock('~/lib/auth/users', () => ({
  markEmailVerified: (...a) => markEmailVerified(...a),
  findById: (...a) => findById(...a),
}));
vi.mock('~/lib/auth/session', () => ({loginSession: (...a) => loginSession(...a)}));
vi.mock('~/lib/auth/signup-notify', () => ({
  notifyAdvisorOfSignup: (...a) => notifyAdvisorOfSignup(...a),
}));

import {action} from './auth.verify.jsx';

const USER = {
  id: 'u1',
  email: 'mariana@empresa.mx',
  role: 'quoter',
  shopifyCustomerGid: 'gid://shopify/Customer/123',
  sessionVersion: 1,
};

function verifyRequest(token = 'tok-123') {
  const body = new FormData();
  body.set('token', token);
  return new Request('https://gi.test/auth/verify', {method: 'POST', body});
}

function makeContext({withWaitUntil = true} = {}) {
  const ctx = {env: {PUBLIC_STORE_DOMAIN: 'development-gi.myshopify.com'}, session: {}};
  if (withWaitUntil) ctx.waitUntil = vi.fn();
  return ctx;
}

beforeEach(() => {
  verifyAndConsumeToken.mockReset().mockResolvedValue({userId: 'u1'});
  markEmailVerified.mockReset().mockResolvedValue(undefined);
  findById.mockReset().mockResolvedValue(USER);
  loginSession.mockReset();
  notifyAdvisorOfSignup.mockReset().mockResolvedValue({sent: true, to: 'a@gi.com'});
});

describe('verify action · aviso al asesor', () => {
  it('notifies the advisor about the freshly verified user', async () => {
    const context = makeContext();

    const res = await action({request: verifyRequest(), context});

    expect(notifyAdvisorOfSignup).toHaveBeenCalledWith(context.env, {user: USER});
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/account');
  });

  it('hands the send to waitUntil so the redirect is not delayed by email', async () => {
    const context = makeContext();

    await action({request: verifyRequest(), context});

    expect(context.waitUntil).toHaveBeenCalledTimes(1);
    expect(context.waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
  });

  it('still notifies when the runtime has no waitUntil', async () => {
    const context = makeContext({withWaitUntil: false});

    const res = await action({request: verifyRequest(), context});

    expect(notifyAdvisorOfSignup).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(302);
  });

  it('verifies the account even if notifying blows up', async () => {
    notifyAdvisorOfSignup.mockRejectedValue(new Error('boom'));
    const context = makeContext({withWaitUntil: false});

    const res = await action({request: verifyRequest(), context});

    expect(markEmailVerified).toHaveBeenCalled();
    expect(res.status).toBe(302);
  });

  it('notifies nobody when the token is invalid', async () => {
    verifyAndConsumeToken.mockResolvedValue(null);

    await action({request: verifyRequest('malo'), context: makeContext()});

    expect(notifyAdvisorOfSignup).not.toHaveBeenCalled();
  });
});

describe('verify action · colaboradores', () => {
  it('no avisa a marketing ni a la ejecutiva por un colaborador', async () => {
    findById.mockResolvedValue({...USER, email: 'ana@generandoideas.com', shopifyCustomerGid: null});
    const context = makeContext();

    const res = await action({request: verifyRequest(), context});

    expect(notifyAdvisorOfSignup).not.toHaveBeenCalled();
    expect(context.waitUntil).not.toHaveBeenCalled();
    expect(loginSession).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(302);
  });
});
