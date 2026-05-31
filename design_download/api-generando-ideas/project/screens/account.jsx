/* ============================================================
   ACCOUNT — Dashboard + history
   ============================================================ */

const MOCK_ORDERS = [
  { id: "GI-O-2026-0421", date: "12 May 2026", items: 4, total: 28450, status: "delivered", statusLabel: "Entregada" },
  { id: "GI-O-2026-0397", date: "28 Abr 2026", items: 2, total: 12800, status: "production", statusLabel: "En producción" },
  { id: "GI-O-2026-0354", date: "14 Abr 2026", items: 8, total: 89200, status: "shipping", statusLabel: "Enviado" },
  { id: "GI-O-2026-0312", date: "02 Abr 2026", items: 3, total: 18650, status: "delivered", statusLabel: "Entregada" },
  { id: "GI-O-2026-0288", date: "21 Mar 2026", items: 12, total: 145800, status: "delivered", statusLabel: "Entregada" },
];

const MOCK_QUOTES = [
  { id: "GI-Q-2026-0156", date: "20 May 2026", items: 6, est: 62400, status: "review", statusLabel: "En revisión" },
  { id: "GI-Q-2026-0142", date: "15 May 2026", items: 4, est: 38900, status: "approved", statusLabel: "Aprobada · lista para orden" },
  { id: "GI-Q-2026-0118", date: "08 May 2026", items: 12, est: 184500, status: "expired", statusLabel: "Vencida" },
  { id: "GI-Q-2026-0094", date: "02 May 2026", items: 3, est: 21300, status: "converted", statusLabel: "Convertida en orden" },
];

const STATUS_COLORS = {
  delivered: "tag-ok",
  production: "tag-accent",
  shipping: "tag-info",
  review: "tag-accent",
  approved: "tag-ok",
  expired: "tag",
  converted: "tag-info",
};

