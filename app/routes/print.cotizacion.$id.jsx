// Vista imprimible de una cotización (resource route: devuelve HTML crudo, sin
// el chrome de la app) para que el comprador haga Cmd+P → "Guardar como PDF".
// El diseño sigue el formato de marca: encabezado con logo, tabla con cabeceras
// naranjas, notas fijas y pie institucional.
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getQuoteWithItems} from '~/lib/quotes/repo';
import {findById} from '~/lib/auth/users';
import {getCustomerAdvisor} from '~/lib/admin/operations';
import {NOTAS_IMPORTANTES} from '~/lib/quotes/notasImportantes';
import {BRAND} from '~/lib/site-content';

const NARANJA = '#ff8300';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(amount) {
  return Number(amount || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });
}

function descripcion(item) {
  const decorado =
    item.technique && item.technique !== 'Sin decorado'
      ? [item.technique, item.size].filter(Boolean).join(' ')
      : null;
  return [item.title, decorado].filter(Boolean);
}

/**
 * Bloque "Atte." con el ejecutivo asignado. Cuando el cliente todavía no tiene
 * asesor —un lead que marketing no ha asignado— cae al buzón general en vez de
 * dejar el documento sin firma.
 */
function firma(advisor) {
  const f = (advisor && advisor.fields) || {};
  return {
    nombre: f.nombre || 'Equipo comercial',
    puesto: f.puesto || 'Generando Ideas',
    telefono: f.telefono || BRAND.phone,
    correo: (advisor && advisor.email) || BRAND.email,
  };
}

