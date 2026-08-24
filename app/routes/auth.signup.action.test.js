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

function signupRequest(fields) {
  const body = new FormData();
  body.set('email', 'ana@empresa.mx');
  body.set('password', 'secreto123');
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request('https://gi.test/registro', {method: 'POST', body});
}

const context = {env: {PRIVATE_ADMIN_API_TOKEN: 't'}};

/** The advisor handle linkSignupCustomer was called with. */
function assignedHandle() {
  return linkSignupCustomer.mock.calls[0][3];
}

beforeEach(() => {
  linkSignupCustomer.mockReset();
  createUser.mockReset();
  createUser.mockResolvedValue({id: 'u1', email: 'ana@empresa.mx'});
  linkSignupCustomer.mockResolvedValue('gid://shopify/Customer/7');
});

describe('signup action · asignación de ejecutiva de venta', () => {
  it('passes the picked advisor handle through to the Shopify link', async () => {
    await action({request: signupRequest({esCliente: 'si', advisor: 'laura-vega'}), context});

    expect(assignedHandle()).toBe('laura-vega');
  });

  it('assigns marketing when the customer does not know their advisor', async () => {
    await action({
      request: signupRequest({esCliente: 'si', advisor: '__desconocido__'}),
      context,
    });

    expect(assignedHandle()).toBe('marketing');
  });

  it('assigns marketing when the person is not a customer yet', async () => {
    await action({request: signupRequest({esCliente: 'no', advisor: ''}), context});

    expect(assignedHandle()).toBe('marketing');
  });

  it('assigns marketing when the form omits the question entirely', async () => {
    await action({request: signupRequest({}), context});

    expect(assignedHandle()).toBe('marketing');
  });
});