function AccountScreen({ subRoute }) {
  const { auth, logout, favs } = useApp();
  const { navigate } = useRouter();
  const { PRODUCTS } = window.GI_DATA;
  const [active, setActive] = useState(subRoute || "overview");

  useEffect(() => { setActive(subRoute || "overview"); }, [subRoute]);

  if (!auth) {
    return <GatedScreen title="Mi cuenta" message="Inicia sesión para acceder a tu dashboard." />;
  }

  const items = [
    { k: "overview", l: "Resumen", i: "grid", to: "/cuenta" },
    { k: "ordenes", l: "Órdenes", i: "package", to: "/cuenta/ordenes", show: auth.role === "buyer" },
    { k: "cotizaciones", l: "Cotizaciones", i: "quote", to: "/cuenta/cotizaciones" },
    { k: "favoritos", l: "Favoritos", i: "heart_outline", to: "/cuenta/favoritos" },
    { k: "direcciones", l: "Direcciones", i: "truck", to: "/cuenta/direcciones" },
    { k: "empresa", l: "Mi empresa", i: "office", to: "/cuenta/empresa" },
    { k: "ajustes", l: "Ajustes", i: "settings", to: "/cuenta/ajustes" },
  ].filter(it => it.show !== false);

  return (
    <div className="container acct-page" data-screen-label={`09 Account · ${active}`}>
      <aside className="acct-sidebar">
        <div className="acct-user">
          <div className="acct-avatar">{auth.name.split(" ").map(n => n[0]).slice(0,2).join("")}</div>
          <div className="acct-user-info">
            <div className="nm">{auth.name}</div>
            <div className="em">{auth.email}</div>
          </div>
        </div>
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--bg-soft)", marginBottom: 8 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Tipo de cuenta</div>
          <div style={{ marginTop: 4 }}>
            <span className={`tag ${auth.role === "buyer" ? "tag-ok" : "tag-info"} tag-dot`}>
              {auth.role === "buyer" ? "Comprador" : "Cotizador"}
            </span>
          </div>
        </div>

        <nav className="acct-nav">
          {items.map((it) => (
            <button key={it.k} className={active === it.k ? "active" : ""}
              onClick={() => { setActive(it.k); navigate(it.to); }}>
              <Icon name={it.i} size={16} />
              {it.l}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--line)", marginTop: 8, paddingTop: 8 }}>
            <button onClick={() => { logout(); navigate("/"); }} style={{ color: "var(--ink-3)" }}>
              <Icon name="log_out" size={16} />
              Cerrar sesión
            </button>
          </div>
        </nav>
      </aside>

      <div className="acct-content">
        {active === "overview" && <AccountOverview />}
        {active === "ordenes" && <AccountOrders />}
        {active === "cotizaciones" && <AccountQuotes />}
        {active === "favoritos" && <AccountFavorites />}
        {active === "direcciones" && <AccountAddresses />}
        {active === "empresa" && <AccountCompany />}
        {active === "ajustes" && <AccountSettings />}
      </div>
    </div>
  );
}

function AccountOverview() {
  const { auth, cart, quote, favs } = useApp();
  const { navigate } = useRouter();

  return (
    <>
      <div>
        <div className="eyebrow">// {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1>Hola, {auth.name.split(" ")[0]}.</h1>
        <p style={{ color: "var(--ink-3)", margin: "8px 0 0", fontSize: 16 }}>
          Aquí está el resumen de tu actividad reciente con Generando Ideas.
        </p>
      </div>

      <div className="acct-stats">
        <div className="acct-stat">
          <div className="l">Órdenes este mes</div>
          <div className="v">3</div>
          <div className="d">+1 vs. mes anterior</div>
        </div>
        <div className="acct-stat">
          <div className="l">Cotizaciones abiertas</div>
          <div className="v">2</div>
          <div className="d" style={{ color: "var(--ink-4)" }}>1 esperando tu aprobación</div>
        </div>
        <div className="acct-stat">
          <div className="l">Gasto YTD</div>
          <div className="v" style={{ fontSize: 24 }}>$424,800</div>
          <div className="d">MXN sin IVA</div>
        </div>
        <div className="acct-stat">
          <div className="l">Productos favoritos</div>
          <div className="v">{favs.length || 0}</div>
          <div className="d" style={{ color: "var(--ink-4)" }}>Lista lista para re-orden</div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <ActionCard icon="cart" title="Re-ordenar" desc="Repite una orden anterior en 2 clics." onClick={() => navigate("/cuenta/ordenes")} />
        <ActionCard icon="quote" title="Nueva cotización" desc="Arma una lista y solicita propuesta." onClick={() => navigate("/catalogo")} />
        <ActionCard icon="chat" title="Hablar con mi asesor" desc="Carlos Méndez · responde en 2h." onClick={() => {}} />
      </div>

      {/* Recent activity */}
      <div>
        <h3 style={{
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22,
          letterSpacing: "-0.015em", margin: "16px 0 16px",
        }}>Actividad reciente</h3>
        <div className="acct-table">
          <div className="acct-table-head">
            <span>Folio</span>
            <span>Fecha</span>
            <span>Productos</span>
            <span>Total</span>
            <span>Estado</span>
            <span></span>
          </div>
          {MOCK_ORDERS.slice(0, 3).map((o) => (
            <div key={o.id} className="acct-table-row">
              <span className="id">{o.id}</span>
              <span>{o.date}</span>
              <span>{o.items} productos</span>
              <span className="mono">{window.GI_FORMAT_PRICE(o.total)}</span>
              <span><span className={`tag ${STATUS_COLORS[o.status]} tag-dot`}>{o.statusLabel}</span></span>
              <span>
                <button style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Ver →</button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ActionCard({ icon, title, desc, onClick }) {
  return (
    <button onClick={onClick} className="lift" style={{
      background: "var(--bg-elev)", border: "1px solid var(--line)",
      borderRadius: 16, padding: 20, textAlign: "left", display: "flex", gap: 14, alignItems: "start",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)",
        color: "var(--warn)", display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <Icon name={icon} size={18} />
      </div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.4 }}>{desc}</div>
      </div>
    </button>
  );
}

function AccountOrders() {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="eyebrow">// Órdenes · /cuenta/ordenes</div>
          <h1>Mis órdenes</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="input" style={{ padding: "10px 14px", fontSize: 13, borderRadius: 999, width: "auto" }}>
            <option>Últimos 30 días</option>
            <option>Últimos 90 días</option>
            <option>Este año</option>
            <option>Todo</option>
          </select>
          <Button variant="ghost" icon="search">Buscar</Button>
        </div>
      </div>

      <div className="acct-table">
        <div className="acct-table-head">
          <span>Folio</span>
          <span>Fecha</span>
          <span>Productos</span>
          <span>Total</span>
          <span>Estado</span>
          <span></span>
        </div>
        {MOCK_ORDERS.map((o) => (
          <div key={o.id} className="acct-table-row">
            <span className="id">{o.id}</span>
            <span>{o.date}</span>
            <span>{o.items} productos</span>
            <span className="mono">{window.GI_FORMAT_PRICE(o.total)}</span>
            <span><span className={`tag ${STATUS_COLORS[o.status]} tag-dot`}>{o.statusLabel}</span></span>
            <span style={{ display: "flex", gap: 6 }}>
              <button style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Ver →</button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function AccountQuotes() {
  const { navigate } = useRouter();
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="eyebrow">// Cotizaciones · /cuenta/cotizaciones</div>
          <h1>Mis cotizaciones</h1>
        </div>
        <Button variant="accent" iconRight="arrow_right" onClick={() => navigate("/catalogo")}>Nueva cotización</Button>
      </div>

      <div className="acct-table">
        <div className="acct-table-head">
          <span>Folio</span>
          <span>Fecha</span>
          <span>Productos</span>
          <span>Estimado</span>
          <span>Estado</span>
          <span></span>
        </div>
        {MOCK_QUOTES.map((q) => (
          <div key={q.id} className="acct-table-row">
            <span className="id">{q.id}</span>
            <span>{q.date}</span>
            <span>{q.items} productos</span>
            <span className="mono">{window.GI_FORMAT_PRICE(q.est)}</span>
            <span><span className={`tag ${STATUS_COLORS[q.status]} tag-dot`}>{q.statusLabel}</span></span>
            <span style={{ display: "flex", gap: 6 }}>
              <button style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Ver →</button>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function AccountFavorites() {
  const { favs } = useApp();
  const { navigate } = useRouter();
  const { PRODUCTS } = window.GI_DATA;
  const products = PRODUCTS.filter((p) => favs.includes(p.id));

  return (
    <>
      <div>
        <div className="eyebrow">// Favoritos · /cuenta/favoritos</div>
        <h1>Mis favoritos</h1>
        <p style={{ color: "var(--ink-3)", margin: "8px 0 0" }}>{products.length} productos guardados para futuras campañas.</p>
      </div>

      {products.length === 0 ? (
        <div className="empty">
          <Icon name="heart_outline" size={32} className="muted-2" />
          <h3>Sin favoritos aún</h3>
          <p>Marca productos con el corazón mientras navegas el catálogo.</p>
          <Button variant="accent" iconRight="arrow_right" onClick={() => navigate("/catalogo")}>Explorar catálogo</Button>
        </div>
      ) : (
        <div className="product-grid stagger">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </>
  );
}

function AccountAddresses() {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="eyebrow">// Direcciones · /cuenta/direcciones</div>
          <h1>Direcciones de envío</h1>
        </div>
        <Button variant="accent" icon="plus">Nueva dirección</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { l: "Oficinas CDMX", addr: "Av. Presidente Masaryk 111, Polanco V Secc, Miguel Hidalgo, 11560 CDMX", primary: true },
          { l: "Almacén Guadalajara", addr: "Av. Patria 1100, Lomas del Valle, 45129 Zapopan, Jal.", primary: false },
        ].map((a) => (
          <div key={a.l} style={{
            background: "var(--bg-elev)", border: `1px solid ${a.primary ? "var(--ink)" : "var(--line)"}`,
            borderRadius: 16, padding: 24, position: "relative",
          }}>
            {a.primary && <span className="tag tag-ink" style={{ position: "absolute", top: 16, right: 16 }}>PRINCIPAL</span>}
            <Icon name="truck" size={20} className="muted" />
            <div style={{ fontWeight: 600, fontSize: 16, marginTop: 12 }}>{a.l}</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 }}>{a.addr}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", textDecoration: "underline" }}>Editar</button>
              {!a.primary && <button style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", textDecoration: "underline" }}>Establecer como principal</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function AccountCompany() {
  return (
    <>
      <div>
        <div className="eyebrow">// Empresa · /cuenta/empresa</div>
        <h1>Mi empresa</h1>
      </div>

      <div style={{ background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 16, padding: 32 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, margin: "0 0 16px", letterSpacing: "-0.01em" }}>
          Datos fiscales
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="field">
            <label>Razón social</label>
            <input className="input" defaultValue="Acme Corp S.A. de C.V." />
          </div>
          <div className="field">
            <label>RFC</label>
            <input className="input" defaultValue="ACM010203XXX" />
          </div>
          <div className="field">
            <label>Régimen fiscal</label>
            <select className="input">
              <option>601 · General de Personas Morales</option>
              <option>612 · Personas Físicas con actividades empresariales</option>
            </select>
          </div>
          <div className="field">
            <label>Uso de CFDI</label>
            <select className="input">
              <option>G03 · Gastos en general</option>
              <option>G01 · Adquisición de mercancías</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          <Button variant="primary">Guardar cambios</Button>
        </div>
      </div>
    </>
  );
}

function AccountSettings() {
  return (
    <>
      <div>
        <div className="eyebrow">// Ajustes · /cuenta/ajustes</div>
        <h1>Ajustes</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { l: "Notificaciones por correo", desc: "Recibe actualizaciones de cotizaciones y órdenes", on: true },
          { l: "Notificaciones WhatsApp", desc: "Tu asesor te contactará por este canal", on: true },
          { l: "Boletín mensual", desc: "Tendencias, lanzamientos y promociones", on: false },
          { l: "Autenticación de dos pasos", desc: "Capa adicional de seguridad en el login", on: false },
        ].map((s, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--bg-elev)", border: "1px solid var(--line)",
            borderRadius: 12, padding: 20, gap: 16,
          }}>
            <div>
              <div style={{ fontWeight: 600 }}>{s.l}</div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>{s.desc}</div>
            </div>
            <Toggle defaultOn={s.on} />
          </div>
        ))}
      </div>
    </>
  );
}

function Toggle({ defaultOn }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button onClick={() => setOn(!on)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: on ? "var(--ink)" : "var(--line-strong)",
        position: "relative", transition: "background 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        flexShrink: 0,
      }}>
      <div style={{
        position: "absolute", top: 2, left: on ? 22 : 2,
        width: 20, height: 20, borderRadius: "50%",
        background: "var(--bg-elev)",
        transition: "left 220ms cubic-bezier(0.16, 1, 0.3, 1)",
      }} />
    </button>
  );
}

window.AccountScreen = AccountScreen;
