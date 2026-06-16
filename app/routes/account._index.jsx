import {useLoaderData, useOutletContext, useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';
import {useApp} from '~/lib/AppContext';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {findById} from '~/lib/auth/users';
import {getCustomerAdvisor} from '~/lib/admin/operations';

export async function loader({context}) {
  const sessionUser = await requireUser(context);
  const db = getDb(context.env);
  // Resolve the assigned advisor from the Shopify customer's
  // custom.ejecutiva_de_venta metaobject; degrade gracefully on failure.
  let advisor = {email: null, fields: {}};
  try {
    const user = await findById(db, sessionUser.userId);
    advisor = await getCustomerAdvisor(context.env, user?.shopifyCustomerGid);
  } catch (err) {
    console.error('[account] advisor lookup failed (non-fatal):', err);
  }
  return {advisor};
}

export default function AccountOverview() {
  const {user} = useOutletContext();
  const {advisor} = useLoaderData();
  const navigate = useNavigate();
  const {quoteCount, favs, openQuoteDrawer} = useApp();

  const stats = [
    {l: 'En cotización', v: quoteCount, d: 'piezas pendientes'},
    {l: 'Favoritos', v: favs.length, d: 'productos guardados'},
    {l: 'Empresa', v: user?.company || '—', d: 'cuenta corporativa'},
  ];

  return (
    <>
      <h1>Hola{user?.firstName ? `, ${user.firstName}` : ''}.</h1>
      <p style={{color: 'var(--ink-3)', margin: '-8px 0 0'}}>
        Este es el resumen de tu cuenta corporativa en Generando Ideas.
      </p>

      <div className="acct-stats">
        {stats.map((s) => (
          <div key={s.l} className="acct-stat">
            <div className="l">{s.l}</div>
            <div className="v">{s.v}</div>
            <div className="d">{s.d}</div>
          </div>
        ))}
      </div>

      <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
        <Button variant="primary" iconRight="arrow_right" onClick={() => navigate('/catalogo')}>
          Explorar catálogo
        </Button>
        <Button variant="ghost" icon="quote" onClick={openQuoteDrawer}>
          Mi cotización
        </Button>
      </div>

      <div className="quote-card" style={{display: 'flex', gap: 14, alignItems: 'start'}}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--accent-soft)',
            color: 'var(--warn)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={advisor.email ? 'user' : 'bolt'} size={18} />
        </div>
        {advisor.email ? (
          <div>
            <div className="quote-card-label">Tu asesor</div>
            {advisor.fields.nombre && (
              <div style={{fontWeight: 600, margin: '2px 0'}}>{advisor.fields.nombre}</div>
            )}
            <div>
              <a href={`mailto:${advisor.email}`}>{advisor.email}</a>
            </div>
            {advisor.fields.telefono && (
              <div style={{fontSize: 14, color: 'var(--ink-3)'}}>{advisor.fields.telefono}</div>
            )}
          </div>
        ) : (
          <div>
            <div style={{fontWeight: 600, marginBottom: 4}}>¿Necesitas ayuda?</div>
            <p style={{margin: 0, fontSize: 14, color: 'var(--ink-3)'}}>
              Escríbenos a marketing@generandoideas.com. Tu asesor asignado aparecerá
              aquí en cuanto lo tengas configurado.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