export async function loader({params, context}) {
  const sessionUser = await requireUser(context);
  const db = getDb(context.env);
  const {quote, items} = await getQuoteWithItems(db, params.id);
  // Ownership: never leak another user's quote.
  if (!quote || quote.userId !== sessionUser.userId) {
    throw new Response('No encontrada', {status: 404});
  }
  const user = await findById(db, sessionUser.userId).catch(() => null);

  // Best-effort: un fallo del Admin API no puede impedir imprimir la cotización.
  const advisor = await getCustomerAdvisor(
    context.env,
    user && user.shopifyCustomerGid,
  ).catch(() => null);
  const atte = firma(advisor);

  const subtotal = items.reduce((s, i) => s + i.effectiveUnitPrice * i.qty, 0);
  const iva = subtotal * 0.16;
  const total = subtotal + iva;
  const issued = new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

  const rows = items
    .map((i, idx) => {
      const [titulo, decorado] = descripcion(i);
      return `
        <tr>
          <td class="c">${idx + 1}</td>
          <td class="c img">${
            i.image
              ? `<img src="${esc(i.image)}" alt="" />`
              : '<span class="sin-img">—</span>'
          }</td>
          <td>
            <strong>${esc(titulo)}</strong>
            ${decorado ? `<div class="sub">${esc(decorado)}</div>` : ''}
          </td>
          <td class="c">${i.qty}</td>
          <td class="num">${money(i.effectiveUnitPrice)}</td>
          <td class="num">${money(i.effectiveUnitPrice * i.qty)}</td>
        </tr>`;
    })
    .join('');

  const customer = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const folio = quote.folio || quote.id;

  const notas = NOTAS_IMPORTANTES.map((n) => `<li>${esc(n)}</li>`).join('');

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Cotización ${esc(folio)} · Generando Ideas</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #14110a; margin: 0; padding: 32px 24px; font-size: 12px; }
  .hoja { max-width: 820px; margin: 0 auto; }

  .actions { margin-bottom: 20px; }
  .actions button { font: inherit; padding: 10px 20px; border: 1px solid #14110a; background: #14110a; color: #fff; border-radius: 999px; cursor: pointer; }

  .encabezado { text-align: center; padding-bottom: 20px; }
  .encabezado img { height: 46px; }

  .datos { display: flex; justify-content: space-between; gap: 32px; margin-bottom: 16px; }
  .datos dl { margin: 0; }
  .datos .fila { display: flex; gap: 6px; margin-bottom: 3px; }
  .datos dt { font-weight: 700; min-width: 128px; }
  .datos dd { margin: 0; }
  .datos .der { text-align: right; }
  .datos .der .fila { justify-content: flex-end; }

  .intro { margin: 12px 0 16px; }

  table { width: 100%; border-collapse: collapse; }
  thead th { background: ${NARANJA}; color: #fff; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; padding: 7px 8px; font-weight: 700; }
  tbody td { border: 1px solid #d9d9d9; padding: 8px; vertical-align: middle; }
  .c { text-align: center; }
  .num { text-align: right; white-space: nowrap; }
  .img img { max-width: 74px; max-height: 74px; object-fit: contain; display: block; margin: 0 auto; }
  .sin-img { color: #bbb; }
  .sub { color: #666; font-size: 11px; margin-top: 3px; }

  .totales { width: 260px; margin-left: auto; margin-top: 10px; }
  .totales .fila { display: flex; justify-content: space-between; align-items: center; }
  .totales .etq { background: ${NARANJA}; color: #fff; font-weight: 700; font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; padding: 5px 10px; flex: 1; text-align: right; }
  .totales .val { border: 1px solid #d9d9d9; border-left: 0; padding: 5px 10px; width: 118px; text-align: right; }

  .notas { margin-top: 28px; }
  .notas h2 { font-size: 12px; margin: 0 0 6px; }
  .notas ul { margin: 0; padding-left: 16px; }
  .notas li { margin-bottom: 3px; line-height: 1.45; }

  .atte { margin-top: 28px; line-height: 1.6; }
  .atte a { color: ${NARANJA}; }

  .pie { margin-top: 44px; text-align: center; border-top: 1px solid #e5e5e5; padding-top: 18px; }
  .pie .lema { font-size: 26px; font-weight: 800; letter-spacing: 0.06em; color: #d5d5d5; margin-bottom: 6px; }
  .pie .sub { color: #777; margin-bottom: 4px; }
  .pie .dir { color: #777; }
  .pie a { color: ${NARANJA}; text-decoration: none; }

  @media print {
    .actions { display: none; }
    body { padding: 0; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    .notas, .atte, .pie { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="hoja">
    <div class="actions"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>

    <div class="encabezado">
      <img src="/brand/gi-logo-horizontal.svg" alt="Generando Ideas" />
    </div>

    <div class="datos">
      <dl>
        <div class="fila"><dt>Cliente:</dt><dd>${esc(user?.company || customer || user?.email || '—')}</dd></div>
        <div class="fila"><dt>Atención:</dt><dd>${esc(customer || user?.email || '—')}</dd></div>
        <div class="fila"><dt>Folio:</dt><dd>${esc(folio)}</dd></div>
      </dl>
      <dl class="der">
        <div class="fila"><dt>Fecha de Cotización:</dt><dd>${esc(issued)}</dd></div>
        ${
          quote.deadline
            ? `<div class="fila"><dt>Fecha de Entrega o Envío al Cliente:</dt><dd>${esc(quote.deadline)}</dd></div>`
            : ''
        }
      </dl>
    </div>

    <p class="intro">Estimado cliente, agradeciendo su solicitud de cotización, ponemos a su consideración los siguientes artículos esperando que sean de tu agrado:</p>

    <table>
      <thead>
        <tr>
          <th style="width:34px">#</th>
          <th style="width:96px">Imagen</th>
          <th>Descripción</th>
          <th style="width:70px">Cantidad</th>
          <th style="width:96px">Precio</th>
          <th style="width:104px">Importe</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totales">
      <div class="fila"><span class="etq">Subtotal</span><span class="val">${money(subtotal)}</span></div>
      <div class="fila"><span class="etq">I.V.A.</span><span class="val">${money(iva)}</span></div>
      <div class="fila"><span class="etq">Total</span><span class="val">${money(total)}</span></div>
    </div>

    ${quote.notes ? `<div class="notas"><h2>Notas del cliente</h2><p>${esc(quote.notes)}</p></div>` : ''}

    <div class="notas">
      <h2>Notas Importantes</h2>
      <ul>${notas}</ul>
    </div>

    <div class="atte">
      Atte. ${esc(atte.nombre)}<br />
      ${esc(atte.puesto)}<br />
      P. ${esc(atte.telefono)}<br />
      <a href="mailto:${esc(atte.correo)}">${esc(atte.correo)}</a>
    </div>

    <div class="pie">
      <div class="lema">YOUR ONE STOP SOLUTION.</div>
      <div class="sub">Estrategia en Suministros Internacionales</div>
      <div class="dir">Cda. Antonio Maceo 67, Col. Escandón I Secc. Alc. Miguel Hidalgo, C.P. 11800 CDMX, México.</div>
      <div><a href="mailto:${esc(BRAND.email)}">${esc(BRAND.email)}</a> · <a href="https://www.generandoideas.com">www.generandoideas.com</a></div>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
