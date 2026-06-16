import {describe, it, expect, vi, beforeEach} from 'vitest';

const createCustomer = vi.fn();
const setShopifyGid = vi.fn();

vi.mock('../admin/operations.js', () => ({
  createCustomer: (...a) => createCustomer(...a),
}));
vi.mock('./users.js', () => ({
  setShopifyGid: (...a) => setShopifyGid(...a),
}));

import {reconcileShopifyCustomer} from './reconcile.js';

const REAL_ENV = {PRIVATE_ADMIN_API_TOKEN: 't'};
const STUB_ENV = {};
const db = {__db: true};

beforeEach(() => {
  createCustomer.mockReset();
  setShopifyGid.mockReset();
});

describe('reconcileShopifyCustomer', () => {
  it('does nothing when gid is already real', async () => {
    const gid = await reconcileShopifyCustomer(db, REAL_ENV, {
      id: 'u1',
      email: 'a@b.com',
      shopifyCustomerGid: 'gid://shopify/Customer/123',
    });
    expect(gid).toBe('gid://shopify/Customer/123');
    expect(createCustomer).not.toHaveBeenCalled();
    expect(setShopifyGid).not.toHaveBeenCalled();
  });

  it('backfills a null gid when a real token is present', async () => {
    createCustomer.mockResolvedValueOnce({gid: 'gid://shopify/Customer/55'});
    const gid = await reconcileShopifyCustomer(db, REAL_ENV, {
      id: 'u2',
      email: 'n@b.com',
      firstName: 'N',
      lastName: 'B',
      shopifyCustomerGid: null,
    });
    expect(gid).toBe('gid://shopify/Customer/55');
    expect(createCustomer).toHaveBeenCalledWith(REAL_ENV, {
      email: 'n@b.com',
      firstName: 'N',
      lastName: 'B',
    });
    expect(setShopifyGid).toHaveBeenCalledWith(db, 'u2', 'gid://shopify/Customer/55');
  });

  it('upgrades a STUB- gid when a real token is present', async () => {
    createCustomer.mockResolvedValueOnce({gid: 'gid://shopify/Customer/66'});
    const gid = await reconcileShopifyCustomer(db, REAL_ENV, {
      id: 'u3',
      email: 's@b.com',
      shopifyCustomerGid: 'gid://shopify/Customer/STUB-abc',
    });
    expect(gid).toBe('gid://shopify/Customer/66');
    expect(setShopifyGid).toHaveBeenCalledWith(db, 'u3', 'gid://shopify/Customer/66');
  });

  it('does not reconcile in stub mode (no real token)', async () => {
    const gid = await reconcileShopifyCustomer(db, STUB_ENV, {
      id: 'u4',
      email: 'z@b.com',
      shopifyCustomerGid: null,
    });
    expect(gid).toBe(null);
    expect(createCustomer).not.toHaveBeenCalled();
    expect(setShopifyGid).not.toHaveBeenCalled();
  });
});
