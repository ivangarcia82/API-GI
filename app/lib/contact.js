// Server-only. Pure validation + email-body construction for the public
// contact form (POST /api/contact). Kept framework-free and side-effect-free
// so it can be unit tested without a fetch/Resend mock. Ported from
// gi-website-final/api/contact.js (the original Vercel serverless function).

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]),
  );

/**
 * Server-side validation mirrors the client rules (never trust the client).
 * @param {Record<string, string>} fields
 * @returns {Record<string, string>} map of field -> error message; empty when valid
 */
export function validateContact(fields) {
  const get = (k) => String(fields?.[k] ?? '').trim();
  const name = get('name');
  const company = get('company');
  const role = get('role');
  const email = get('email');
  const phone = get('phone');
  const service = get('service');
  const source = get('source');
  const message = get('message');

  const errors = {};
  if (!name) errors.name = 'requerido';
  if (!company) errors.company = 'requerido';
  if (!role) errors.role = 'requerido';
  if (!email) errors.email = 'requerido';
  else if (!EMAIL_RE.test(email)) errors.email = 'inválido';
  if (!phone) errors.phone = 'requerido';
  if (!service) errors.service = 'requerido';
  if (!source) errors.source = 'requerido';
  if (!message || message.length < 10) errors.message = 'muy corto';

  return errors;
}

/**
 * Builds the Resend email payload (subject/html/text) for a validated
 * contact-form submission.
 * @param {{name: string, company: string, role: string, email: string, phone: string, service: string, source: string, message: string}} fields
 * @returns {{subject: string, html: string, text: string}}
 */
export function buildContactEmail(fields) {
  const name = String(fields?.name ?? '').trim();
  const company = String(fields?.company ?? '').trim();
  const role = String(fields?.role ?? '').trim();
  const email = String(fields?.email ?? '').trim();
  const phone = String(fields?.phone ?? '').trim();
  const service = String(fields?.service ?? '').trim();
  const source = String(fields?.source ?? '').trim();
  const message = String(fields?.message ?? '').trim();

  const rows = [
    ['Nombre', name],
    ['Empresa', company],
    ['Cargo / Área', role],
    ['Correo', email],
    ['Celular', phone],
    ['Servicio', service],
    ['¿Cómo llegó?', source],
  ];

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#101114;line-height:1.5">
      <h2 style="margin:0 0 16px">Nueva solicitud de contacto</h2>
      <table style="border-collapse:collapse;width:100%;max-width:560px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr>
                 <td style="padding:8px 12px;border:1px solid #e5e5e6;background:#fafafa;font-weight:bold;white-space:nowrap">${esc(k)}</td>
                 <td style="padding:8px 12px;border:1px solid #e5e5e6">${esc(v)}</td>
               </tr>`,
          )
          .join('')}
      </table>
      <h3 style="margin:20px 0 8px">Mensaje</h3>
      <p style="white-space:pre-wrap;margin:0;padding:12px;border:1px solid #e5e5e6;border-radius:8px;background:#fafafa">${esc(message)}</p>
    </div>`;

  const text = [...rows.map(([k, v]) => `${k}: ${v}`), '', 'Mensaje:', message].join('\n');

  return {
    subject: `Nueva solicitud — ${name} (${company})`,
    html,
    text,
  };
}
