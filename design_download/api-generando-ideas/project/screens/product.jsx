/* ============================================================
   PRODUCT DETAIL SCREEN
   ============================================================ */

function ProductScreen({ productId }) {
  const { PRODUCTS, COLORS } = window.GI_DATA;
  const { auth, favs, toggleFav, addToCart, addToQuote } = useApp();
  const { navigate } = useRouter();
  const toast = useToast();

  const product = PRODUCTS.find((p) => p.id === productId) || PRODUCTS[0];

  const [qty, setQty] = useState(product.moq);
  const [color, setColor] = useState(product.colors[0]);
  const [technique, setTechnique] = useState(product.techniques[0]);
  const [activeImg, setActiveImg] = useState(0);
  const [hasFile, setHasFile] = useState(false);
  const [tab, setTab] = useState("desc");
  const [tier, setTier] = useState(1);

  const isFav = favs.includes(product.id);
  const canBuy = auth?.role === "buyer";
  const isLoggedIn = !!auth;

  const currentTier = product.tiers[tier];
  const pricePerUnit = currentTier.price;
  const totalPrice = pricePerUnit * qty;

  const related = PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  const handleAddToCart = () => {
    if (!isLoggedIn) { navigate("/login"); return; }
    addToCart(product, qty, { color, technique });
    toast(`${qty} pz de ${product.name} en tu carrito`, { icon: "cart", accent: true });
  };
  const handleAddToQuote = () => {
    if (!isLoggedIn) { navigate("/login"); return; }
    addToQuote(product, qty, { color, technique });
    toast(`${product.name} en tu lista de cotización`, { icon: "quote", accent: true });
  };

  return (
    <div className="container" data-screen-label={`06 Product: ${product.name}`}>
      {/* Breadcrumbs */}
      <div style={{
        padding: "20px 0 16px",
        display: "flex", gap: 6, alignItems: "center",
        fontFamily: "var(--font-mono)", fontSize: 11,
        color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em",
      }}>
        <a href="#/catalogo" onClick={(e) => { e.preventDefault(); navigate("/catalogo"); }}>Catálogo</a>
        <Icon name="chevron_right" size={10} />
        <a href={`#/catalogo?cat=${product.category}`} onClick={(e) => { e.preventDefault(); navigate(`/catalogo?cat=${product.category}`); }}>
          {window.GI_DATA.CATEGORIES.find(c => c.id === product.category)?.name}
        </a>
        <Icon name="chevron_right" size={10} />
        <span style={{ color: "var(--ink-2)" }}>{product.name}</span>
      </div>

      <div className="pdp">
        {/* GALLERY */}
        <div className="pdp-gallery">
          <div className="pdp-main">
            <PH tint={product.tint} src={(product.images && product.images[activeImg]) || product.image} alt={product.name} aspect="ph-square" />
          </div>
          <div className="pdp-thumbs">
            {(product.images || [product.image, product.image, product.image, product.image, product.image]).slice(0, 5).map((src, i) => (
              <div key={i} className={`pdp-thumb ${activeImg === i ? "active" : ""}`} onClick={() => setActiveImg(i)}>
                <PH tint={product.tint} src={src} alt="" />
              </div>
            ))}
          </div>
        </div>

        {/* INFO */}
        <div className="pdp-info">
          <div className="pdp-meta">
            {product.new && <span className="tag tag-accent">Nuevo</span>}
            {product.bestseller && <span className="tag tag-ink">Bestseller</span>}
            <span className="tag tag-ok tag-dot">En stock</span>
            <span className="pdp-sku">{product.id}</span>
          </div>

          <h1 className="pdp-title">{product.name}</h1>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", gap: 1, color: "var(--accent-deep)" }}>
              {[0,1,2,3,4].map(s => <Icon key={s} name="star_fill" size={14} />)}
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)" }}>
              {product.rating.toFixed(1)} · {product.reviews} reseñas
            </span>
          </div>

          <p className="pdp-desc">{product.desc}</p>

          {/* PRICE */}
          {isLoggedIn ? (
            <div className="pdp-price-bar">
              <div>
                <div className="pdp-price-from">Desde · {currentTier.qty}+ pz</div>
                <div className="pdp-price">{window.GI_FORMAT_PRICE(pricePerUnit)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="pdp-price-from">Total · {qty} pz</div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, color: "var(--ink-2)", letterSpacing: "-0.01em" }}>
                  {window.GI_FORMAT_PRICE(totalPrice)}
                </div>
              </div>
            </div>
          ) : (
            <div className="pdp-gated">
              <Icon name="eye_off" size={20} className="muted-2" style={{ margin: "0 auto 8px" }} />
              <h3>Precios solo para clientes registrados</h3>
              <p>Crea tu cuenta gratuita para ver precios, cotizar y comprar.</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <Button variant="accent" iconRight="arrow_right" onClick={() => navigate("/registro")}>
                  Crear cuenta
                </Button>
                <Button variant="ghost" onClick={() => navigate("/login")}>Iniciar sesión</Button>
              </div>
            </div>
          )}

          {/* VOLUME TIERS */}
          {isLoggedIn && (
            <div className="pdp-section">
              <h3>Precio por volumen</h3>
              <div className="pdp-tiers">
                {product.tiers.map((t, i) => (
                  <button key={i} className={`pdp-tier ${tier === i ? "active" : ""}`} onClick={() => { setTier(i); setQty(t.qty); }}>
                    <span className="qty">{t.qty}+ pz</span>
                    <span className="pr">{window.GI_FORMAT_PRICE(t.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* COLOR */}
          <div className="pdp-section">
            <h3>Color · {COLORS.find(c => c.id === color)?.name}</h3>
            <div className="pdp-swatches">
              {product.colors.map((cid) => {
                const c = COLORS.find(x => x.id === cid);
                return (
                  <button key={cid} className={`pdp-swatch ${color === cid ? "active" : ""}`}
                    style={{ "--c": c?.hex }} onClick={() => setColor(cid)}
                    aria-label={c?.name} title={c?.name} />
                );
              })}
            </div>
          </div>

          {/* QUANTITY */}
          <div className="pdp-section">
            <h3>Cantidad · mínimo {product.moq} pz</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div className="pdp-qty">
                <button onClick={() => setQty(Math.max(product.moq, qty - 25))}>
                  <Icon name="minus" size={14} />
                </button>
                <input type="number" value={qty} onChange={(e) => setQty(Math.max(product.moq, +e.target.value || product.moq))} min={product.moq} />
                <button onClick={() => setQty(qty + 25)}>
                  <Icon name="plus" size={14} />
                </button>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-4)" }}>
                Saltos sugeridos de 25 piezas
              </span>
            </div>
          </div>

          {/* CUSTOMIZATION */}
          <div className="pdp-custom">
            <div className="pdp-custom-head">
              <h3>Personalización</h3>
              <span className="pdp-custom-tag">Incluida</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3)" }}>
              Sube tu logo (vector preferido) y selecciona técnica. Recibirás un dummy digital
              para aprobar antes de producción.
            </p>

            <div className={`pdp-upload ${hasFile ? "has-file" : ""}`} onClick={() => setHasFile((f) => !f)}>
              <Icon name={hasFile ? "check" : "upload"} size={24} className="upload-icon" />
              <div className="upload-text">
                {hasFile ? "logo-acme-corp.svg · 24 KB" : "Arrastra o selecciona tu logotipo"}
              </div>
              <div className="upload-hint">
                {hasFile ? "Listo · click para reemplazar" : "Vector preferido · SVG, AI, PDF · Máx 10 MB"}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", color: "var(--ink-4)", textTransform: "uppercase", margin: "0 0 12px" }}>
                Técnica de impresión
              </h3>
              <div className="pdp-printtech">
                {product.techniques.map((t, i) => (
                  <button key={t} className={technique === t ? "active" : ""} onClick={() => setTechnique(t)}>
                    <span>{t}</span>
                    <span className="pt-cost">{i === 0 ? "+ $0" : i === 1 ? "+ $4/pz" : "+ $6/pz"}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="pdp-actions">
            {!isLoggedIn ? (
              <Button variant="accent" size="lg" iconRight="arrow_right" onClick={() => navigate("/login")} style={{ width: "100%", justifyContent: "center" }}>
                Iniciar sesión para cotizar
              </Button>
            ) : (
              <>
                {canBuy && (
                  <Button variant="accent" size="lg" icon="cart" onClick={handleAddToCart}>
                    Añadir al carrito
                  </Button>
                )}
                <Button variant={canBuy ? "ghost" : "accent"} size="lg" icon="quote" onClick={handleAddToQuote}>
                  Añadir a cotización
                </Button>
                <button className="appbar-iconbtn" style={{ width: 48, height: 48, border: "1px solid var(--line-strong)" }}
                  onClick={() => toggleFav(product.id)} aria-label="Favorito">
                  <Icon name={isFav ? "heart_fill" : "heart_outline"} size={18} className={isFav ? "" : ""} style={{ color: isFav ? "var(--err)" : "var(--ink-3)" }} />
                </button>
              </>
            )}
          </div>

          {/* DELIVERY ESTIMATE */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16, padding: "20px 0", borderTop: "1px solid var(--line)", marginTop: 8,
          }}>
            {[
              { icon: "truck", label: "Producción", value: product.deliveryDays },
              { icon: "package", label: "MOQ", value: `${product.moq} piezas` },
              { icon: "shield", label: "Garantía", value: "Reposición s/c" },
            ].map((m) => (
              <div key={m.label} style={{ display: "flex", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "var(--bg-soft)", display: "grid", placeItems: "center", color: "var(--ink-2)",
                }}>
                  <Icon name={m.icon} size={15} />
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{m.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="pdp-tabs">
        <div className="pdp-tabs-nav">
          {[
            { k: "desc", l: "Descripción" },
            { k: "specs", l: "Especificaciones" },
            { k: "custom", l: "Personalización" },
            { k: "logistics", l: "Envío y devoluciones" },
          ].map((t) => (
            <button key={t.k} className={tab === t.k ? "active" : ""} onClick={() => setTab(t.k)}>
              {t.l}
            </button>
          ))}
        </div>
        <div className="pdp-tabs-body">
          {tab === "desc" && (
            <div style={{ maxWidth: 720 }}>
              <p>{product.desc}</p>
              <p>
                Cada pieza se produce bajo control de calidad ISO. Disponible en
                {" "}{product.colors.length} colores y compatible con {product.techniques.length} técnicas
                de personalización distintas. Ideal para volúmenes desde {product.moq} piezas hasta
                pedidos corporativos de más de 5,000 unidades.
              </p>
            </div>
          )}
          {tab === "specs" && (
            <table>
              <tbody>
                <tr><td>SKU</td><td className="mono">{product.id}</td></tr>
                <tr><td>Material</td><td>{product.materials}</td></tr>
                <tr><td>MOQ</td><td>{product.moq} piezas</td></tr>
                <tr><td>Colores disponibles</td><td>{product.colors.length}</td></tr>
                <tr><td>Técnicas</td><td>{product.techniques.join(" · ")}</td></tr>
                <tr><td>Tiempo de producción</td><td>{product.deliveryDays}</td></tr>
                <tr><td>Empaque</td><td>Bolsa individual + caja master de 50</td></tr>
                <tr><td>Origen</td><td>México · proveeduría seleccionada</td></tr>
              </tbody>
            </table>
          )}
          {tab === "custom" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, maxWidth: 900 }}>
              {product.techniques.map((t, i) => (
                <div key={t} style={{ padding: 20, background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{t}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
                    Costo · {i === 0 ? "incluido" : i === 1 ? "+$4/pz" : "+$6/pz"}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--ink-3)" }}>
                    {t === "Serigrafía" && "Tinta plana, hasta 4 colores Pantone. Recomendado para textiles y superficies planas."}
                    {t === "Grabado láser" && "Marcaje permanente, sin colores. Ideal para metales y maderas."}
                    {t === "Sublimación" && "Full color fotográfico. Solo en superficies preparadas (poliéster, taza, mouse pad)."}
                  </p>
                </div>
              ))}
            </div>
          )}
          {tab === "logistics" && (
            <table>
              <tbody>
                <tr><td>Tiempo de producción</td><td>{product.deliveryDays}</td></tr>
                <tr><td>Envío nacional</td><td>2–5 días hábiles, paquetería seleccionada</td></tr>
                <tr><td>Cobertura</td><td>Toda la República Mexicana</td></tr>
                <tr><td>Devoluciones</td><td>Reposición sin costo en defectos de fabricación</td></tr>
                <tr><td>Fulfillment</td><td>Disponible · envíos individuales con tu identidad</td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* RELATED */}
      {related.length > 0 && (
        <div style={{ padding: "60px 0 80px" }}>
          <div className="section-head">
            <div>
              <div className="eyebrow">// También te interesa</div>
              <h2 style={{
                fontFamily: "var(--font-display)", fontWeight: 700,
                fontSize: 36, letterSpacing: "-0.02em", lineHeight: 1, margin: "12px 0 0",
              }}>Productos similares.</h2>
            </div>
          </div>
          <div className="product-grid">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}

window.ProductScreen = ProductScreen;
