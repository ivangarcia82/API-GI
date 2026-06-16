import {createCustomer} from '../admin/operations.js';
import {setShopifyGid} from './users.js';

/**
 * Create the Shopify customer for a freshly-signed-up user and persist its gid.
 * Best-effort: a Shopify failure must NOT fail signup; returns null on failure
 * (the gid is reconciled later by reconcileShopifyCustomer).
 * @param {import('@libsql/client/web').Client} db
 * @param {Record<string, any>} env
 * @param {{id: string, email: string, firstName?: string, lastName?: string}} user
 * @returns {Promise<string|null>}
 */
export async function linkSignupCustomer(db, env, user) {
  try {
    const {gid} = await createCustomer(env, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    await setShopifyGid(db, user.id, gid);
    return gid;
  } catch (err) {
    console.warn(
      `[signup] Shopify customer link failed for user ${user.id}: ${
        err && err.message
      } — will reconcile later.`,
    );
    return null;
  }
}
