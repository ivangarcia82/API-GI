/* ============================================================
   Generando Ideas — Contact form resource route
   POST /api/contact  -> validate + send via Resend HTTP API (fetch)
   Ported from gi-website-final/api/contact.js (Vercel serverless function).
   Oxygen is a Workers runtime: no Node APIs, no `resend` SDK — plain fetch
   and context.env only.
   ============================================================ */
import {data} from 'react-router';
import {validateContact, buildContactEmail} from '~/lib/contact';

/**
 * @param {import('react-router').ActionFunctionArgs & {context: any}} args
 */
export async function action({request, context}) {
  if (request.method !== 'POST') {
    return data({ok: false, error: 'method_not_allowed'}, {status: 405});
  }
  const body = await request.json().catch(() => null);
  if (!body) return data({ok: false, error: 'bad_request'}, {status: 400});

  // Honeypot: real users never fill this hidden field. Bots that do get a
  // fake success response so they don't learn to skip it.
  if (String(body.company_website ?? '').trim()) {
    return data({ok: true});
  }

  const fields = {
    name: String(body.name ?? '').trim(),
    company: String(body.company ?? '').trim(),
    role: String(body.role ?? '').trim(),
    email: String(body.email ?? '').trim(),
    phone: String(body.phone ?? '').trim(),
    service: String(body.service ?? '').trim(),
    source: String(body.source ?? '').trim(),
    message: String(body.message ?? '').trim(),
  };
  const errors = validateContact(fields);
  if (Object.keys(errors).length) {
    return data({ok: false, error: 'validation', fields: errors}, {status: 422});
  }

  const apiKey = context.env.RESEND_API_KEY;
  if (!apiKey) return data({ok: false, error: 'server_misconfigured'}, {status: 500});

  const {subject, html, text} = buildContactEmail(fields);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      from: 'Generando Ideas <formulario@notificaciones.generandoideas.com>',
      to: context.env.CONTACT_EMAIL || 'marketing@generandoideas.com',
      reply_to: fields.email,
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) return data({ok: false, error: 'send_failed'}, {status: 502});
  return data({ok: true});
}
