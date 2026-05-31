/* ============================================================
   CART SCREEN — Para clientes compradores
   ============================================================ */

function CartScreen() {
  const { cart, updateCartQty, removeFromCart, clearCart, auth } = useApp();
  const { navigate } = useRouter();
  const toast = useToast();
  const { PRODUCTS, COLORS } = window.GI_DATA;

  if (!auth) {
    return <GatedScreen title="Carrito" message="Inicia sesión para ver tu carrito de compra." />;
  }
  if (auth.role !== "buyer") {
    return (
      <div className="container" style={{ padding: "60px 0 80px" }} data-screen-label="07 Cart (gated for quoter)">
        <div className="empty">
          <Icon name="cart" size={32} className="muted-2" />
          <h3>Tu cuenta es de tipo cotizador</h3>
          <p>Para comprar directamente necesitas una cuenta de tipo comprador. Mientras tanto, puedes solicitar cotizaciones de cualquier producto.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <Button variant="accent" iconRight="arrow_right" onClick={() => navigate("/cotizacion")}>Ir a mi cotización</Button>
            <Button variant="ghost" onClick={() => navigate("/contacto")}>Solicitar upgrade</Button>
          </div>
        </div>
      </div>
    );
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal > 5000 ? 0 : 350;
  const iva = subtotal * 0.16;
  const total = subtotal + shipping + iva;

  if (cart.length === 0) {
    return (
      <div className="container" style={{ padding: "60px 0 80px" }} data-screen-label="07 Cart empty">
        <div className="empty">
          <Icon name="cart" size={32} className="muted-2" />
          <h3>Tu carrito está vacío</h3>
          <p>Explora el catálogo y añade productos para iniciar tu compra.</p>
          <Button variant="accent" iconRight="arrow_right" onClick={() => navigate("/catalogo")}>Ver catálogo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" data-screen-label="07 Cart">
      <div style={{ padding: "32px 0 16px" }}>
        <div className="eyebrow">// Carrito · /carrito</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 700,
          fontSize: "clamp(36px, 5vw, 64px)", letterSpacing: "-0.03em",
          lineHeight: 1, margin: "12px 0 8px",
        }}>Tu carrito · {cart.length} {cart.length === 1 ? "producto" : "productos"}</h1>
        <p style={{ color: "var(--ink-3)", margin: 0 }}>
          Finaliza tu compra. El checkout es procesado de forma segura por Shopify.
        </p>
      </div>

      <div className="cart-page">
        <div className="cart-list stagger">
          {cart.map((item, idx) => {
            const p = PRODUCTS.find(x => x.id === item.id);
            const color = COLORS.find(c => c.id === item.color);
            return (
              <div key={`${item.id}-${item.color}-${idx}`} className="cart-item">
                <PH tint={item.tint} src={item.image} alt={item.name} />
                <div className="cart-item-info">
                  <div className="cart-item-meta">{item.sku}</div>
                  <div className="cart-item-name">{item.name}</div>
                  <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {color && (
                      <span style={{ fontSize: 12, color: "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 12, height: 12, borderRadius: "50%", background: color.hex, border: "1px solid rgba(20,17,10,0.1)" }}></span>
                        {color.name}
                      </span>
                    )}
                    {item.technique && <span className="tag">{item.technique}</span>}
                  </div>
                </div>
                <div className="cart-item-controls">
                  <div className="pdp-qty" style={{ borderRadius: 999 }}>
                    <button onClick={() => updateCartQty(item.id, item.color, Math.max(p?.moq || 1, item.qty - 25))}>
                      <Icon name="minus" size={12} />
                    </button>
                    <input value={item.qty} onChange={(e) => updateCartQty(item.id, item.color, Math.max(p?.moq || 1, +e.target.value || 1))} />
                    <button onClick={() => updateCartQty(item.id, item.color, item.qty + 25)}>
                      <Icon name="plus" size={12} />
                    </button>
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, letterSpacing: "-0.01em" }}>
                    {window.GI_FORMAT_PRICE(item.price * item.qty)}
                  </div>
                  <button onClick={() => { removeFromCart(item.id, item.color); toast("Producto eliminado", { icon: "trash" }); }}
                    style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Icon name="trash" size={12} /> Quitar
                  </button>
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <Button variant="ghost" icon="arrow_right" onClick={() => navigate("/catalogo")} style={{ flexDirection: "row-reverse" }}>
              Seguir comprando
            </Button>
            <Button variant="ghost" icon="trash" onClick={() => { clearCart(); toast("Carrito vaciado"); }}>
              Vaciar carrito
            </Button>
          </div>
        </div>

        <aside className="cart-summary">
          <h3>Resumen</h3>
          <div className="cart-summary-line">
            <span>Subtotal</span>
            <span className="mono">{window.GI_FORMAT_PRICE(subtotal)}</span>
          </div>
          <div className="cart-summary-line">
            <span>Personalización</span>
            <span className="mono" style={{ color: "var(--ok)" }}>Incluida</span>
          </div>
          <div className="cart-summary-line">
            <span>Envío {subtotal > 5000 && <span style={{ color: "var(--ok)" }}>· gratis</span>}</span>
            <span className="mono">{shipping === 0 ? "$ 0" : window.GI_FORMAT_PRICE(shipping)}</span>
          </div>
          <div className="cart-summary-line">
            <span>IVA (16%)</span>
            <span className="mono">{window.GI_FORMAT_PRICE(iva)}</span>
          </div>
          <div className="cart-summary-line total">
            <span>Total</span>
            <span className="mono">{window.GI_FORMAT_PRICE(total)}</span>
          </div>

          {subtotal < 5000 && (
            <div style={{ padding: 12, background: "var(--accent-soft)", borderRadius: 10, fontSize: 12, color: "var(--warn)", marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
              <Icon name="truck" size={14} />
              <span>Agrega {window.GI_FORMAT_PRICE(5000 - subtotal)} más para envío gratis.</span>
            </div>
          )}

          <Button variant="primary" size="lg" iconRight="arrow_right"
            style={{ width: "100%", justifyContent: "center", marginTop: 20 }}
            onClick={() => toast("Redirigiendo a Shopify Checkout…", { icon: "bolt", accent: true })}>
            Ir a checkout
          </Button>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20, fontSize: 12, color: "var(--ink-3)" }}>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Icon name="shield" size={14} className="muted-2" />
              Pago seguro vía Shopify Payments
            </span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Icon name="truck" size={14} className="muted-2" />
              Producción 8–15 días hábiles
            </span>
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Icon name="receipt" size={14} className="muted-2" />
              Facturación CFDI 4.0 automática
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function GatedScreen({ title, message }) {
  const { navigate } = useRouter();
  return (
    <div className="container" style={{ padding: "80px 0" }} data-screen-label="Gated">
      <div className="empty">
        <Icon name="eye_off" size={32} className="muted-2" />
        <h3>{title}</h3>
        <p>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <Button variant="accent" iconRight="arrow_right" onClick={() => navigate("/login")}>Iniciar sesión</Button>
          <Button variant="ghost" onClick={() => navigate("/registro")}>Crear cuenta</Button>
        </div>
      </div>
    </div>
  );
}

window.CartScreen = CartScreen;
window.GatedScreen = GatedScreen;
