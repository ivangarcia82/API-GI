// Standalone, print-optimized HTML view of a quote (resource route — returns
// raw HTML, no app chrome) so the buyer can Cmd+P → "Guardar como PDF" or share.
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getQuoteWithItems} from '~/lib/quotes/repo';
import {findById} from '~/lib/auth/users';

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

function decoration(item) {
  if (item.technique && item.technique !== 'Sin decorado') {
    return [item.technique, item.size].filter(Boolean).join(' ');
  }
  return '—';
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

  const subtotal = items.reduce((s, i) => s + i.effectiveUnitPrice * i.qty, 0);
  const iva = subtotal * 0.16;
  const total = subtotal + iva;
  const totalPieces = items.reduce((n, i) => n + i.qty, 0);
  const issued = new Date().toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const rows = items
    .map(
      (i) => `
        <tr>
          <td>${esc(i.title)}</td>
          <td>${esc(decoration(i))}</td>
          <td class="num">${i.qty}</td>
          <td class="num">${money(i.effectiveUnitPrice)}</td>
          <td class="num">${money(i.effectiveUnitPrice * i.qty)}</td>
        </tr>`,
    )
    .join('');

  const customer = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Cotización ${esc(quote.id)} · Generando Ideas</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #14110a; margin: 0; padding: 40px; }
  .wrap { max-width: 800px; margin: 0 auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #14110a; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
  .brand small { display: block; font-size: 11px; font-weight: 500; color: #6b6b6b; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 4px; }
  .meta { text-align: right; font-size: 13px; color: #444; }
  .meta .folio { font-family: monospace; font-size: 13px; color: #14110a; word-break: break-all; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .parties { display: flex; gap: 40px; font-size: 13px; margin-bottom: 24px; }
  .parties .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; border-bottom: 2px solid #ddd; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
  td { border-bottom: 1px solid #eee; padding: 8px 10px; }
  .num { text-align: right; }
  tfoot td { border: none; padding: 4px 10px; }
  tfoot tr.total td { font-weight: 800; font-size: 15px; border-top: 2px solid #14110a; padding-top: 10px; }
  .note { margin-top: 24px; font-size: 12px; color: #666; line-height: 1.5; }
  .actions { margin-bottom: 24px; }
  .actions button { font: inherit; padding: 10px 20px; border: 1px solid #14110a; background: #14110a; color: #fff; border-radius: 999px; cursor: pointer; }
  @media print { .actions { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="wrap">
    <div class="actions"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
    <div class="head">
      <div class="brand">Generando Ideas<small>Artículos promocionales B2B</small></div>
      <div class="meta">
        <div><strong>Cotización</strong></div>
        <div class="folio">${esc(quote.id)}</div>
        <div>${esc(issued)}</div>
      </div>
    </div>

    <div class="parties">
      <div>
        <div class="label">Cliente</div>
        <div>${esc(customer || user?.email || '—')}</div>
        ${user?.company ? `<div>${esc(user.company)}</div>` : ''}
        ${user?.email ? `<div>${esc(user.email)}</div>` : ''}
      </div>
      ${quote.deadline ? `<div><div class="label">Fecha objetivo</div><div>${esc(quote.deadline)}</div></div>` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th>Decorado</th>
          <th class="num">Cant.</th>
          <th class="num">Unitario</th>
          <th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3"></td><td class="num">Subtotal</td><td class="num">${money(subtotal)}</td></tr>
        <tr><td colspan="3"></td><td class="num">IVA (16%)</td><td class="num">${money(iva)}</td></tr>
        <tr class="total"><td colspan="3">${totalPieces} piezas</td><td class="num">Total</td><td class="num">${money(total)}</td></tr>
      </tfoot>
    </table>

    ${quote.notes ? `<div class="note"><strong>Notas:</strong> ${esc(quote.notes)}</div>` : ''}
    <div class="note">Precios estimados en MXN, sin compromiso de compra. Un asesor confirma disponibilidad y precios finales. Respuesta en menos de 24 horas hábiles.</div>
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
