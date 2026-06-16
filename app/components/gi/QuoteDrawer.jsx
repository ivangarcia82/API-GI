/* Generando Ideas — quote drawer (cart-style).
   The single surface for the B2B quote: add multiple products, adjust qty,
   add notes, and submit. Controlled by AppContext (quoteDrawerOpen). */
import {useEffect, useState} from 'react';
import {useFetcher, useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button, PH} from '~/components/gi/ui';
import {useApp, useToast} from '~/lib/AppContext';
import {formatPrice} from '~/lib/gi';
import {resolveSurfaceKey} from '~/lib/decoration/engine.js';

/** True when an item's material had to fall back to a priciest-group estimate. */
function usesFallbackMaterial(item) {
  if (!item.technique || item.technique === 'Sin decorado') return false;
  return resolveSurfaceKey(item.technique, item.surface || '').fallback;
}

export function QuoteDrawer() {
  const {
    hydrated,
    isLoggedIn,
    quote,
    quoteDrawerOpen,
    closeQuoteDrawer,
    updateQuoteQty,
    removeFromQuote,
    clearQuote,
  } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const submitFetcher = useFetcher();
  const [result, setResult] = useState(null);
  const [notes, setNotes] = useState('');
  const [deadline, setDeadline] = useState('');
  const submitting = submitFetcher.state !== 'idle';

  // Lock the page scroll behind the drawer while it's open.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.style.overflow = quoteDrawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [quoteDrawerOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!quoteDrawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeQuoteDrawer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [quoteDrawerOpen, closeQuoteDrawer]);

  // Reset the post-submit success view once the drawer is dismissed.
  useEffect(() => {
    if (!quoteDrawerOpen) {
      setResult(null);
      setNotes('');
      setDeadline('');
    }
  }, [quoteDrawerOpen]);

  // Reconcile the submit response.
  useEffect(() => {
    const data = submitFetcher.data;
    if (submitFetcher.state === 'idle' && data) {
      if (data.error) {
        toast(data.error, {icon: 'alert'});
        return;
      }
      if (data.folio && !result) {
        setResult(data);
        toast('Cotización enviada · respuesta en menos de 24h', {icon: 'check', accent: true});
        clearQuote();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitFetcher.state, submitFetcher.data]);

  const subtotal = quote.reduce((s, i) => s + (i.effectiveUnitPrice || 0) * i.qty, 0);
  const estTotal = subtotal * 1.16;
  const totalPieces = quote.reduce((n, i) => n + i.qty, 0);

  const submit = () => {
    submitFetcher.submit(
      {notes, deadline},
      {method: 'POST', action: '/api/quote/submit', encType: 'application/x-www-form-urlencoded'},
    );
  };

  const goAndClose = (to) => {
    closeQuoteDrawer();
    navigate(to);
  };

  let body;
  if (!hydrated) {
    body = <div className="qd-body" />;
  } else if (!isLoggedIn) {
    body = (
      <div className="qd-message">
        <Icon name="quote" size={32} className="muted-2" />
        <h3>Inicia sesión para cotizar</h3>
        <p>Arma tu lista y envíala como solicitud cuando estés listo.</p>
        <div style={{display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap'}}>
          <Button variant="accent" iconRight="arrow_right" onClick={() => goAndClose('/login')}>
            Iniciar sesión
          </Button>
          <Button variant="ghost" onClick={() => goAndClose('/catalogo')}>
            Explorar catálogo
          </Button>
        </div>
      </div>
    );
  } else if (result) {
    body = (
      <div className="qd-message">
        <div className="qd-success-check">
          <Icon name="check" size={28} strokeWidth={2.5} />
        </div>
        <h3>Cotización enviada</h3>
        <p>
          Tu solicitud llegó a nuestro equipo comercial. Recibirás una propuesta en menos
          de <strong>24 horas hábiles</strong>.
        </p>
        <p style={{fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)'}}>
          Folio · {result.folio}
        </p>
        {result.invoiceUrl && (
          <p>
            <a href={result.invoiceUrl} target="_blank" rel="noreferrer">
              Ver / pagar cotización
            </a>
          </p>
        )}
        <div style={{display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap'}}>
          <Button variant="primary" iconRight="arrow_right" onClick={() => goAndClose('/account/cotizaciones')}>
            Ver mis cotizaciones
          </Button>
          <Button variant="ghost" onClick={() => goAndClose('/catalogo')}>
            Seguir explorando
          </Button>
        </div>
      </div>
    );
  } else if (quote.length === 0) {
    body = (
      <div className="qd-message">
        <Icon name="quote" size={32} className="muted-2" />
        <h3>Tu cotización está vacía</h3>
        <p>Añade productos desde el catálogo y envíalos como solicitud.</p>
        <Button variant="accent" iconRight="arrow_right" onClick={() => goAndClose('/catalogo')}>
          Explorar catálogo
        </Button>
      </div>
    );
  } else {
    body = (
      <>
        <div className="qd-body">
          {quote.map((item) => (
            <div key={item.id} className="qd-item">
              <PH src={item.image} alt={item.title} />
              <div className="qd-item-info">
                <div className="cart-item-meta">{item.sku}</div>
                <div className="qd-item-name">{item.title}</div>
                <div className="qd-item-tags">
                  {item.technique && item.technique !== 'Sin decorado' && (
                    <span className="tag">
                      {item.technique}
                      {item.size ? ` · ${item.size}` : ''}
                    </span>
                  )}
                  {item.options?.map((o) => (
                    <span key={o.name} className="tag">
                      {o.name}: {o.value}
                    </span>
                  ))}
                </div>
                {usesFallbackMaterial(item) && (
                  <div className="qd-item-note">
                    <Icon name="bolt" size={11} /> Material estimado · el asesor lo confirma
                  </div>
                )}
                <div className="qd-item-row">
                  <div className="pdp-qty" style={{borderRadius: 999}}>
                    <button onClick={() => updateQuoteQty(item.id, Math.max(1, item.qty - 1))} aria-label="Disminuir cantidad">
                      <Icon name="minus" size={12} />
                    </button>
                    <input
                      value={item.qty}
                      onChange={(e) => updateQuoteQty(item.id, Math.max(1, +e.target.value || 1))}
                    />
                    <button onClick={() => updateQuoteQty(item.id, item.qty + 1)} aria-label="Aumentar cantidad">
                      <Icon name="plus" size={12} />
                    </button>
                  </div>
                  <span className="qd-item-price">
                    {formatPrice((item.effectiveUnitPrice || 0) * item.qty)}
                  </span>
                  <button
                    className="qd-remove"
                    aria-label="Quitar producto"
                    onClick={() => {
                      removeFromQuote(item.id);
                      toast('Producto removido');
                    }}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="field" style={{marginTop: 8}}>
            <label htmlFor="qd-deadline">Fecha objetivo</label>
            <input
              id="qd-deadline"
              className="input"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="qd-notes">Notas para el asesor</label>
            <textarea
              id="qd-notes"
              className="input"
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: necesito muestras antes de aprobar, requiero factura PDF…"
              style={{resize: 'vertical', fontFamily: 'inherit'}}
            />
          </div>

          <button
            className="qd-clear"
            onClick={() => {
              clearQuote();
              toast('Lista vaciada');
            }}
          >
            <Icon name="trash" size={12} /> Vaciar lista
          </button>
        </div>

        <div className="qd-foot">
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
          <Button
            variant="accent"
            size="lg"
            iconRight="arrow_right"
            disabled={submitting}
            style={{width: '100%', justifyContent: 'center', marginTop: 12}}
            onClick={submit}
          >
            {submitting ? 'Enviando…' : 'Enviar solicitud'}
          </Button>
          <p className="qd-foot-note">
            Precios estimados · sin compromiso de compra. Respuesta &lt; 24h hábiles.
          </p>
        </div>
      </>
    );
  }

  return (
    <div className={`qd-overlay ${quoteDrawerOpen ? 'open' : ''}`} aria-hidden={!quoteDrawerOpen}>
      <button
        type="button"
        className="qd-scrim"
        aria-label="Cerrar cotización"
        tabIndex={quoteDrawerOpen ? 0 : -1}
        onClick={closeQuoteDrawer}
      />
      <aside className="qd-panel" role="dialog" aria-modal="true" aria-label="Tu cotización">
        <header className="qd-head">
          <div>
            <div className="eyebrow">// Cotización</div>
            <h2 className="qd-title">
              Tu cotización
              {hydrated && isLoggedIn && quote.length > 0 && !result
                ? ` · ${quote.length} ${quote.length === 1 ? 'producto' : 'productos'}`
                : ''}
            </h2>
          </div>
          <button className="qd-close" onClick={closeQuoteDrawer} aria-label="Cerrar">
            <Icon name="x" size={18} />
          </button>
        </header>
        {body}
      </aside>
    </div>
  );
}
