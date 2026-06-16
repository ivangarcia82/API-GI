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
  const totalPieces = items.reduce((n, i) => n + i.qty, 0);
  return (
    <>
      <Link to="/account/cotizaciones" className="acct-back">
        ← Mis cotizaciones
      </Link>

      <div className="quote-detail-head">
        <div>
          <div className="quote-row-label">Folio</div>
          <h1 style={{fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 'clamp(18px,2.4vw,26px)', margin: '4px 0 0', wordBreak: 'break-all'}}>
            {quote.id}
          </h1>
        </div>
        <span className={`quote-status quote-status--${quote.status}`}>
          {STATUS_LABEL[quote.status] || quote.status}
        </span>
      </div>

      {advisor.email && (
        <div className="quote-card quote-advisor">
          <div className="quote-card-label">Tu asesor</div>
          {advisor.fields.nombre && <div className="quote-advisor-name">{advisor.fields.nombre}</div>}
          <div>
            <a href={`mailto:${advisor.email}`}>{advisor.email}</a>
          </div>
          {advisor.fields.telefono && (
            <div style={{color: 'var(--ink-3)', fontSize: 14}}>{advisor.fields.telefono}</div>
          )}
        </div>
      )}

      <div className="quote-card quote-items">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Decorado</th>
              <th className="num">Cant.</th>
              <th className="num">Unitario</th>
              <th className="num">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.title}</td>
                <td>
                  {i.technique && i.technique !== 'Sin decorado'
                    ? `${i.technique} ${i.size || ''}`.trim()
                    : '—'}
                </td>
                <td className="num">{i.qty}</td>
                <td className="num">{formatPrice(i.effectiveUnitPrice)}</td>
                <td className="num">{formatPrice(i.effectiveUnitPrice * i.qty)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total · {totalPieces} pz</td>
              <td className="num" colSpan={3}>{formatPrice(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
