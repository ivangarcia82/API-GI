import {describe, it, expect, vi, beforeEach} from 'vitest';

const createCustomer = vi.fn();
const setShopifyGid = vi.fn();

vi.mock('../admin/operations.js', () => ({
  createCustomer: (...a) => createCustomer(...a),
}));
vi.mock('./users.js', () => ({
  setShopifyGid: (...a) => setShopifyGid(...a),
}));

import {linkSignupCustomer} from './signup-link.js';

const db = {__db: true};
const env = {PRIVATE_ADMIN_API_TOKEN: 't'};

beforeEach(() => {
  createCustomer.mockReset();
  setShopifyGid.mockReset();
});

describe('linkSignupCustomer', () => {
  it('creates the customer and persists the gid, returning it', async () => {
    createCustomer.mockResolvedValueOnce({gid: 'gid://shopify/Customer/7'});
    const gid = await linkSignupCustomer(db, env, {
      id: 'u1',
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
    });
    expect(gid).toBe('gid://shopify/Customer/7');
    expect(createCustomer).toHaveBeenCalledWith(env, {
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
    });
    expect(setShopifyGid).toHaveBeenCalledWith(db, 'u1', 'gid://shopify/Customer/7');
  });

  it('never throws if the Shopify call fails (signup must survive)', async () => {
    createCustomer.mockRejectedValueOnce(new Error('admin down'));
    const gid = await linkSignupCustomer(db, env, {
      id: 'u2',
      email: 'x@y.com',
    });
    expect(gid).toBe(null);
    expect(setShopifyGid).not.toHaveBeenCalled();
  });
});
