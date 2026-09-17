import {useLoaderData, Link, data} from 'react-router';
import {requireAdvisor} from '~/lib/auth/advisor-guard';
import {getDb} from '~/lib/db/client';
import {getQuoteWithItems} from '~/lib/quotes/repo';
import {findById} from '~/lib/auth/users';
import {advisorCanSee} from '~/lib/quotes/advisorAccess';
import {folioVisible} from '~/lib/quotes/folio';
import {quoteTotals} from '~/lib/quotes/discount';
import {formatPrice} from '~/lib/gi';

export const meta = () => [{title: 'Cotización asignada · Generando Ideas'}];

export async function loader({params, context}) {
  const asesor = await requireAdvisor(context);
  const db = getDb(context.env);
  const {quote, items} = await getQuoteWithItems(db, params.id);

  // La regla aquí no es propiedad sino asignación: la cotización es de un
  // cliente, y el ejecutivo la ve porque le tocó atenderla.
  if (!quote || !advisorCanSee(quote, asesor.email)) {
    throw data({error: 'No encontrada'}, {status: 404});
  }

  // Datos del comprador, para que el ejecutivo sepa a quién contactar.
  const comprador = await findById(db, quote.userId).catch(() => null);

  return {
    quote,
    items,
    comprador: comprador
      ? {
          nombre: [comprador.firstName, comprador.lastName].filter(Boolean).join(' ').trim(),
          email: comprador.email,
          phone: comprador.phone,
          company: comprador.company,
        }
      : null,
  };
}

const STATUS_LABEL = {
  submitted: 'Enviada',
  converted: 'Convertida',
  cancelled: 'Cancelada',
};

export default function AsesorCotizacionDetalle() {
  const {quote, items, comprador} = useLoaderData();
  const {subtotal, descuento, subtotalNeto} = quoteTotals(items, {
    code: quote.discountCode,
    percentage: quote.discountPercentage,
  });

  return (
    <>
      <Link to="/asesor/cotizaciones" className="acct-back">
        ← Cotizaciones asignadas
      </Link>

      <div className="quote-detail-head">
        <div>
          <div className="quote-row-label">Folio</div>
          <h1
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              fontSize: 'clamp(18px,2.4vw,26px)',
              margin: '4px 0 0',
              wordBreak: 'break-all',
            }}
          >
            {folioVisible(quote)}
          </h1>
        </div>
        <span className={`quote-status quote-status--${quote.status}`}>
          {STATUS_LABEL[quote.status] || quote.status}
        </span>
      </div>

      {comprador && (
        <div style={{margin: '16px 0 20px', lineHeight: 1.6}}>
          <div className="quote-row-label">Cliente</div>
          <div>
            <strong>{comprador.company || comprador.nombre || comprador.email}</strong>
          </div>
          {comprador.nombre && comprador.company && <div>{comprador.nombre}</div>}
          <div>
            <a href={`mailto:${comprador.email}`}>{comprador.email}</a>
          </div>
          {comprador.phone && <div>{comprador.phone}</div>}
        </div>
      )}

      <div style={{display: 'flex', gap: 10, flexWrap: 'wrap', margin: '4px 0 20px'}}>
        <a
          href={`/print/cotizacion/${quote.id}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost"
        >
          Ver / imprimir cotización
        </a>
      </div>

      <div className="quote-list">
        {items.map((i) => (
          <div key={i.id} className="quote-row" style={{cursor: 'default'}}>
            <div className="quote-row-main">
              <div>
                <strong>{i.title}</strong>
              </div>
              {i.technique && i.technique !== 'Sin decorado' && (
                <div style={{color: 'var(--ink-3)', fontSize: 13}}>
                  {[i.technique, i.size].filter(Boolean).join(' ')}
                </div>
              )}
            </div>
            <div style={{textAlign: 'right'}}>
              <div>{i.qty} pz</div>
              <div style={{color: 'var(--ink-3)', fontSize: 13}}>
                {formatPrice(i.effectiveUnitPrice)} c/u
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{textAlign: 'right', marginTop: 16, fontWeight: 700}}>
        <div>Subtotal: {formatPrice(subtotal)}</div>
        {descuento > 0 && (
          <>
            <div style={{color: 'var(--ink-3)', fontWeight: 400}}>
              Descuento {quote.discountCode} ({quote.discountPercentage}%): -
              {formatPrice(descuento)}
            </div>
            <div>Total: {formatPrice(subtotalNeto)}</div>
          </>
        )}
      </div>

      {quote.notes && (
        <div style={{marginTop: 20}}>
          <div className="quote-row-label">Notas del cliente</div>
          <p>{quote.notes}</p>
        </div>
      )}
    </>
  );
}
