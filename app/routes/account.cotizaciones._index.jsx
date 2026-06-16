import {useLoaderData, Link} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {listUserQuotes} from '~/lib/quotes/repo';

export const meta = () => [{title: 'Mis cotizaciones · Generando Ideas'}];

export async function loader({context}) {
  const sessionUser = await requireUser(context);
  const db = getDb(context.env);
  const quotes = await listUserQuotes(db, sessionUser.userId);
  return {quotes};
}

const STATUS_LABEL = {
  draft: 'Borrador',
  submitted: 'Enviada',
  converted: 'Convertida',
  cancelled: 'Cancelada',
};

export default function CotizacionesIndex() {
  const {quotes} = useLoaderData();
  return (
    <>
      <h1>Mis cotizaciones</h1>
      <p style={{color: 'var(--ink-3)', margin: '-8px 0 0'}}>
        Tus solicitudes enviadas y su estado actual.
      </p>

      {quotes.length === 0 ? (
        <div className="empty">
          <Icon name="quote" size={32} className="muted-2" />
          <h3>Aún no tienes cotizaciones</h3>
          <p>Cuando envíes una, aparecerá aquí con su folio y estado.</p>
          <Link className="btn btn-accent" to="/catalogo">
            Explorar catálogo
          </Link>
        </div>
      ) : (
        <div className="quote-list">
          {quotes.map((q) => (
            <Link key={q.id} to={`/account/cotizaciones/${q.id}`} className="quote-row">
              <div className="quote-row-main">
                <div className="quote-row-label">Folio</div>
                <div className="quote-row-folio">{q.id}</div>
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
