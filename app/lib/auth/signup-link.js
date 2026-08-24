import {
  createCustomer,
  resolveAdvisorGid,
  setCustomerAdvisor,
} from '../admin/operations.js';
import {setShopifyGid} from './users.js';

/**
 * Create the Shopify customer for a freshly-signed-up user and persist its gid.
 * Best-effort: a Shopify failure must NOT fail signup; returns null on failure
 * (the gid is reconciled later by reconcileShopifyCustomer).
 *
 * When `advisorHandle` is given, the customer's custom.ejecutiva_de_venta is
 * pointed at that metaobject. The handle comes from the signup form and is
 * resolved to a gid here — the browser never supplies a gid. This assignment is
 * best-effort *within* the best-effort link: a metafield failure still leaves a
 * linked customer behind, which is the part worth keeping.
 *
 * @param {import('@libsql/client/web').Client} db
 * @param {Record<string, any>} env
 * @param {{id: string, email: string, firstName?: string, lastName?: string}} user
 * @param {string|null} [advisorHandle] handle del metaobject `ejecutiva_de_venta`
 * @returns {Promise<string|null>}
 */
export async function linkSignupCustomer(db, env, user, advisorHandle = null) {
  let gid;
  try {
    ({gid} = await createCustomer(env, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    }));
    await setShopifyGid(db, user.id, gid);
  } catch (err) {
    console.warn(
      `[signup] Shopify customer link failed for user ${user.id}: ${
        err && err.message
      } — will reconcile later.`,
    );
    return null;
  }

  if (advisorHandle) {
    try {
      const advisorGid = await resolveAdvisorGid(env, advisorHandle);
      if (advisorGid) {
        await setCustomerAdvisor(env, gid, advisorGid);
      } else {
        console.warn(
          `[signup] advisor handle "${advisorHandle}" resolved to nothing for user ${user.id} — customer left unassigned.`,
        );
      }
    } catch (err) {
      console.warn(
        `[signup] advisor assignment failed for user ${user.id}: ${
          err && err.message
        } — customer linked, assign manually in admin.`,
      );
    }
  }

  return gid;
}
