// Server-only. Best-effort aviso al asesor cuando un usuario verifica su correo.
// Espeja lib/quotes/notify.js: nunca lanza, `deps` inyectable para tests. Para
// cuando llegamos aquí la cuenta ya quedó verificada, así que ningún fallo de
// este módulo puede propagarse — pero todos se registran con su destinatario.
import {
  getAdvisorByHandle as realGetAdvisorByHandle,
  getCustomerAdvisor as realGetCustomerAdvisor,
} from '../admin/operations.js';
import {sendEmail as realSendEmail} from '../email/resend.js';
import {managerFor as realManagerFor} from '../quotes/managers.js';
import {MARKETING_HANDLE} from './advisor-choice.js';
import {buildSignupAdvisorEmail} from './signup-advisor-email.js';

/**
 * Quién recibe el aviso: el asesor que el usuario eligió al registrarse. Si no
 * hay ninguno resoluble —incluido el caso raro de que el alta nunca alcanzara a
 * crear el customer en Shopify— el lead cae en el entry `marketing`, que es la
 * misma regla que aplica la asignación del metaobject.
 * @returns {Promise<{correo: string, nombre: string}|null>}
 */
async function resolveRecipient(env, customerGid, getCustomerAdvisor, getAdvisorByHandle) {
  // Sin customer no hay metafield que leer: ir directo al respaldo evita una
  // llamada al Admin API que solo puede volver vacía.
  if (customerGid) {
    try {
      const advisor = await getCustomerAdvisor(env, customerGid);
      if (advisor && advisor.email) {
        return {correo: advisor.email, nombre: (advisor.fields && advisor.fields.nombre) || ''};
      }
    } catch (err) {
      console.error('[signup.notify] advisor lookup failed; trying marketing:', err);
    }
  }

  try {
    const fallback = await getAdvisorByHandle(env, MARKETING_HANDLE);
    if (fallback && fallback.correo) {
      return {correo: fallback.correo, nombre: fallback.nombre || ''};
    }
  } catch (err) {
    console.error('[signup.notify] marketing fallback lookup failed:', err);
  }

  return null;
}

/**
 * Avisa al asesor asignado que un usuario nuevo verificó su correo.
 *
 * @param {Record<string, any>} env
 * @param {{user: {email: string, firstName?: string|null, lastName?: string|null,
 *   company?: string|null, phone?: string|null, shopifyCustomerGid?: string|null,
 *   advisorHandle?: string|null, esCliente?: string|null}}} params
 * @param {{getCustomerAdvisor?: Function, getAdvisorByHandle?: Function, sendEmail?: Function, managerFor?: Function}} [deps]
 * @returns {Promise<{sent: boolean, to: string|null}>}
 */
export async function notifyAdvisorOfSignup(env, {user}, deps = {}) {
  const getCustomerAdvisor = deps.getCustomerAdvisor ?? realGetCustomerAdvisor;
  const getAdvisorByHandle = deps.getAdvisorByHandle ?? realGetAdvisorByHandle;
  const sendEmail = deps.sendEmail ?? realSendEmail;
  const managerFor = deps.managerFor ?? realManagerFor;

  const recipient = await resolveRecipient(
    env,
    user.shopifyCustomerGid,
    getCustomerAdvisor,
    getAdvisorByHandle,
  );

  if (!recipient) {
    console.warn(
      `[signup.notify] no advisor nor marketing address for ${user.email}; nobody notified.`,
    );
    return {sent: false, to: null};
  }

  // El handle sirve para filtrar, pero marketing decide mejor leyendo el
  // nombre. De la misma consulta sale el correo del asesor, que es la llave de
  // la matriz de líderes — así el CC no cuesta una llamada extra.
  // Best-effort: si no se resuelve, se manda el handle y no se copia a nadie.
  let claimedAdvisor = null;
  // Se copia al ejecutivo que la persona señaló y a su líder, para que ambos
  // estén pendientes mientras marketing valida. Copiar NO asigna: el metafield
  // `ejecutiva_de_venta` sigue vacío y las cotizaciones caen en ventas@.
  const copias = [];
  if (user.advisorHandle) {
    claimedAdvisor = user.advisorHandle;
    try {
      const reclamado = await getAdvisorByHandle(env, user.advisorHandle);
      if (reclamado && reclamado.nombre) claimedAdvisor = reclamado.nombre;
      if (reclamado && reclamado.correo) {
        copias.push(reclamado.correo);
        const lider = managerFor(reclamado.correo);
        if (lider) copias.push(lider);
      }
    } catch (err) {
      console.error('[signup.notify] claimed advisor lookup failed:', err);
    }
  }

  // Sin repetidos y sin el propio destinatario: un mismo buzón en Para y en CC
  // sólo duplica el correo.
  const cc = [...new Set(copias)].filter((c) => c && c !== recipient.correo);

  const message = buildSignupAdvisorEmail({
    advisorTo: recipient.correo,
    advisorName: recipient.nombre,
    user,
    claimedAdvisor,
    esCliente: user.esCliente ?? null,
    cc: cc.length ? cc : null,
  });

  try {
    await sendEmail(env, message);
    return {sent: true, to: recipient.correo};
  } catch (err) {
    console.error(`[signup.notify] email to ${recipient.correo} failed:`, err);
    return {sent: false, to: recipient.correo};
  }
}
