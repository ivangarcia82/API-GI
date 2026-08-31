import {describe, it, expect, vi, beforeEach} from 'vitest';

const createCustomer = vi.fn();
const setShopifyGid = vi.fn();
const addCustomerTags = vi.fn();
const setCustomerAdvisor = vi.fn();

vi.mock('../admin/operations.js', () => ({
  createCustomer: (...a) => createCustomer(...a),
  addCustomerTags: (...a) => addCustomerTags(...a),
  // Se mockea sólo para poder afirmar que NADIE la llama desde el alta.
  setCustomerAdvisor: (...a) => setCustomerAdvisor(...a),
}));
vi.mock('./users.js', () => ({
  setShopifyGid: (...a) => setShopifyGid(...a),
}));

import {linkSignupCustomer, LEAD_PENDING_TAG} from './signup-link.js';

const db = {__db: true};
const env = {PRIVATE_ADMIN_API_TOKEN: 't'};
const user = {id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B'};

beforeEach(() => {
  createCustomer.mockReset();
  setShopifyGid.mockReset();
  addCustomerTags.mockReset();
  setCustomerAdvisor.mockReset();
  createCustomer.mockResolvedValue({gid: 'gid://shopify/Customer/7'});
  addCustomerTags.mockResolvedValue(undefined);
});

describe('linkSignupCustomer', () => {
  it('crea el customer, guarda el gid y lo devuelve', async () => {
    const gid = await linkSignupCustomer(db, env, user);
    expect(gid).toBe('gid://shopify/Customer/7');
    expect(setShopifyGid).toHaveBeenCalledWith(db, 'u1', 'gid://shopify/Customer/7');
  });

  it('etiqueta al customer como lead pendiente de asignación', async () => {
    await linkSignupCustomer(db, env, user);
    expect(addCustomerTags).toHaveBeenCalledWith(env, 'gid://shopify/Customer/7', [
      LEAD_PENDING_TAG,
    ]);
  });

  it('nunca asigna ejecutiva de venta en el alta', async () => {
    // La asignación la valida marketing en el admin. Si esta prueba falla es
    // que alguien volvió a cablear setCustomerAdvisor aquí.
    await linkSignupCustomer(db, env, user);
    expect(setCustomerAdvisor).not.toHaveBeenCalled();
  });

  it('propaga el alta al newsletter a createCustomer', async () => {
    await linkSignupCustomer(db, env, user, {newsletterOptIn: true});
    expect(createCustomer).toHaveBeenCalledWith(env, {
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      newsletterOptIn: true,
    });
  });

  it('no suscribe por omisión', async () => {
    await linkSignupCustomer(db, env, user);
    expect(createCustomer.mock.calls[0][1].newsletterOptIn).toBe(false);
  });

  it('nunca lanza si Shopify falla (el alta debe sobrevivir)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createCustomer.mockRejectedValueOnce(new Error('admin down'));
    await expect(linkSignupCustomer(db, env, user)).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('devuelve el gid aunque el etiquetado falle', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    addCustomerTags.mockRejectedValueOnce(new Error('tags down'));
    await expect(linkSignupCustomer(db, env, user)).resolves.toBe(
      'gid://shopify/Customer/7',
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
