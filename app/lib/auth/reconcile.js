import {isStubMode} from '../admin/client.js';
import {createCustomer} from '../admin/operations.js';
import {setShopifyGid} from './users.js';

/**
 * @param {string|null|undefined} gid
 * @returns {boolean}
 */
function needsReconcile(gid) {
  return !gid || gid.includes('STUB-');
}

/**
 * Lazily backfill/upgrade a user's Shopify customer gid. When the user's gid is
 * null or a STUB- placeholder AND a real Admin token is present, create (or
 * reuse) the real customer and persist it. Returns the effective gid.
 * @param {import('@libsql/client/web').Client} db
 * @param {Record<string, any>} env
 * @param {{id: string, email: string, firstName?: string, lastName?: string, shopifyCustomerGid: string|null}} user
 * @returns {Promise<string|null>}
 */
export async function reconcileShopifyCustomer(db, env, user) {
  if (!needsReconcile(user.shopifyCustomerGid)) {
    return user.shopifyCustomerGid;
  }
  if (isStubMode(env)) {
    return user.shopifyCustomerGid ?? null;
  }
  const {gid} = await createCustomer(env, {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  });
  await setShopifyGid(db, user.id, gid);
  return gid;
}
