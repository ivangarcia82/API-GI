import {data} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {sendEmail} from '~/lib/email/resend';
import {ContactScreen} from '~/components/gi/Content';

export const meta = () => [{title: 'Contacto · Generando Ideas'}];

function esc(s) {
  return String(s).replace(
    /[&<>"]/g,
    (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]),
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function action({request, context}) {
  assertSameOrigin(request);
  const {env} = context;
  const form = await request.formData();

  // Honeypot: real visitors leave this empty; bots fill it. Feign success and drop.
  if (String(form.get('company_website') || '').trim()) {
    return {ok: true};
  }

  const name = String(form.get('name') || '').trim();
  const company = String(form.get('company') || '').trim();
  const email = String(form.get('email') || '').trim();
  const phone = String(form.get('phone') || '').trim();
  const message = String(form.get('message') || '').trim();

  if (!name || !email || !message) {
    return data({error: 'Completa nombre, correo y mensaje.'}, {status: 400});
  }
  if (!EMAIL_RE.test(email)) {
    return data({error: 'Revisa el formato del correo.'}, {status: 400});
  }

  // Keep the subject single-line so it renders cleanly in every mail client.
  const subject = `Contacto web — ${name}${company ? ` (${company})` : ''}`.replace(
    /[\r\n]+/g,
    ' ',
  );

  // Internal inbox to receive contact submissions (defaults to the brand inbox).
  const to = env.CONTACT_EMAIL || 'marketing@generandoideas.com';
  const html = `
    <h2>Nuevo mensaje de contacto</h2>
    <p><strong>Nombre:</strong> ${esc(name)}</p>
    <p><strong>Empresa:</strong> ${esc(company) || '—'}</p>
    <p><strong>Correo:</strong> ${esc(email)}</p>
    <p><strong>Teléfono:</strong> ${esc(phone) || '—'}</p>
    <p><strong>Mensaje:</strong></p>
    <p>${esc(message).replace(/\n/g, '<br>')}</p>
  `;

  try {
    await sendEmail(env, {
      to,
      subject,
      html,
      replyTo: email, // so the team can reply straight to the visitor
    });
    return {ok: true};
  } catch (err) {
    console.error('[contacto] sendEmail failed:', err);
    return data(
      {error: 'No se pudo enviar el mensaje. Intenta de nuevo o escríbenos directo.'},
      {status: 502},
    );
  }
}

export default function Contacto() {
  return <ContactScreen />;
}
