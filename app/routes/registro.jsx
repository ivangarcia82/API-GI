import {useState} from 'react';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';
import {useApp} from '~/lib/AppContext';

export const meta = () => [{title: 'Crear cuenta · Generando Ideas'}];

export default function Registro() {
  const {setRole} = useApp();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    lastName: '',
    email: '',
    company: '',
    role: '',
    phone: '',
    rfc: '',
    needs: '',
    volume: '',
    accountType: 'buyer',
    terms: false,
  });
  const setField = (k, v) => setForm((f) => ({...f, [k]: v}));

  const next = (e) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setRole(form.accountType);
    window.location.href = form.email
      ? `/account/login?login_hint=${encodeURIComponent(form.email)}`
      : '/account/login';
  };

  return (
    <div className="auth-wrap" data-screen-label="03 Register">
      <div className="auth-form-col">
        <div className="eyebrow">// Registro · paso {step}/3</div>
        <h1>Crea tu cuenta.</h1>
        <p>Cuéntanos sobre ti. Toma menos de 2 minutos. Cuenta lista en 24 horas hábiles.</p>

        <div style={{display: 'flex', gap: 4, marginBottom: 24}}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: s <= step ? 'var(--ink)' : 'var(--line)',
                transition: 'background 300ms cubic-bezier(0.16,1,0.3,1)',
              }}
            />
          ))}
        </div>

        <form className="auth-form" onSubmit={next}>
          {step === 1 && (
            <>
              <div className="row-fields">
                <div className="field">
                  <label>Nombre</label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    required
                    placeholder="Mariana"
                  />
                </div>
                <div className="field">
                  <label>Apellido</label>
                  <input
                    className="input"
                    value={form.lastName}
                    onChange={(e) => setField('lastName', e.target.value)}
                    required
                    placeholder="Ruiz"
                  />
                </div>
              </div>
              <div className="field">
                <label>Correo corporativo</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  required
                  placeholder="mariana@empresa.mx"
                />
                <span className="help-msg">
                  Usa el correo de la empresa para acelerar la aprobación.
                </span>
              </div>
              <div className="field">
                <label>Teléfono</label>
                <input
                  className="input"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="55 1234 5678"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="field">
                <label>Empresa</label>
                <input
                  className="input"
                  value={form.company}
                  onChange={(e) => setField('company', e.target.value)}
                  required
                  placeholder="Acme Corp"
                />
              </div>
              <div className="field">
                <label>Tu rol</label>
                <select
                  className="input"
                  value={form.role}
                  onChange={(e) => setField('role', e.target.value)}
                  required
                >
                  <option value="">Selecciona…</option>
                  <option>Recursos Humanos</option>
                  <option>Marketing</option>
                  <option>Compras</option>
                  <option>Comunicación interna</option>
                  <option>Agencia / Cliente externo</option>
                  <option>Otro</option>
                </select>
              </div>
              <div className="field">
                <label>RFC (opcional)</label>
                <input
                  className="input"
                  value={form.rfc}
                  onChange={(e) => setField('rfc', e.target.value)}
                  placeholder="ACM010203XXX"
                />
                <span className="help-msg">
                  Si lo proporcionas ahora aceleramos la apertura de crédito.
                </span>
              </div>
              <div className="field">
                <label>Volumen mensual estimado</label>
                <select
                  className="input"
                  value={form.volume}
                  onChange={(e) => setField('volume', e.target.value)}
                  required
                >
                  <option value="">Selecciona…</option>
                  <option>Menos de $50,000 MXN</option>
                  <option>$50,000 – $200,000 MXN</option>
                  <option>$200,000 – $500,000 MXN</option>
                  <option>Más de $500,000 MXN</option>
                </select>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="field">
                <label>¿Qué tipo de cuenta necesitas?</label>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8}}>
                  {[
                    {k: 'buyer', icon: 'cart', t: 'Comprador', d: 'Compra directa con precios autorizados, sin esperar cotización.'},
                    {k: 'quoter', icon: 'quote', t: 'Cotizador', d: 'Arma lista de productos y solicita propuesta personalizada.'},
                  ].map((opt) => (
                    <button
                      key={opt.k}
                      type="button"
                      onClick={() => setField('accountType', opt.k)}
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        border: `1.5px solid ${
                          form.accountType === opt.k ? 'var(--ink)' : 'var(--line)'
                        }`,
                        background: 'var(--bg-elev)',
                        textAlign: 'left',
                        transition: 'all 220ms cubic-bezier(0.16,1,0.3,1)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 8,
                        }}
                      >
                        <Icon name={opt.icon} size={20} />
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            border: `1.5px solid ${
                              form.accountType === opt.k ? 'var(--ink)' : 'var(--line-strong)'
                            }`,
                            background: form.accountType === opt.k ? 'var(--ink)' : 'transparent',
                            display: 'grid',
                            placeItems: 'center',
                            color: 'var(--bg-elev)',
                          }}
                        >
                          {form.accountType === opt.k && <Icon name="check" size={10} />}
                        </div>
                      </div>
                      <div style={{fontWeight: 600, fontSize: 14, marginBottom: 4}}>{opt.t}</div>
                      <div style={{fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4}}>{opt.d}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>¿Qué buscas? (opcional)</label>
                <textarea
                  className="input"
                  rows="3"
                  value={form.needs}
                  onChange={(e) => setField('needs', e.target.value)}
                  placeholder="Ej: kit de bienvenida para 200 colaboradores, ago/2026"
                  style={{resize: 'vertical', fontFamily: 'inherit'}}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'start',
                  gap: 10,
                  fontSize: 13,
                  color: 'var(--ink-3)',
                  lineHeight: 1.5,
                  marginTop: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.terms}
                  onChange={(e) => setField('terms', e.target.checked)}
                  required
                  style={{marginTop: 3}}
                />
                <span>
                  Acepto el Aviso de privacidad y los Términos de uso de Generando Ideas.
                </span>
              </label>
            </>
          )}

          <div style={{display: 'flex', gap: 10, marginTop: 16}}>
            {step > 1 && (
              <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
                Atrás
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              className="grow"
              iconRight={step === 3 ? 'check' : 'arrow_right'}
              style={{flex: 1, justifyContent: 'center'}}
            >
              {step === 3 ? 'Crear cuenta' : 'Continuar'}
            </Button>
          </div>
        </form>

        <div style={{marginTop: 32, fontSize: 13, color: 'var(--ink-3)'}}>
          ¿Ya tienes cuenta?{' '}
          <a href="/login" style={{color: 'var(--ink)', fontWeight: 600, textDecoration: 'underline'}}>
            Inicia sesión
          </a>
        </div>
      </div>

      <aside className="auth-side">
        <div style={{position: 'relative'}}>
          <div className="eyebrow" style={{color: 'var(--accent)'}}>
            // Únete
          </div>
          <h2>
            Empieza<br />
            <em>gratis</em><br />
            en 2 minutos.
          </h2>
        </div>
        <div className="auth-perks">
          {[
            'Sin costo de apertura ni mensualidad',
            'Catálogo completo con precios visibles',
            'Asesor asignado en 24 hrs',
            'Línea de crédito disponible*',
            'Soporte humano por WhatsApp',
          ].map((p) => (
            <div key={p} className="p">
              <Icon name="check" size={16} />
              {p}
            </div>
          ))}
        </div>
        <div style={{fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(244,242,236,0.5)', marginTop: 24}}>
          * SUJETA A APROBACIÓN COMERCIAL
        </div>
      </aside>
    </div>
  );
}
