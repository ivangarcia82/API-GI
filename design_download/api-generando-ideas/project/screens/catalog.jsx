/* ============================================================
   CATALOG SCREEN
   ============================================================ */

function CatalogScreen() {
  const { CATEGORIES, COLLECTIONS, PRODUCTS, COLORS } = window.GI_DATA;
  const { path } = useRouter();
  const queryString = path.includes("?") ? path.split("?")[1] : "";
  const params = Object.fromEntries(new URLSearchParams(queryString));

  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState(params.cat || "all");
  const [activeColl, setActiveColl] = useState(params.col || "all");
  const [sort, setSort] = useState("relevance");
  const [priceRange, setPriceRange] = useState([0, 1000]);

  useEffect(() => {
    setActiveCat(params.cat || "all");
    setActiveColl(params.col || "all");
  }, [path]);

  const filtered = useMemo(() => {
    let out = PRODUCTS.slice();
    if (activeCat !== "all") out = out.filter((p) => p.category === activeCat);
    if (activeColl !== "all") out = out.filter((p) => p.collection === activeColl);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    }
    out = out.filter((p) => p.price >= priceRange[0] && p.price <= priceRange[1]);

    if (sort === "price-asc") out.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") out.sort((a, b) => b.price - a.price);
    else if (sort === "new") out.sort((a, b) => (b.new ? 1 : 0) - (a.new ? 1 : 0));
    else if (sort === "bestseller") out.sort((a, b) => (b.bestseller ? 1 : 0) - (a.bestseller ? 1 : 0));
    return out;
  }, [activeCat, activeColl, search, sort, priceRange]);

  const activeCategoryName = activeCat === "all" ? "Todos los productos" : (CATEGORIES.find(c => c.id === activeCat)?.name || "Catálogo");
  const activeCollName = activeColl === "all" ? null : COLLECTIONS.find(c => c.id === activeColl)?.name;

  return (
    <div className="container" data-screen-label="04 Catalog">
      <div style={{ padding: "32px 0 16px" }}>
        <div className="eyebrow">// Catálogo · /catalogo</div>
        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 700,
          fontSize: "clamp(40px, 6vw, 80px)", letterSpacing: "-0.035em",
          lineHeight: 0.95, margin: "12px 0 8px",
        }}>
          {activeCategoryName}
          {activeCollName && <span style={{ color: "var(--ink-4)" }}> · {activeCollName}</span>}
        </h1>
        <p style={{ color: "var(--ink-3)", margin: 0, fontSize: 16 }}>
          Explora nuestro inventario completo. Filtra por categoría, colección, color o precio.
        </p>
      </div>

      <div className="cat-page">
        {/* SIDEBAR */}
        <aside className="cat-sidebar">
          <div className="cat-filter-group">
            <h4>
              Categorías
              {(activeCat !== "all" || activeColl !== "all") && (
                <button onClick={() => { setActiveCat("all"); setActiveColl("all"); }}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent-deep)", textDecoration: "underline", textTransform: "none" }}>
                  reset
                </button>
              )}
            </h4>
            <div className="cat-filter-list">
              <button onClick={() => setActiveCat("all")} className={activeCat === "all" ? "active" : ""}>
                <span>Todas</span>
                <span className="count">{PRODUCTS.length}</span>
              </button>
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => setActiveCat(c.id)} className={activeCat === c.id ? "active" : ""}>
                  <span>{c.name}</span>
                  <span className="count">{PRODUCTS.filter(p => p.category === c.id).length}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="cat-filter-group">
            <h4>Colecciones</h4>
            <div className="cat-tags">
              <button className={`cat-tag-btn ${activeColl === "all" ? "active" : ""}`} onClick={() => setActiveColl("all")}>Todas</button>
              {COLLECTIONS.map((c) => (
                <button key={c.id} className={`cat-tag-btn ${activeColl === c.id ? "active" : ""}`} onClick={() => setActiveColl(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="cat-filter-group">
            <h4>Color</h4>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COLORS.map((c) => (
                <button key={c.id} title={c.name}
                  style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: c.hex, border: "2px solid var(--bg)",
                    boxShadow: "0 0 0 1px var(--line)", cursor: "pointer",
                  }} />
              ))}
            </div>
          </div>

          <div className="cat-filter-group">
            <h4>Rango de precio</h4>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" className="input" value={priceRange[0]}
                onChange={(e) => setPriceRange([+e.target.value, priceRange[1]])}
                style={{ padding: "8px 10px", fontSize: 13 }} />
              <span style={{ color: "var(--ink-4)" }}>—</span>
              <input type="number" className="input" value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], +e.target.value])}
                style={{ padding: "8px 10px", fontSize: 13 }} />
            </div>
            <span className="help-msg">MXN · sin IVA</span>
          </div>

          <div className="cat-filter-group">
            <h4>Otras opciones</h4>
            <div className="cat-filter-list">
              {[
                { l: "Productos nuevos", k: "new" },
                { l: "Bestsellers", k: "best" },
                { l: "Ecológicos", k: "eco" },
                { l: "Stock disponible", k: "stock" },
              ].map((o) => (
                <label key={o.k} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 14,
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" />
                    {o.l}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* RESULTS */}
        <div>
          <div className="cat-toolbar">
            <div className="cat-search">
              <Icon name="search" size={14} />
              <input
                placeholder="Buscar producto, SKU o categoría…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span className="cat-results-meta">{filtered.length} productos</span>
              <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}
                style={{ padding: "10px 14px", fontSize: 13, borderRadius: 999, fontWeight: 500 }}>
                <option value="relevance">Relevancia</option>
                <option value="bestseller">Más vendidos</option>
                <option value="new">Nuevos primero</option>
                <option value="price-asc">Precio: menor a mayor</option>
                <option value="price-desc">Precio: mayor a menor</option>
              </select>
              <div className="cat-view-toggle">
                <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Vista cuadrícula">
                  <Icon name="grid" size={14} />
                </button>
                <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="Vista lista">
                  <Icon name="list" size={14} />
                </button>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              <Icon name="search" size={32} className="muted-2" />
              <h3>Sin resultados</h3>
              <p>Intenta con otros filtros o palabras de búsqueda.</p>
              <Button variant="ghost" onClick={() => { setSearch(""); setActiveCat("all"); setActiveColl("all"); setPriceRange([0, 1000]); }}>
                Limpiar filtros
              </Button>
            </div>
          ) : view === "grid" ? (
            <div className="product-grid stagger" key={`${activeCat}-${activeColl}-${sort}`}>
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className="product-list stagger" key={`list-${activeCat}-${activeColl}-${sort}`}>
              {filtered.map((p) => <ProductCard key={p.id} product={p} view="list" />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.CatalogScreen = CatalogScreen;
