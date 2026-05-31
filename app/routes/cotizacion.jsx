import {useState} from 'react';
import {useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button, PH} from '~/components/gi/ui';
import {useApp, useToast} from '~/lib/AppContext';
import {formatPrice} from '~/lib/gi';

export const meta = () => [{title: 'Cotización · Generando Ideas'}];

function Gated({navigate}) {
  return (
    <div className="container" style={{padding: '80px 0'}}>
      <div className="empty">
        <Icon name="quote" size={32} className="muted-2" />
        <h3>Inicia sesión para cotizar</h3>
        <p>Arma tu lista de cotización y envíala como solicitud cuando estés listo.</p>
        <div style={{display: 'flex', gap: 8, justifyContent: 'center'}}>
          <Button variant="accent" iconRight="arrow_right" onClick={() => navigate('/login')}>
            Iniciar sesión
          </Button>
          <Button variant="ghost" onClick={() => navigate('/catalogo')}>
            Explorar catálogo
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Cotizacion() {
  const navigate = useNavigate();
  const toast = useToast();
  const {hydrated, isLoggedIn, quote, updateQuoteQty, removeFromQuote, clearQuote} = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notes, setNotes] = useState('');
  const [deadline, setDeadline] = useState('');

  if (!hydrated) {
    return <div className="container" style={{minHeight: '50vh'}} />;
  }
  if (!isLoggedIn) return <Gated navigate={navigate} />;

  const subtotal = quote.reduce((s, i) => s + (i.price || 0) * i.qty, 0);
  const estTotal = subtotal * 1.16;
  const totalPieces = quote.reduce((n, i) => n + i.qty, 0);

  const submit = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      toast('Cotización enviada · respuesta en menos de 24h', {icon: 'check', accent: true});
      clearQuote();
    }, 1400);
  };

  if (submitted) {
    return (
      <div className="container" style={{padding: '80px 0'}} data-screen-label="08 Quote submitted">
        <div className="empty" style={{background: 'var(--ok-soft)', borderColor: '#b8e0c8', borderStyle: 'solid'}}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--ok)',
              color: 'var(--bg-elev)',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 20px',
            }}
          >
            <Icon name="check" size={32} strokeWidth={2.5} />
          </div>
          <h3 style={{fontSize: 32, fontFamily: 'var(--font-display)'}}>Cotización enviada</h3>
          <p style={{fontSize: 16}}>
            Tu solicitud fue enviada a nuestro equipo comercial.<br />
            Recibirás propuesta personalizada en menos de <strong>24 horas hábiles</strong>.
          </p>
          <div style={{display: 'flex', gap: 8, justifyContent: 'center'}}>
            <Button variant="primary" iconRight="arrow_right" onClick={() => navigate('/account/cotizaciones')}>
              Ver mis cotizaciones
            </Button>
            <Button variant="ghost" onClick={() => navigate('/catalogo')}>
              Seguir explorando
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (quote.length === 0) {
    return (
      <div className="container" style={{padding: '60px 0 80px'}} data-screen-label="08 Quote empty">
        <div className="empty">
          <Icon name="quote" size={32} className="muted-2" />
          <h3>Tu lista de cotización está vacía</h3>
          <p>Añade productos al cotizador y envíalos como solicitud cuando estés listo.</p>
          <Button variant="accent" iconRight="arrow_right" onClick={() => navigate('/catalogo')}>
            Explorar catálogo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" data-screen-label="08 Quote">
      <div style={{padding: '32px 0 16px'}}>
        <div className="eyebrow">// Cotización · /cotizacion</div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(36px, 5vw, 64px)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            margin: '12px 0 8px',
          }}
        >
          Lista de cotización · {quote.length} {quote.length === 1 ? 'producto' : 'productos'}
        </h1>
        <p style={{color: 'var(--ink-3)', margin: 0}}>
          Revisa cantidades y agrega notas. Te respondemos en menos de 24 horas hábiles con
          propuesta personalizada.
        </p>
      </div>

      <div className="cart-page">
        <div className="cart-list stagger">
          {quote.map((item, idx) => (
            <div key={`${item.variantId}-${idx}`} className="cart-item">
              <PH src={item.image} alt={item.title} />
              <div className="cart-item-info">
                <div className="cart-item-meta">{item.sku}</div>
                <div className="cart-item-name">{item.title}</div>
                {item.options?.length > 0 && (
                  <div style={{display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap'}}>
                    {item.options.map((o) => (
                      <span key={o.name} className="tag">
                        {o.name}: {o.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="cart-item-controls">
                <div className="pdp-qty" style={{borderRadius: 999}}>
                  <button onClick={() => updateQuoteQty(item.variantId, Math.max(1, item.qty - 25))}>
                    <Icon name="minus" size={12} />
                  </button>
                  <input
                    value={item.qty}
                    onChange={(e) =>
                      updateQuoteQty(item.variantId, Math.max(1, +e.target.value || 1))
                    }
                  />
                  <button onClick={() => updateQuoteQty(item.variantId, item.qty + 25)}>
                    <Icon name="plus" size={12} />
                  </button>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Estimado · {formatPrice((item.price || 0) * item.qty)}
                </div>
                <button
                  onClick={() => {
                    removeFromQuote(item.variantId);
                    toast('Producto removido');
                  }}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--ink-4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Icon name="trash" size={12} /> Quitar
                </button>
              </div>
            </div>
          ))}

          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 8}}>
            <Button variant="ghost" iconRight="arrow_right" onClick={() => navigate('/catalogo')}>
              Añadir más productos
            </Button>
            <Button
              variant="ghost"
              icon="trash"
              onClick={() => {
                clearQuote();
                toast('Lista vaciada');
              }}
            >
              Vaciar lista
            </Button>
          </div>

          <div
            style={{
              marginTop: 32,
              padding: 24,
              background: 'var(--bg-elev)',
              border: '1px solid var(--line)',
              borderRadius: 16,
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 18,
                margin: '0 0 16px',
                letterSpacing: '-0.01em',
              }}
            >
              Información adicional
            </h3>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16}}>
              <div className="field">
                <label>Fecha objetivo</label>
                <input
                  className="input"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Dirección de entrega</label>
                <select className="input">
                  <option>Oficinas CDMX · Polanco</option>
                  <option>Almacén Guadalajara</option>
                  <option>+ Agregar nueva dirección…</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Notas para el asesor</label>
              <textarea
                className="input"
                rows="4"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: necesito muestras físicas antes de aprobar, requiero factura PDF, presupuesto máximo…"
                style={{resize: 'vertical', fontFamily: 'inherit'}}
              />
            </div>
          </div>
        </div>

        <aside className="cart-summary">
          <h3>Resumen estimado</h3>
          <div className="cart-summary-line">
            <span>Productos</span>
            <span className="mono">{quote.length}</span>
          </div>
          <div className="cart-summary-line">
            <span>Piezas totales</span>
            <span className="mono">{totalPieces}</span>
          </div>
          <div className="cart-summary-line">
            <span>Subtotal estimado</span>
            <span className="mono">{formatPrice(subtotal)}</span>
          </div>
          <div className="cart-summary-line">
            <span>IVA estimado</span>
            <span className="mono">{formatPrice(estTotal - subtotal)}</span>
          </div>
          <div className="cart-summary-line total">
            <span>Total estimado</span>
            <span className="mono">{formatPrice(estTotal)}</span>
          </div>

          <div
            style={{
              padding: 12,
              background: 'var(--accent-soft)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--warn)',
              marginTop: 12,
              display: 'flex',
              gap: 8,
            }}
          >
            <Icon name="bolt" size={14} />
            <span>
              Los precios finales pueden variar según volumen, técnica de personalización y
              condiciones comerciales.
            </span>
          </div>

          <Button
            variant="accent"
            size="lg"
            iconRight="arrow_right"
            disabled={submitting}
            style={{width: '100%', justifyContent: 'center', marginTop: 20}}
            onClick={submit}
          >
            {submitting ? 'Enviando…' : 'Enviar solicitud'}
          </Button>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 20,
              fontSize: 12,
              color: 'var(--ink-3)',
            }}
          >
            <span style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <Icon name="bolt" size={14} className="muted-2" /> Respuesta &lt; 24h hábiles
            </span>
            <span style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <Icon name="user" size={14} className="muted-2" /> Asesor humano asignado
            </span>
            <span style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <Icon name="receipt" size={14} className="muted-2" /> Sin compromiso de compra
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
