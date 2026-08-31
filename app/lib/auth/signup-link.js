import {addCustomerTags, createCustomer} from '../admin/operations.js';
import {setShopifyGid} from './users.js';

/**
 * Etiqueta con la que marketing filtra en el admin los registros que todavía
 * no tienen ejecutivo asignado.
 */
export const LEAD_PENDING_TAG = 'lead-pendiente';

/**
 * Create the Shopify customer for a freshly-signed-up user and persist its gid.
 * Best-effort: a Shopify failure must NOT fail signup; returns null on failure
 * (the gid is reconciled later by reconcileShopifyCustomer).
 *
 * **No asigna ejecutiva de venta.** Desde la reunión del lunes (2026-08-30) el
 * customer queda sin `custom.ejecutiva_de_venta` y con la etiqueta
 * `lead-pendiente`; marketing valida y asigna en el admin. Mientras tanto sus
 * cotizaciones caen en el buzón de ventas por el fallback de `quotes/notify.js`.
 *
 * @param {import('@libsql/client/web').Client} db
 * @param {Record<string, any>} env
 * @param {{id: string, email: string, firstName?: string, lastName?: string}} user
 * @param {{newsletterOptIn?: boolean}} [opciones]
 * @returns {Promise<string|null>}
 */
export async function linkSignupCustomer(db, env, user, {newsletterOptIn = false} = {}) {
  let gid;
  try {
    ({gid} = await createCustomer(env, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      newsletterOptIn,
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

  // El etiquetado es best-effort dentro del best-effort: un customer enlazado
  // sin etiqueta sigue siendo mejor que perder el enlace.
  try {
    await addCustomerTags(env, gid, [LEAD_PENDING_TAG]);
  } catch (err) {
    console.warn(
      `[signup] lead tag failed for user ${user.id}: ${
        err && err.message
      } — customer linked, tag manually in admin.`,
    );
  }

  return gid;
}
