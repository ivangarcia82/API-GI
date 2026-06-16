import {useLoaderData, Link, data} from 'react-router';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getQuoteWithItems} from '~/lib/quotes/repo';
import {findById} from '~/lib/auth/users';
import {getCustomerAdvisor} from '~/lib/admin/operations';
import {formatPrice} from '~/lib/gi';

export const meta = () => [{title: 'Cotización · Generando Ideas'}];

export async function loader({params, context}) {
  const sessionUser = await requireUser(context);
  const db = getDb(context.env);
  const {quote, items} = await getQuoteWithItems(db, params.id);
  // Ownership check: never leak another user's quote.
  if (!quote || quote.userId !== sessionUser.userId) {
    throw data({error: 'No encontrada'}, {status: 404});
  }
  // Resolve the assigned advisor read-only; degrade gracefully on failure.
  let advisor = {email: null, fields: {}};
  try {
    const user = await findById(db, sessionUser.userId);
    advisor = await getCustomerAdvisor(context.env, user.shopifyCustomerGid);
  } catch (err) {
    console.error('[cotizacion] advisor lookup failed (non-fatal):', err);
  }
  return {quote, items, advisor};
}

const STATUS_LABEL = {
  draft: 'Borrador',
  submitted: 'Enviada',
  converted: 'Convertida',
  cancelled: 'Cancelada',
};

export default function CotizacionDetail() {
  const {quote, items, advisor} = useLoaderData();
  const total = items.reduce((s, i) => s + i.effectiveUnitPrice * i.qty, 0);
  return (
    <div className="container" style={{padding: '32px 0 80px'}} data-screen-label="Cotizacion detail">
      <Link to="/account/cotizaciones">← Mis cotizaciones</Link>
      <h1 style={{fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(24px,3vw,40px)', margin: '12px 0 8px'}}>
        Folio {quote.id}
      </h1>
      <p style={{color: 'var(--ink-3)'}}>Estado · {STATUS_LABEL[quote.status] || quote.status}</p>
      {advisor.email && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-lg)',
          }}
        >
          <div style={{fontWeight: 700, marginBottom: 4}}>Tu asesor</div>
          {advisor.fields.nombre && <div>{advisor.fields.nombre}</div>}
          <div>
            <a href={`mailto:${advisor.email}`}>{advisor.email}</a>
          </div>
          {advisor.fields.telefono && (
            <div style={{color: 'var(--ink-3)'}}>{advisor.fields.telefono}</div>
          )}
        </div>
      )}
      {quote.shopifyInvoiceUrl && (
        <p>
          <a href={quote.shopifyInvoiceUrl} target="_blank" rel="noreferrer">
            Ver / pagar cotización
          </a>
        </p>
      )}
      <table style={{width: '100%', borderCollapse: 'collapse', marginTop: 16}}>
        <thead>
          <tr style={{textAlign: 'left', borderBottom: '1px solid var(--line)'}}>
            <th style={{padding: '8px 0'}}>Producto</th>
            <th style={{padding: '8px 0'}}>Decorado</th>
            <th style={{padding: '8px 0'}}>Cant.</th>
            <th style={{padding: '8px 0'}}>Unitario</th>
            <th style={{padding: '8px 0'}}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} style={{borderBottom: '1px solid var(--line)'}}>
              <td style={{padding: '10px 0'}}>{i.title}</td>
              <td style={{padding: '10px 0'}}>
                {i.technique && i.technique !== 'Sin decorado' ? `${i.technique} ${i.size || ''}` : '—'}
              </td>
              <td style={{padding: '10px 0'}}>{i.qty}</td>
              <td style={{padding: '10px 0'}}>{formatPrice(i.effectiveUnitPrice)}</td>
              <td style={{padding: '10px 0'}}>{formatPrice(i.effectiveUnitPrice * i.qty)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{padding: '12px 0', textAlign: 'right', fontWeight: 700}}>Total</td>
            <td style={{padding: '12px 0', fontWeight: 700}}>{formatPrice(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
