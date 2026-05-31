/* ============================================================
   HOME SECTIONS — Spotlight, Lookbook, Stats band, Customizer
   ============================================================ */

const { useState: useStateS, useEffect: useEffectS, useRef: useRefS } = React;

/* -------- useParallax: translate based on scroll position -------- */
function useParallax(strength = 0.15) {
  const ref = useRefS(null);
  const [offset, setOffset] = useStateS(0);
  useEffectS(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          const center = rect.top + rect.height / 2;
          const dist = center - window.innerHeight / 2;
          setOffset(-dist * strength);
        }
        raf = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [strength]);
  return [ref, offset];
}

/* ============================================================
   PRODUCT SPOTLIGHT — featured product, parallax + reveal
   ============================================================ */
function ProductSpotlight() {
  const { PRODUCTS } = window.GI_DATA;
  const { navigate } = useRouter();
  const { auth, addToCart, addToQuote } = useApp();
  const toast = useToast();
  const product = PRODUCTS.find((p) => p.id === "GI-2011") || PRODUCTS[10]; // Audífonos
  const [imgRef, imgOffset] = useParallax(0.08);
  const [ref, inView] = window.useInView();

  const canBuy = auth?.role === "buyer";

  const handle = () => {
    if (!auth) { navigate("/login"); return; }
    if (canBuy) { addToCart(product, product.moq, { color: product.colors[0] }); toast(`${product.name} agregado al carrito`, { icon: "cart", accent: true }); }
    else { addToQuote(product, product.moq, { color: product.colors[0] }); toast(`${product.name} en tu cotización`, { icon: "quote", accent: true }); }
  };

  const specs = [
    { l: "Autonomía", v: "32 horas" },
    { l: "Conexión", v: "Bluetooth 5.3" },
    { l: "Cancelación", v: "Híbrida ANC" },
    { l: "Personalización", v: "Láser en estuche" },
  ];

  return (
    <section className="spotlight" ref={ref}>
      <div className="spotlight-bg-text" aria-hidden="true">DESTACADO</div>
      <div className="container spotlight-inner">
        <div className="spotlight-media">
          <div className="spotlight-img-wrap">
            <img ref={imgRef} src={(product.images && product.images[0]) || product.image} alt={product.name}
              style={{ transform: `translateY(${imgOffset}px) scale(1.12)` }} />
          </div>
          {/* Floating spec chips */}
          <div className="spotlight-chip sc-1" style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(20px)" }}>
            <span className="sc-star"><Icon name="star_fill" size={12} /></span>
            <div>
              <div className="sc-v">{product.rating.toFixed(1)} · {product.reviews}</div>
              <div className="sc-l">Reseñas verificadas</div>
            </div>
          </div>
          <div className="spotlight-chip sc-2" style={{ opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(20px)", transitionDelay: "150ms" }}>
            <span className="sc-bolt"><Icon name="bolt" size={12} /></span>
            <div>
              <div className="sc-v">+2,400 vendidos</div>
              <div className="sc-l">Últimos 90 días</div>
            </div>
          </div>
        </div>

        <div className="spotlight-info">
          <div className="eyebrow" style={{ color: "var(--accent-deep)" }}>// Producto destacado del mes</div>
          <h2 className="spotlight-title">{product.name}</h2>
          <p className="spotlight-desc">
            El obsequio tecnológico más solicitado por equipos de marketing. Sonido premium,
            cancelación de ruido y un estuche perfecto para grabar tu logo en láser.
          </p>

          <div className="spotlight-specs">
            {specs.map((s, i) => (
              <div key={s.l} className="spotlight-spec" style={{
                opacity: inView ? 1 : 0,
                transform: inView ? "translateX(0)" : "translateX(-12px)",
                transition: `all 500ms cubic-bezier(0.16,1,0.3,1) ${i * 90 + 200}ms`,
              }}>
                <span className="ss-l">{s.l}</span>
                <span className="ss-v">{s.v}</span>
              </div>
            ))}
          </div>

          <div className="spotlight-foot">
            {auth ? (
              <div className="spotlight-price">
                <span className="sp-from">Desde</span>
                <span className="sp-v">{window.GI_FORMAT_PRICE(product.price)}</span>
                <span className="sp-unit">/ pieza</span>
              </div>
            ) : (
              <div className="spotlight-price"><span className="sp-from">Precio para clientes</span></div>
            )}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="accent" size="lg" icon={canBuy ? "cart" : "quote"} onClick={handle}>
                {!auth ? "Ver detalles" : canBuy ? "Añadir al carrito" : "Cotizar ahora"}
              </Button>
              <Button variant="ghost" size="lg" iconRight="arrow_right" onClick={() => navigate(`/producto/${product.id}`)}>
                Ver producto
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   LOOKBOOK — editorial masonry gallery
   ============================================================ */
function LookbookGrid({ limit }) {
  const { LOOKBOOK } = window.GI_DATA;
  const { navigate } = useRouter();
  const items = limit ? LOOKBOOK.slice(0, limit) : LOOKBOOK;
  return (
    <div className="lookbook-grid">
      {items.map((lb, i) => (
        <LookbookCard key={lb.id} lb={lb} index={i} onClick={() => navigate("/catalogo")} />
      ))}
    </div>
  );
}

function LookbookCard({ lb, index, onClick }) {
  const [ref, inView] = window.useInView();
  return (
    <div
      ref={ref}
      className={`lookbook-card lb-${lb.span}`}
      onClick={onClick}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0) scale(1)" : "translateY(30px) scale(0.98)",
        transition: `opacity 700ms cubic-bezier(0.16,1,0.3,1) ${index * 70}ms, transform 700ms cubic-bezier(0.16,1,0.3,1) ${index * 70}ms`,
      }}
    >
      <div className="lookbook-img">
        <img src={lb.image} alt={lb.title} loading="lazy" />
      </div>
      <div className="lookbook-overlay" />
      <div className="lookbook-top">
        <span className="lookbook-tag">{lb.tag}</span>
        <span className="lookbook-count">{lb.products} productos</span>
      </div>
      <div className="lookbook-bottom">
        <div className="lookbook-season">{lb.season}</div>
        <h3 className="lookbook-name">{lb.title}</h3>
        <div className="lookbook-cta">
          Ver edición <Icon name="arrow_right" size={14} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   STATS BAND — animated counters on dark
   ============================================================ */
function StatsBand() {
  const [ref, inView] = window.useInView();
  const stats = [
    { to: 1847, label: "Productos en catálogo", suffix: "" },
    { to: 9, label: "Colecciones curadas", suffix: "" },
    { to: 420, label: "Clientes corporativos", suffix: "+" },
    { to: 98, label: "Satisfacción de entrega", suffix: "%" },
  ];
  return (
    <section className="stats-band" ref={ref}>
      <div className="stats-band-glow" />
      <div className="container stats-band-inner">
        {stats.map((s, i) => (
          <div key={i} className="stats-band-item" style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(16px)",
            transition: `all 600ms cubic-bezier(0.16,1,0.3,1) ${i * 100}ms`,
          }}>
            <div className="stats-band-n">
              {inView ? <CountUp to={s.to} suffix={s.suffix} /> : `0${s.suffix}`}
            </div>
            <div className="stats-band-l">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   CUSTOMIZER — interactive "marca tu producto"
   ============================================================ */
function CustomizerSection() {
  const { PRODUCTS } = window.GI_DATA;
  const { navigate } = useRouter();
  const product = PRODUCTS.find((p) => p.id === "GI-2001") || PRODUCTS[0]; // Termo
  const [color, setColor] = useStateS("#14110a");
  const [tech, setTech] = useStateS("Grabado láser");
  const [logoPos, setLogoPos] = useStateS("center");
  const [ref, inView] = window.useInView();

  const bgColors = [
    { hex: "#14110a", name: "Negro" },
    { hex: "#f5b800", name: "Ámbar" },
    { hex: "#1e4d8a", name: "Azul" },
    { hex: "#5d6a3a", name: "Olivo" },
    { hex: "#b3261e", name: "Rojo" },
  ];

  return (
    <section className="customizer" ref={ref}>
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">// Personalización · interactivo</div>
            <h2>Marca tu producto en vivo.</h2>
          </div>
          <p>Elige color, técnica y posición del logo. Así de fácil es configurar antes de cotizar.</p>
        </div>

        <div className="customizer-stage">
          {/* Preview */}
          <div className="customizer-preview" style={{ background: `linear-gradient(160deg, ${color}14, ${color}06)` }}>
            <div className="customizer-canvas" style={{ "--prod-color": color }}>
              <div className="customizer-prod" style={{ transform: inView ? "scale(1)" : "scale(0.9)", transition: "transform 700ms cubic-bezier(0.16,1,0.3,1)" }}>
                <img src={product.image} alt={product.name} />
                {/* Logo mark overlay */}
                <div className={`customizer-logo logo-${logoPos}`}>
                  <div className="customizer-logo-mark" style={{ borderColor: tech === "Grabado láser" ? "rgba(255,255,255,0.6)" : color }}>
                    <span style={{ color: tech === "Grabado láser" ? "rgba(255,255,255,0.85)" : "#fff", mixBlendMode: tech === "Sublimación" ? "normal" : "overlay" }}>TU LOGO</span>
                  </div>
                </div>
              </div>
              <div className="customizer-tech-badge">{tech}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="customizer-controls">
            <div className="customizer-prod-name">
              <div className="cpn-sku">{product.id}</div>
              <div className="cpn-name">{product.name}</div>
            </div>

            <div className="customizer-group">
              <label>Color del producto</label>
              <div className="customizer-swatches">
                {bgColors.map((c) => (
                  <button key={c.hex} className={`cz-swatch ${color === c.hex ? "active" : ""}`}
                    style={{ background: c.hex }} onClick={() => setColor(c.hex)} title={c.name} aria-label={c.name} />
                ))}
              </div>
            </div>

            <div className="customizer-group">
              <label>Técnica de marcado</label>
              <div className="customizer-segmented">
                {["Grabado láser", "Serigrafía", "Sublimación"].map((t) => (
                  <button key={t} className={tech === t ? "active" : ""} onClick={() => setTech(t)}>{t}</button>
                ))}
              </div>
            </div>

            <div className="customizer-group">
              <label>Posición del logo</label>
              <div className="customizer-segmented">
                {[{ k: "left", l: "Izquierda" }, { k: "center", l: "Centro" }, { k: "right", l: "Derecha" }].map((p) => (
                  <button key={p.k} className={logoPos === p.k ? "active" : ""} onClick={() => setLogoPos(p.k)}>{p.l}</button>
                ))}
              </div>
            </div>

            <div className="customizer-actions">
              <Button variant="primary" size="lg" iconRight="arrow_right" onClick={() => navigate(`/producto/${product.id}`)}>
                Configurar y cotizar
              </Button>
              <span className="customizer-hint">
                <Icon name="sparkle" size={13} /> Vista previa ilustrativa
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

window.ProductSpotlight = ProductSpotlight;
window.LookbookGrid = LookbookGrid;
window.StatsBand = StatsBand;
window.CustomizerSection = CustomizerSection;
window.useParallax = useParallax;
