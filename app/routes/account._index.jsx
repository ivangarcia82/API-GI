import {useOutletContext, useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';
import {useApp} from '~/lib/AppContext';

export default function AccountOverview() {
  const {user} = useOutletContext();
  const navigate = useNavigate();
  const {role, quoteCount, favs} = useApp();

  const stats = [
    {l: 'En cotización', v: quoteCount, d: 'piezas pendientes'},
    {l: 'Favoritos', v: favs.length, d: 'productos guardados'},
    {
      l: 'Tipo de cuenta',
      v: role === 'buyer' ? 'Comprador' : 'Cotizador',
      d: 'rol activo',
    },
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
        <Button variant="ghost" icon="quote" onClick={() => navigate('/cotizacion')}>
          Mi cotización
        </Button>
      </div>

      <div
        style={{
          padding: 20,
          background: 'var(--bg-elev)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
          display: 'flex',
          gap: 14,
          alignItems: 'start',
        }}
      >
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
          <Icon name="bolt" size={18} />
        </div>
        <div>
          <div style={{fontWeight: 600, marginBottom: 4}}>Tu asesor: Carlos Méndez</div>
          <p style={{margin: 0, fontSize: 14, color: 'var(--ink-3)'}}>
            Responde en menos de 2 horas hábiles. WhatsApp +52 (55) 7098 8100 ·
            marketing@generandoideas.com
          </p>
        </div>
      </div>
    </>
  );
}
