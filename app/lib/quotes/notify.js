// Server-only. Best-effort notification fan-out when a quote is submitted.
// Mirrors lib/auth/verify-link.js: never throws, `deps` injectable for tests.
// The quote is already persisted by the time we get here, so no failure in this
// module may propagate — but every failure is logged with its recipient.
import {getCustomerAdvisor as realGetCustomerAdvisor} from '../admin/operations.js';
import {sendEmail as realSendEmail} from '../email/resend.js';
import {buildAdvisorEmail} from './advisorEmail.js';
import {managerFor as realManagerFor} from './managers.js';
import {buildCustomerEmail} from './customerEmail.js';

const DEFAULT_SALES_EMAIL = 'ventas@generandoideas.com';

/**
 * Who receives the internal copy of a submitted quote. Falls back to the sales
 * inbox when the customer has no advisor assigned, so a quote is never lost.
 * @param {string|null|undefined} advisorEmail
 * @param {Record<string, any>} env
 * @returns {string}
 */
export function resolveAdvisorRecipient(advisorEmail, env) {
  const advisor = String(advisorEmail ?? '').trim();
  if (advisor) return advisor;
  return String(env?.SALES_EMAIL ?? '').trim() || DEFAULT_SALES_EMAIL;
}

/**
 * Resolve the advisor without ever throwing: a Shopify outage must still let
 * the quote reach the sales inbox rather than swallowing the whole notification.
 */
async function lookupAdvisorEmail(env, customerGid, getCustomerAdvisor) {
  try {
    const advisor = await getCustomerAdvisor(env, customerGid);
    return advisor && advisor.email ? advisor.email : null;
  } catch (err) {
    console.error('[quote.notify] advisor lookup failed; using sales fallback:', err);
    return null;
  }
}

async function trySend(env, sendEmail, message, label) {
  try {
    await sendEmail(env, message);
    return true;
  } catch (err) {
    console.error(`[quote.notify] ${label} email to ${message.to} failed:`, err);
    return false;
  }
}

/**
 * Notify the advisor (or sales) and the buyer that a quote was submitted.
 * Each send is isolated so one failure never suppresses the other.
 *
 * @param {Record<string, any>} env
 * @param {{
 *   quote: {id: string, notes?: string|null, deadline?: string|null},
 *   user: {email: string, firstName?: string, lastName?: string, company?: string},
 *   items: Array<Record<string, any>>,
 *   invoiceUrl: string|null,
 *   customerGid: string|null,
 *   origin: string,
 * }} params
 * @param {{getCustomerAdvisor?: Function, sendEmail?: Function, managerFor?: Function}} [deps]
 * @returns {Promise<{advisorTo: string, advisorSent: boolean, customerSent: boolean}>}
 */
export async function notifyQuoteSubmitted(
  env,
  {quote, user, items, invoiceUrl, customerGid, origin},
  deps = {},
) {
  const getCustomerAdvisor = deps.getCustomerAdvisor ?? realGetCustomerAdvisor;
  const sendEmail = deps.sendEmail ?? realSendEmail;
  const managerFor = deps.managerFor ?? realManagerFor;

  const advisorEmail = await lookupAdvisorEmail(env, customerGid, getCustomerAdvisor);
  const advisorTo = resolveAdvisorRecipient(advisorEmail, env);
  // Sobre advisorEmail, no sobre advisorTo: advisorTo ya trae el fallback a
  // ventas@, y ese buzón no tiene manager que copiar. El requisito es copiar
  // "si la cotización tiene ejecutivo".
  const managerEmail = advisorEmail ? managerFor(advisorEmail) : null;

  const quoteUrl = new URL(
    `/account/cotizaciones/${encodeURIComponent(quote.id)}`,
    origin,
  ).toString();

  // Sólo tiene sentido mandar al portal a quien podrá abrirla: el ejecutivo
  // asignado. El buzón general no tiene cuenta de asesor.
  const portalUrl = advisorEmail
    ? new URL(`/asesor/cotizaciones/${encodeURIComponent(quote.id)}`, origin).toString()
    : null;

  const advisorSent = await trySend(
    env,
    sendEmail,
    buildAdvisorEmail({
      advisorEmail: advisorTo,
      managerEmail,
      quote,
      user,
      items,
      invoiceUrl,
      portalUrl,
    }),
    'advisor',
  );

  const customerSent = await trySend(
    env,
    sendEmail,
    {...buildCustomerEmail({quote, user, items, quoteUrl}), replyTo: advisorTo},
    'customer',
  );

  return {advisorTo, advisorSent, customerSent};
}
