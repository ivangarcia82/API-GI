// Pure helper: build the "te asignaron un cliente nuevo" email for a sales
// advisor (no I/O). Returns {to, subject, html} ready for sendEmail.
import {escapeHtml} from '../email/escape.js';

const DASH = '—';

/**
 * Deep link to the customer in the Shopify admin. Null whenever we can't build
 * a trustworthy one — the email then simply omits the button.
 * @param {string|null|undefined} storeDomain e.g. "development-gi.myshopify.com"
 * @param {string|null|undefined} customerGid e.g. "gid://shopify/Customer/123"
 * @returns {string|null}
 */
export function shopifyCustomerAdminUrl(storeDomain, customerGid) {
  const domain = String(storeDomain ?? '').trim();
  if (!domain) return null;
  const match = /^gid:\/\/shopify\/Customer\/(\d+)$/.exec(String(customerGid ?? ''));
  if (!match) return null;
  const store = domain.replace(/\.myshopify\.com$/, '');
  return `https://admin.shopify.com/store/${store}/customers/${match[1]}`;
}

function row(label, value) {
  return `
      <tr>
        <td style="padding:6px 16px 6px 0;color:#666;white-space:nowrap">${escapeHtml(label)}</td>
        <td style="padding:6px 0"><strong>${escapeHtml(value || DASH)}</strong></td>
      </tr>`;
}

/**
 * @param {{
 *   advisorTo: string,
 *   advisorName?: string,
 *   user: {email: string, firstName?: string|null, lastName?: string|null, company?: string|null, phone?: string|null},
 *   customerAdminUrl: string|null,
 *   claimedAdvisor?: string|null,
 *   esCliente?: string|null,
 * }} args
 * @returns {{to: string, subject: string, html: string}}
 */
export function buildSignupAdvisorEmail({
  advisorTo,
  advisorName,
  user,
  customerAdminUrl,
  claimedAdvisor,
  esCliente,
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const quien = fullName || user.email;
  const yaCliente = esCliente === 'si' ? 'Sí' : esCliente === 'no' ? 'No' : DASH;

  const saludo = advisorName
    ? `<p>Hola ${escapeHtml(advisorName)},</p>`
    : '';

  const shopifyBlock = customerAdminUrl
    ? `<p style="margin:24px 0">
        <a href="${escapeHtml(customerAdminUrl)}" style="background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Ver cliente en Shopify</a>
      </p>`
    : '';

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.5">
      ${saludo}
      <p><strong>${escapeHtml(quien)}</strong> creó una cuenta y está pendiente de que le asignen ejecutivo de venta.</p>
      <table style="border-collapse:collapse;margin-top:12px">
        <tbody>${row('Correo', user.email)}${row('Teléfono', user.phone)}${row('Empresa', user.company)}${row('Ya es cliente', yaCliente)}${row('Asesor que indicó', claimedAdvisor)}</tbody>
      </table>
      ${shopifyBlock}
      <p style="font-size:12px;color:#666">Generando Ideas</p>
    </body></html>`;

  return {
    to: advisorTo,
    subject: `Nuevo registro ${DASH} ${quien}`,
    html,
  };
}
