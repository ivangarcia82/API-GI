import {describe, it, expect, vi, beforeEach} from 'vitest';

const createCustomer = vi.fn();
const setShopifyGid = vi.fn();
const resolveAdvisorGid = vi.fn();
const setCustomerAdvisor = vi.fn();

vi.mock('../admin/operations.js', () => ({
  createCustomer: (...a) => createCustomer(...a),
  resolveAdvisorGid: (...a) => resolveAdvisorGid(...a),
  setCustomerAdvisor: (...a) => setCustomerAdvisor(...a),
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
  resolveAdvisorGid.mockReset();
  setCustomerAdvisor.mockReset();
  resolveAdvisorGid.mockResolvedValue('gid://shopify/Metaobject/1');
  setCustomerAdvisor.mockResolvedValue(undefined);
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

  it('assigns the chosen advisor metaobject to the new customer', async () => {
    createCustomer.mockResolvedValueOnce({gid: 'gid://shopify/Customer/7'});
    resolveAdvisorGid.mockResolvedValueOnce('gid://shopify/Metaobject/42');

    await linkSignupCustomer(db, env, {id: 'u1', email: 'a@b.com'}, 'laura-vega');

    expect(resolveAdvisorGid).toHaveBeenCalledWith(env, 'laura-vega');
    expect(setCustomerAdvisor).toHaveBeenCalledWith(
      env,
      'gid://shopify/Customer/7',
      'gid://shopify/Metaobject/42',
    );
  });

  it('assigns the marketing fallback when that is the resolved handle', async () => {
    createCustomer.mockResolvedValueOnce({gid: 'gid://shopify/Customer/8'});
    resolveAdvisorGid.mockResolvedValueOnce('gid://shopify/Metaobject/194049835311');

    await linkSignupCustomer(db, env, {id: 'u2', email: 'c@d.com'}, 'marketing');

    expect(resolveAdvisorGid).toHaveBeenCalledWith(env, 'marketing');
    expect(setCustomerAdvisor).toHaveBeenCalledWith(
      env,
      'gid://shopify/Customer/8',
      'gid://shopify/Metaobject/194049835311',
    );
  });

  it('still returns the gid when the advisor assignment fails', async () => {
    // The customer link is the valuable part; a metafield hiccup must not undo it.
    createCustomer.mockResolvedValueOnce({gid: 'gid://shopify/Customer/9'});
    setCustomerAdvisor.mockRejectedValueOnce(new Error('metafield down'));

    const gid = await linkSignupCustomer(db, env, {id: 'u3', email: 'e@f.com'}, 'laura-vega');

    expect(gid).toBe('gid://shopify/Customer/9');
    expect(setShopifyGid).toHaveBeenCalledWith(db, 'u3', 'gid://shopify/Customer/9');
  });

  it('skips the advisor call entirely when no handle is given', async () => {
    createCustomer.mockResolvedValueOnce({gid: 'gid://shopify/Customer/10'});

    await linkSignupCustomer(db, env, {id: 'u4', email: 'g@h.com'});

    expect(resolveAdvisorGid).not.toHaveBeenCalled();
    expect(setCustomerAdvisor).not.toHaveBeenCalled();
  });
});
