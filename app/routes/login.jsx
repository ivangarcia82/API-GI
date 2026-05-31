import {useState} from 'react';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';
import {useApp} from '~/lib/AppContext';

export const meta = () => [{title: 'Iniciar sesión · Generando Ideas'}];

export default function Login() {
  const {setRole} = useApp();
  const [role, setLocalRole] = useState('buyer');
  const [email, setEmail] = useState('');

  // Real auth is delegated to Shopify's Customer Account (OAuth). We persist
  // the chosen B2B role first, then hand off to /account/login.
  const handleSubmit = (e) => {
    e.preventDefault();
    setRole(role);
    window.location.href = email
      ? `/account/login?login_hint=${encodeURIComponent(email)}`
      : '/account/login';
  };

  return (
    <div className="auth-wrap" data-screen-label="02 Login">
      <div className="auth-form-col">
        <div className="eyebrow">// Acceso · /login</div>
        <h1>Inicia sesión.</h1>
        <p>Accede a precios para clientes, tu lista de cotización y el historial de pedidos.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Correo corporativo</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mariana@empresa.mx"
            />
          </div>

          <div className="field">
            <label>Tipo de cuenta</label>
            <div className="role-pick">
              <button
                type="button"
                onClick={() => setLocalRole('buyer')}
                className={role === 'buyer' ? 'active' : ''}
              >
                Cliente comprador
              </button>
              <button
                type="button"
                onClick={() => setLocalRole('quoter')}
                className={role === 'quoter' ? 'active' : ''}
              >
                Cliente cotizador
              </button>
            </div>
            <span className="help-msg">
              {role === 'buyer'
                ? 'Acceso completo: compra directa con precios autorizados.'
                : 'Solicita cotizaciones; sin checkout directo.'}
            </span>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            iconRight="arrow_right"
            style={{width: '100%', justifyContent: 'center', marginTop: 8}}
          >
            Continuar con Shopify
          </Button>
          <span className="help-msg" style={{textAlign: 'center'}}>
            Acceso seguro con Shopify Customer Accounts (código por correo).
          </span>
        </form>

        <div
          style={{
            marginTop: 32,
            padding: 16,
            background: 'var(--bg-soft)',
            borderRadius: 12,
            fontSize: 13,
            color: 'var(--ink-3)',
            display: 'flex',
            gap: 12,
            alignItems: 'start',
          }}
        >
          <Icon name="bolt" size={16} className="muted" />
          <span>
            <strong style={{color: 'var(--ink)'}}>¿No tienes cuenta?</strong>{' '}
            <a href="/registro" style={{color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline'}}>
              Regístrate aquí
            </a>{' '}
            · Aprobación en menos de 24 horas hábiles.
          </span>
        </div>
      </div>

      <aside className="auth-side">
        <div style={{position: 'relative'}}>
          <div className="eyebrow" style={{color: 'var(--accent)'}}>
            // Acceso autorizado
          </div>
          <h2>
            Tu cuenta<br />
            <em>desbloquea</em><br />
            precios reales.
          </h2>
        </div>
        <div className="auth-perks">
          {[
            'Precios netos por volumen y tier',
            'Lista de cotización ilimitada',
            'Historial completo de pedidos',
            'Asesor de cuenta dedicado',
            'Re-órdenes con un solo clic',
          ].map((p) => (
            <div key={p} className="p">
              <Icon name="check" size={16} />
              {p}
            </div>
          ))}
        </div>
        <div className="auth-quote">
          “Pedimos 1,200 kits de bienvenida personalizados. Llegaron en 11 días, impecables.”
          <div style={{marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)'}}>
            MARIANA RUIZ · HR LEAD · BANORTE
          </div>
        </div>
      </aside>
    </div>
  );
}
