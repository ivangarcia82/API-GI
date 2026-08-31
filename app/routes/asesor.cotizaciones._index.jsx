import {useLoaderData, Link} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {requireAdvisor} from '~/lib/auth/advisor-guard';
import {getDb} from '~/lib/db/client';
import {listAdvisorQuotes} from '~/lib/quotes/repo';
import {folioVisible} from '~/lib/quotes/folio';

export const meta = () => [{title: 'Cotizaciones asignadas · Generando Ideas'}];

export async function loader({context}) {
  const asesor = await requireAdvisor(context);
  const db = getDb(context.env);
  const quotes = await listAdvisorQuotes(db, asesor.email);
  return {quotes};
}

const STATUS_LABEL = {
  submitted: 'Enviada',
  converted: 'Convertida',
  cancelled: 'Cancelada',
};

export default function AsesorCotizaciones() {
  const {quotes} = useLoaderData();
  return (
    <>
      <h1>Cotizaciones asignadas</h1>
      <p style={{color: 'var(--ink-3)', margin: '-8px 0 0'}}>
        Las solicitudes de los clientes que atiendes.
      </p>

      {quotes.length === 0 ? (
        <div className="empty">
          <Icon name="quote" size={32} className="muted-2" />
          <h3>No tienes cotizaciones asignadas</h3>
          <p>
            Aparecerán aquí en cuanto un cliente tuyo envíe una. Sólo se listan las
            posteriores a la puesta en marcha del portal.
          </p>
        </div>
      ) : (
        <div className="quote-list">
          {quotes.map((q) => (
            <Link key={q.id} to={`/asesor/cotizaciones/${q.id}`} className="quote-row">
              <div className="quote-row-main">
                <div className="quote-row-label">Folio</div>
                <div className="quote-row-folio">{folioVisible(q)}</div>
              </div>
              <span className={`quote-status quote-status--${q.status}`}>
                {STATUS_LABEL[q.status] || q.status}
              </span>
              <Icon name="chevron_right" size={16} className="muted-2" />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
