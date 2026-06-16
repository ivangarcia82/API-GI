import {useLoaderData, Link} from 'react-router';
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
    <div className="container" style={{padding: '32px 0 80px'}} data-screen-label="Cotizaciones list">
      <div className="eyebrow">{'// Cuenta · /account/cotizaciones'}</div>
      <h1 style={{fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(28px,4vw,48px)', margin: '12px 0 24px'}}>
        Mis cotizaciones
      </h1>
      {quotes.length === 0 ? (
        <div className="empty">
          <h3>Aún no tienes cotizaciones</h3>
          <p>Cuando envíes una, aparecerá aquí con su folio.</p>
          <Link to="/catalogo">Explorar catálogo</Link>
        </div>
      ) : (
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr style={{textAlign: 'left', borderBottom: '1px solid var(--line)'}}>
              <th style={{padding: '8px 0'}}>Folio</th>
              <th style={{padding: '8px 0'}}>Estado</th>
              <th style={{padding: '8px 0'}}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} style={{borderBottom: '1px solid var(--line)'}}>
                <td style={{padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 13}}>{q.id}</td>
                <td style={{padding: '10px 0'}}>{STATUS_LABEL[q.status] || q.status}</td>
                <td style={{padding: '10px 0'}}>
                  <Link to={`/account/cotizaciones/${q.id}`}>Ver detalle</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
