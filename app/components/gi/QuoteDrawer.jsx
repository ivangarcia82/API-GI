/* Generando Ideas — quote drawer (cart-style).
   The single surface for the B2B quote: add multiple products, adjust qty,
   add notes, and submit. Controlled by AppContext (quoteDrawerOpen). */
import {useEffect, useRef, useState} from 'react';
import {useFetcher, useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button, PH} from '~/components/gi/ui';
import {useApp, useToast} from '~/lib/AppContext';
import {formatPrice} from '~/lib/gi';

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
  const panelRef = useRef(null);
  const lastFocusedRef = useRef(null);
  const [result, setResult] = useState(null);
  const [notes, setNotes] = useState('');
  const [deadline, setDeadline] = useState('');
  const [confirmandoVaciar, setConfirmandoVaciar] = useState(false);
  const submitting = submitFetcher.state !== 'idle';
  // Una fecha objetivo en el pasado no es un objetivo. El input la rechaza en
  // el propio calendario en vez de dejar que llegue al asesor.
  const hoy = new Date().toISOString().slice(0, 10);

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

  // Focus management: move focus into the panel on open, trap Tab within it,
  // and restore focus to the trigger on close.
  useEffect(() => {
    if (!quoteDrawerOpen) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    lastFocusedRef.current = document.activeElement;
    const getFocusables = () =>
      Array.from(
        panel.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    getFocusables()[0]?.focus();

    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const items = getFocusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener('keydown', onKey);
    return () => {
      panel.removeEventListener('keydown', onKey);
      lastFocusedRef.current?.focus?.();
    };
  }, [quoteDrawerOpen]);

  // Reset the post-submit success view once the drawer is dismissed.
  useEffect(() => {
    if (!quoteDrawerOpen) {
      setResult(null);
      setNotes('');
      setDeadline('');
      setConfirmandoVaciar(false);
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
        // The quote is already finalized server-side; clearing local state is
        // best-effort cleanup, so swallow any failure here.
        clearQuote().catch(() => {});
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

  // Quote mutations are optimistic + server-reconciled; surface any failure as a
  // toast (and AppContext rolls the optimistic change back) instead of letting
  // the rejection go unhandled.
  const handleQty = (id, q) =>
    updateQuoteQty(id, q).catch((e) =>
      toast(e?.message || 'No se pudo actualizar la cantidad', {icon: 'alert'}),
    );
  const handleRemove = (id) =>
    removeFromQuote(id)
      .then(() => toast('Producto removido'))
      .catch((e) => toast(e?.message || 'No se pudo quitar el producto', {icon: 'alert'}));
  /* Vaciar borra la cotización entera y no hay deshacer, así que pide
     confirmación en el propio sitio en vez de abrir un modal encima de un
     drawer (que además rompería la trampa de foco). */
  const handleClear = () => {
    setConfirmandoVaciar(false);
    return clearQuote()
      .then(() => toast('Lista vaciada'))
      .catch((e) => toast(e?.message || 'No se pudo vaciar la lista', {icon: 'alert'}));
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
                <div className="qd-item-row">
                  <div className="pdp-qty" style={{borderRadius: 999}}>
                    <button onClick={() => handleQty(item.id, Math.max(1, item.qty - 1))} aria-label="Disminuir cantidad">
                      <Icon name="minus" size={12} />
                    </button>
                    <input
                      value={item.qty}
                      inputMode="numeric"
                      aria-label="Cantidad"
                      onChange={(e) =>
                        handleQty(
                          item.id,
                          Math.min(100000, Math.max(1, +e.target.value || 1)),
                        )
                      }
                    />
                    <button onClick={() => handleQty(item.id, item.qty + 1)} aria-label="Aumentar cantidad">
                      <Icon name="plus" size={12} />
                    </button>
                  </div>
                  <span className="qd-item-price">
                    {formatPrice((item.effectiveUnitPrice || 0) * item.qty)}
                  </span>
                  <button
                    className="qd-remove"
                    aria-label="Quitar producto"
                    onClick={() => handleRemove(item.id)}
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
              min={hoy}
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

          {confirmandoVaciar ? (
            <div className="qd-confirm" role="group" aria-label="Confirmar vaciar la lista">
              <span>
                ¿Vaciar los {quote.length}{' '}
                {quote.length === 1 ? 'producto' : 'productos'}? No se puede deshacer.
              </span>
              <div className="qd-confirm-actions">
                <button type="button" onClick={() => setConfirmandoVaciar(false)}>
                  Cancelar
                </button>
                <button type="button" className="qd-confirm-yes" onClick={handleClear}>
                  Sí, vaciar
                </button>
              </div>
            </div>
          ) : (
            <button className="qd-clear" onClick={() => setConfirmandoVaciar(true)}>
              <Icon name="trash" size={12} /> Vaciar lista
            </button>
          )}
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
        tabIndex={-1}
        onClick={closeQuoteDrawer}
      />
      <aside
        ref={panelRef}
        className="qd-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Tu cotización"
        {...(quoteDrawerOpen ? {} : {inert: ''})}
      >
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
