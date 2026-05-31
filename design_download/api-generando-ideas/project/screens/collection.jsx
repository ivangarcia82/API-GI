/* ============================================================
   COLLECTION SCREEN — Single collection view + Collections list
   ============================================================ */

function CollectionsScreen() {
  const { COLLECTIONS } = window.GI_DATA;
  const { navigate } = useRouter();

  return (
    <div className="container" data-screen-label="05 Collections list">
      <div style={{ padding: "32px 0 56px" }}>
        <div className="eyebrow">// Colecciones · /colecciones</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 700,
          fontSize: "clamp(48px, 7vw, 96px)", letterSpacing: "-0.035em",
          lineHeight: 0.95, margin: "12px 0 16px", maxWidth: 900,
        }}>
          9 colecciones curadas<br />
          para campañas <em style={{ fontStyle: "italic", fontWeight: 400, color: "var(--accent-deep)" }}>precisas</em>.
        </h1>
        <p style={{ color: "var(--ink-3)", fontSize: 17, maxWidth: 600 }}>
          Cada colección une calidad, oferta y propósito. Desde nuestras líneas premium hasta
          alternativas 100% ecológicas, encuentra la familia que se ajusta a tu marca.
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
        paddingBottom: 80,
      }} className="collections-grid stagger">
        {COLLECTIONS.map((c, i) => (
          <div key={c.id} className="coll-card" onClick={() => navigate(`/colecciones/${c.id}`)} style={{ minHeight: 420 }}>
            <div className="coll-card-img">
              <PH tint={c.tint} src={c.image} alt={c.name} className="ph-square" zoom />
              <div className="coll-card-tag">// {String(i + 1).padStart(2, "0")}</div>
            </div>
            <div className="coll-card-info">
              <div>
                <div className="coll-card-name">{c.name}</div>
                <div className="coll-card-meta">{c.subtitle} · {c.count} productos</div>
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                display: "grid", placeItems: "center",
                background: "var(--bg-soft)", color: "var(--ink)",
              }}>
                <Icon name="arrow_up_right" size={14} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CollectionDetailScreen({ collectionId }) {
  const { COLLECTIONS, PRODUCTS } = window.GI_DATA;
  const { navigate } = useRouter();
  const collection = COLLECTIONS.find((c) => c.id === collectionId) || COLLECTIONS[0];
  const products = PRODUCTS.filter((p) => p.collection === collectionId);
  const displayProducts = products.length > 0 ? products : PRODUCTS.slice(0, 6);

  return (
    <div className="container" data-screen-label={`05b Collection: ${collection.name}`}>
      <div style={{ padding: "32px 0 12px" }}>
        <button onClick={() => navigate("/colecciones")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "var(--font-mono)", fontSize: 12,
            color: "var(--ink-3)", textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}>
          <Icon name="arrow_right" size={12} style={{ transform: "rotate(180deg)" }} />
          Volver a colecciones
        </button>
      </div>

      <div className="coll-hero">
        <div>
          <div className="eyebrow">// Colección · {String(COLLECTIONS.findIndex(c => c.id === collection.id) + 1).padStart(2, "0")}</div>
          <h1>{collection.name}</h1>
          <p style={{ marginTop: 24 }}>
            {collection.subtitle}. Una línea cuidadosamente seleccionada por nuestro equipo creativo
            para maximizar impacto y minimizar desperdicio.
          </p>
          <div className="coll-hero-meta">
            <div>
              <div className="n ticker">{collection.count}</div>
              <div className="l">Productos</div>
            </div>
            <div>
              <div className="n ticker">50</div>
              <div className="l">MOQ promedio</div>
            </div>
            <div>
              <div className="n ticker">8–12d</div>
              <div className="l">Producción</div>
            </div>
          </div>
        </div>
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)" }}>
          <PH tint={collection.tint} src={collection.image} alt={collection.name} aspect="ph-square" zoom />
        </div>
      </div>

      <div style={{ padding: "40px 0 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: 32, letterSpacing: "-0.02em", margin: 0,
          }}>Productos de la colección</h2>
          <span className="cat-results-meta">{displayProducts.length} productos</span>
        </div>
        <div className="product-grid stagger">
          {displayProducts.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
    </div>
  );
}

window.CollectionsScreen = CollectionsScreen;
window.CollectionDetailScreen = CollectionDetailScreen;
