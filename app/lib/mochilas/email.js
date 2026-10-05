// Correo con la elección de mochila de un colaborador.
import {escapeHtml} from '~/lib/email/escape.js';
import {brandedEmail} from '~/lib/email/layout.js';

export const MOCHILAS_DEFAULT_TO = 'igarcia@generandoideas.com';

export function mochilasRecipient(env) {
  return (env && env.MOCHILAS_EMAIL) || MOCHILAS_DEFAULT_TO;
}

function oneLine(s) {
  return String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function row(label, value) {
  return `<tr><td style="padding:6px 12px 6px 0;color:#636569;white-space:nowrap;vertical-align:top">${escapeHtml(
    label,
  )}</td><td style="padding:6px 0;color:#2e3033">${escapeHtml(value)}</td></tr>`;
}

/**
 * @param {{email: string, values: any, line: {name: string}, product: {name: string},
 *   variant: {color: string, image?: string|null}}} args
 */
export function buildMochilaEmail({email, values, line, product, variant}) {
  const mochila = `${line.name} ${product.name}`;
  const subject = oneLine(`Mochila – ${values.fullName} – ${mochila} / ${variant.color}`);

  const datos = [
    row('Nombre', values.fullName),
    row('Correo', email),
    row('Área / puesto', values.position),
    row('Teléfono', values.phone),
    row('Mochila', `${mochila} · ${variant.color}`),
    row('Entrega', values.foraneo ? 'Foráneo (envío)' : 'Entrega en oficina'),
  ].join('');

  const s = values.shipping;
  const envio =
    values.foraneo && s
      ? `<h2 style="margin:24px 0 8px;font-size:16px">Datos de envío</h2><table role="presentation">${[
          row('Calle y número', s.street),
          row('Colonia', s.neighborhood),
          row('Código postal', s.zip),
          row('Ciudad', s.city),
          row('Estado', s.state),
          ...(s.references ? [row('Referencias', s.references)] : []),
          row('Recibe', s.recipient || values.fullName),
        ].join('')}</table>`
      : '';

  const foto = variant.image
    ? `<img src="${escapeHtml(variant.image)}" alt="${escapeHtml(
        `${mochila} ${variant.color}`,
      )}" width="200" style="display:block;margin:0 0 16px;border-radius:12px">`
    : '';

  const html = brandedEmail({
    preheader: `${values.fullName} eligió ${mochila} · ${variant.color}.`,
    heading: 'Nueva elección de mochila',
    bodyHtml: `${foto}<table role="presentation">${datos}</table>${envio}`,
  });

  return {subject, html};
}
