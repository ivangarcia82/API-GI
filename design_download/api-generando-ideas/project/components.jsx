/* ============================================================
   Generando Ideas — Shared components
   ============================================================ */

const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* -------- ICONS -------- */
const Icon = ({ name, size = 18, strokeWidth = 1.7, className = "" }) => {
  const s = size;
  const sw = strokeWidth;
  const paths = {
    cart: <><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.5 12.5a2 2 0 0 0 2 1.5h8a2 2 0 0 0 2-1.5L21.5 8H6"/></>,
    quote: <><path d="M9 4h9l3 3v13a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M18 4v3h3"/><path d="M5 8v12a1 1 0 0 0 1 1h2"/><path d="M12 12h5M12 15h5M12 18h3"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    arrow_right: <><path d="M5 12h14M13 5l7 7-7 7"/></>,
    arrow_up_right: <><path d="M7 17 17 7M7 7h10v10"/></>,
    heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>,
    heart_fill: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" fill="currentColor"/>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    minus: <path d="M5 12h14"/>,
    trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
    check: <path d="M5 12.5 10 17.5l9-10"/>,
    x: <><path d="M6 6l12 12M18 6 6 18"/></>,
    chevron_down: <path d="m6 9 6 6 6-6"/>,
    chevron_right: <path d="m9 6 6 6-6 6"/>,
    filter: <><path d="M3 6h18M6 12h12M10 18h4"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
    menu: <><path d="M3 6h18M3 12h18M3 18h18"/></>,
    drink: <><path d="M7 3h10l-1 7H8L7 3z"/><path d="M8 10v9a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-9"/><path d="M10 14h4"/></>,
    leaf: <><path d="M11 20A7 7 0 0 1 4 13c0-5 6-8 16-8 0 9-3 15-9 15z"/><path d="M5 20s5-5 11-5"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/></>,
    tech: <><rect x="3" y="5" width="18" height="12" rx="1"/><path d="M8 21h8M12 17v4"/></>,
    office: <><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></>,
    shirt: <><path d="M3 7 8 3l4 2 4-2 5 4-3 4-2-1v12H8V10L6 11 3 7z"/></>,
    bag: <><path d="M5 8h14l-1 13H6L5 8z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></>,
    package: <><path d="m3 7 9-5 9 5v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></>,
    truck: <><rect x="1" y="6" width="14" height="11" rx="1"/><path d="M15 9h4l3 3v5h-7"/><circle cx="6" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></>,
    shield: <path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z"/>,
    sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></>,
    layers: <><path d="m12 2 10 6-10 6L2 8l10-6z"/><path d="m2 14 10 6 10-6"/></>,
    bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8z"/>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    receipt: <><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2"/><path d="M8 7h8M8 11h8M8 15h6"/></>,
    star: <path d="m12 2 3.1 6.3 7 1-5 4.9 1.2 6.9L12 17.8 5.7 21l1.2-7-5-4.8 7-1L12 2z"/>,
    star_fill: <path d="m12 2 3.1 6.3 7 1-5 4.9 1.2 6.9L12 17.8 5.7 21l1.2-7-5-4.8 7-1L12 2z" fill="currentColor"/>,
    eye_off: <><path d="M9.9 4.2A11 11 0 0 1 12 4c7 0 10 8 10 8a17 17 0 0 1-2.6 3.7"/><path d="M6.6 6.6A17 17 0 0 0 2 12s3 8 10 8c1.7 0 3.3-.5 4.7-1.3"/><path d="M14 14a3 3 0 1 1-4-4"/><path d="m2 2 20 20"/></>,
    eye: <><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/></>,
    logo: <><path d="M2 12 7 4h10l5 8-5 8H7L2 12z"/></>,
    log_out: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></>,
    heart_outline: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>,
    chat: <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>,
  };
  const path = paths[name];
  if (!path) return null;
  return (
    <svg className={className} width={s} height={s} viewBox="0 0 24 24"
         fill="none" stroke="currentColor" strokeWidth={sw}
         strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
};

/* -------- LOGO -------- */
const Logo = ({ size = 32 }) => (
  <div className="appbar-logo" style={{ width: size, height: size, fontSize: size * 0.45 }}>
    GI
  </div>
);

/* -------- BUTTON -------- */
const Button = ({ children, variant = "primary", size, icon, iconRight, className = "", ...rest }) => {
  const cn = `btn btn-${variant} ${size === "lg" ? "btn-lg" : size === "sm" ? "btn-sm" : ""} ${className}`;
  return (
    <button className={cn} {...rest}>
      {icon && <Icon name={icon} size={size === "lg" ? 18 : size === "sm" ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "lg" ? 18 : size === "sm" ? 14 : 16} />}
    </button>
  );
};

/* -------- PLACEHOLDER IMAGE -------- */
const PH = ({ tint, label, className = "", aspect = "", src, alt = "", zoom = false, style }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className={`ph ${tint || "ph-tinted-stone"} ${aspect} ${className} ${zoom ? "ph-zoom" : ""}`} style={style}>
      {src && !error && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      )}
      {label && (!src || !loaded || error) && <span className="ph-label">{label}</span>}
    </div>
  );
};

/* -------- IMAGE (real image without tint fallback dominance) -------- */
const Img = ({ src, alt = "", className = "", style, zoom = false }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`gi-img ${zoom ? "gi-img-zoom" : ""} ${className}`} style={style}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{
          opacity: loaded ? 1 : 0,
          transition: "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </div>
  );
};

/* -------- COUNT-UP -------- */
function CountUp({ to, suffix = "", duration = 1400, prefix = "" }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(Math.round(to * ease(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return <span ref={ref}>{prefix}{val.toLocaleString("es-MX")}{suffix}</span>;
}

/* -------- TOAST SYSTEM -------- */
const ToastContext = React.createContext(null);
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.accent ? "toast-accent" : ""}`}>
            {t.icon && <Icon name={t.icon} size={16} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
const useToast = () => React.useContext(ToastContext);

/* -------- APP STATE (auth + cart + quote + favs) -------- */
const AppCtx = React.createContext(null);

function AppProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gi_auth") || "null"); } catch { return null; }
  });
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gi_cart") || "[]"); } catch { return []; }
  });
  const [quote, setQuote] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gi_quote") || "[]"); } catch { return []; }
  });
  const [favs, setFavs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gi_favs") || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("gi_auth", JSON.stringify(auth)); }, [auth]);
  useEffect(() => { localStorage.setItem("gi_cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem("gi_quote", JSON.stringify(quote)); }, [quote]);
  useEffect(() => { localStorage.setItem("gi_favs", JSON.stringify(favs)); }, [favs]);

  const login = (data) => setAuth({
    name: data.name || "Mariana Ruiz",
    email: data.email || "mariana@empresa.mx",
    company: data.company || "Acme Corp",
    role: data.role || "buyer",  // 'buyer' or 'quoter'
    since: new Date().toLocaleDateString("es-MX", { month: "short", year: "numeric" }),
  });
  const logout = () => { setAuth(null); };
  const setRole = (role) => setAuth((a) => a ? { ...a, role } : a);

  const addToCart = (product, qty, opts = {}) => {
    setCart((c) => {
      const existing = c.find((i) => i.id === product.id && i.color === opts.color);
      if (existing) {
        return c.map((i) => i === existing ? { ...i, qty: i.qty + qty } : i);
      }
      return [...c, { id: product.id, qty, color: opts.color, technique: opts.technique, name: product.name, price: product.price, tint: product.tint, image: product.image, sku: product.id }];
    });
  };
  const addToQuote = (product, qty, opts = {}) => {
    setQuote((q) => {
      const existing = q.find((i) => i.id === product.id && i.color === opts.color);
      if (existing) {
        return q.map((i) => i === existing ? { ...i, qty: i.qty + qty } : i);
      }
      return [...q, { id: product.id, qty, color: opts.color, technique: opts.technique, name: product.name, price: product.price, tint: product.tint, image: product.image, sku: product.id, addedAt: Date.now() }];
    });
  };
  const removeFromCart = (id, color) => setCart((c) => c.filter((i) => !(i.id === id && i.color === color)));
  const removeFromQuote = (id, color) => setQuote((q) => q.filter((i) => !(i.id === id && i.color === color)));
  const updateCartQty = (id, color, qty) => setCart((c) => c.map((i) => (i.id === id && i.color === color) ? { ...i, qty } : i));
  const updateQuoteQty = (id, color, qty) => setQuote((q) => q.map((i) => (i.id === id && i.color === color) ? { ...i, qty } : i));
  const clearCart = () => setCart([]);
  const clearQuote = () => setQuote([]);

  const toggleFav = (id) => setFavs((f) => f.includes(id) ? f.filter((x) => x !== id) : [...f, id]);

  const value = {
    auth, login, logout, setRole,
    cart, addToCart, removeFromCart, updateCartQty, clearCart,
    quote, addToQuote, removeFromQuote, updateQuoteQty, clearQuote,
    favs, toggleFav,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
const useApp = () => React.useContext(AppCtx);

/* -------- ROUTER (hash-based) -------- */
const RouterCtx = React.createContext(null);

function RouterProvider({ children }) {
  const [path, setPath] = useState(() => location.hash.slice(1) || "/");
  useEffect(() => {
    const onHash = () => {
      setPath(location.hash.slice(1) || "/");
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = useCallback((to) => { location.hash = to; }, []);
  return <RouterCtx.Provider value={{ path, navigate }}>{children}</RouterCtx.Provider>;
}
const useRouter = () => React.useContext(RouterCtx);

const Link = ({ to, children, className, ...rest }) => {
  const { navigate, path } = useRouter();
  const isActive = path === to || (to !== "/" && path.startsWith(to));
  return (
    <a
      href={`#${to}`}
      className={`${className || ""} ${isActive ? "active" : ""}`}
      onClick={(e) => { e.preventDefault(); navigate(to); }}
      {...rest}
    >
      {children}
    </a>
  );
};

/* -------- HEADER -------- */
function Header() {
  const { auth, cart, quote, logout } = useApp();
  const { path, navigate } = useRouter();
  const [mobile, setMobile] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  const cartCount = cart.reduce((n, i) => n + i.qty, 0);
  const quoteCount = quote.reduce((n, i) => n + i.qty, 0);

  return (
    <>
      <header className="appbar" data-screen-label="App Header">
        <div className="appbar-inner">
          <a href="#/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="appbar-brand">
            <Logo />
            <span>Generando<span style={{ color: "var(--accent-deep)" }}>·</span>Ideas</span>
          </a>

          <nav className="appbar-nav">
            <Link to="/catalogo">Catálogo</Link>
            <Link to="/colecciones">Colecciones</Link>
            <Link to="/lookbook">Lookbook</Link>
            <Link to="/servicios">Servicios</Link>
            <Link to="/conocenos">Nosotros</Link>
          </nav>

          <div className="appbar-actions">
            <button className="appbar-iconbtn" aria-label="Buscar"
              onClick={() => navigate("/catalogo")}>
              <Icon name="search" size={18} />
            </button>

            {auth?.role === "buyer" && (
              <button className="appbar-iconbtn" aria-label="Carrito"
                onClick={() => navigate("/carrito")}>
                <Icon name="cart" size={18} />
                {cartCount > 0 && <span className="appbar-badge">{cartCount}</span>}
              </button>
            )}

            {auth && (
              <button className="appbar-iconbtn" aria-label="Cotización"
                onClick={() => navigate("/cotizacion")}>
                <Icon name="quote" size={18} />
                {quoteCount > 0 && <span className="appbar-badge">{quoteCount}</span>}
              </button>
            )}

            {!auth ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
                  Iniciar sesión
                </Button>
                <Button variant="accent" size="sm" onClick={() => navigate("/registro")} iconRight="arrow_right">
                  Crear cuenta
                </Button>
              </>
            ) : (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setUserMenu((m) => !m)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 12px 6px 6px",
                    borderRadius: 999, border: "1px solid var(--line)",
                    background: "var(--bg-elev)", fontSize: 13, fontWeight: 600,
                  }}
                >
                  <div className="acct-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                    {auth.name.split(" ").map(n => n[0]).slice(0,2).join("")}
                  </div>
                  <span style={{ display: window.innerWidth < 600 ? "none" : "inline" }}>{auth.name.split(" ")[0]}</span>
                  <Icon name="chevron_down" size={14} />
                </button>
                {userMenu && (
                  <div onClick={() => setUserMenu(false)}
                    style={{
                      position: "absolute", top: "calc(100% + 8px)", right: 0,
                      background: "var(--bg-elev)", border: "1px solid var(--line)",
                      borderRadius: 12, boxShadow: "var(--shadow-2)", minWidth: 220,
                      padding: 8, zIndex: 100,
                    }}>
                    <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", marginBottom: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{auth.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-4)" }}>{auth.email}</div>
                      <div style={{ marginTop: 6 }}>
                        <span className={`tag ${auth.role === "buyer" ? "tag-ok" : "tag-info"} tag-dot`}>
                          {auth.role === "buyer" ? "Cliente comprador" : "Cliente cotizador"}
                        </span>
                      </div>
                    </div>
                    {[
                      { label: "Mi cuenta", to: "/cuenta", icon: "user" },
                      { label: "Mis órdenes", to: "/cuenta/ordenes", icon: "receipt" },
                      { label: "Cotizaciones", to: "/cuenta/cotizaciones", icon: "quote" },
                      { label: "Favoritos", to: "/cuenta/favoritos", icon: "heart_outline" },
                    ].map((m) => (
                      <button key={m.to} onClick={() => navigate(m.to)}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, width: "100%",
                          padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 500,
                          color: "var(--ink-2)", textAlign: "left",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-soft)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <Icon name={m.icon} size={15} />
                        {m.label}
                      </button>
                    ))}
                    <div style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 4 }}>
                      <button onClick={() => { logout(); navigate("/"); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, width: "100%",
                          padding: "10px 12px", borderRadius: 8, fontSize: 14, fontWeight: 500,
                          color: "var(--ink-3)", textAlign: "left",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-soft)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <Icon name="log_out" size={15} />
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button className="appbar-iconbtn appbar-burger" onClick={() => setMobile((m) => !m)} aria-label="Menú">
              <Icon name={mobile ? "x" : "menu"} size={18} />
            </button>
          </div>
        </div>
      </header>

      {mobile && (
        <div className="mobile-menu" onClick={(e) => { if (e.target.tagName === "A") setMobile(false); }}>
          <Link to="/catalogo">Catálogo</Link>
          <Link to="/colecciones">Colecciones</Link>
          <Link to="/lookbook">Lookbook</Link>
          <Link to="/servicios">Servicios</Link>
          <Link to="/conocenos">Nosotros</Link>
          {auth && (
            <>
              <Link to="/cuenta">Mi cuenta</Link>
              <Link to="/cotizacion">Mi cotización</Link>
              {auth.role === "buyer" && <Link to="/carrito">Mi carrito</Link>}
            </>
          )}
        </div>
      )}
    </>
  );
}

/* -------- ROLE BANNER (shows current simulated role) -------- */
function RoleBanner() {
  const { auth, setRole } = useApp();
  if (!auth) return null;
  return (
    <div className="role-banner">
      <div className="container">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ opacity: 0.7 }}>Modo simulación · sesión iniciada como</span>
          <span className="role-tag">{auth.role === "buyer" ? "CLIENTE COMPRADOR" : "CLIENTE COTIZADOR"}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ opacity: 0.5 }}>Cambiar rol:</span>
          <button
            onClick={() => setRole("buyer")}
            style={{
              padding: "4px 10px", borderRadius: 999, fontSize: 11, fontFamily: "var(--font-mono)",
              background: auth.role === "buyer" ? "var(--accent)" : "transparent",
              color: auth.role === "buyer" ? "var(--accent-ink)" : "rgba(244,242,236,0.7)",
              border: `1px solid ${auth.role === "buyer" ? "var(--accent)" : "rgba(244,242,236,0.2)"}`,
              fontWeight: 600,
            }}
          >COMPRADOR</button>
          <button
            onClick={() => setRole("quoter")}
            style={{
              padding: "4px 10px", borderRadius: 999, fontSize: 11, fontFamily: "var(--font-mono)",
              background: auth.role === "quoter" ? "var(--accent)" : "transparent",
              color: auth.role === "quoter" ? "var(--accent-ink)" : "rgba(244,242,236,0.7)",
              border: `1px solid ${auth.role === "quoter" ? "var(--accent)" : "rgba(244,242,236,0.2)"}`,
              fontWeight: 600,
            }}
          >COTIZADOR</button>
        </div>
      </div>
    </div>
  );
}

/* -------- FOOTER -------- */
function Footer() {
  return (
    <footer className="footer" data-screen-label="Footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <Logo />
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>
                Generando·Ideas
              </span>
            </div>
            <p style={{ color: "var(--ink-3)", maxWidth: 320, fontSize: 14, lineHeight: 1.55 }}>
              Empresa 100% mexicana líder en la industria promocional desde 2013. Producción, fulfillment y proyectos especiales.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              {["LI", "IG", "FB"].map(s => (
                <div key={s} style={{
                  width: 36, height: 36, borderRadius: 8, border: "1px solid var(--line)",
                  display: "grid", placeItems: "center", fontFamily: "var(--font-mono)",
                  fontSize: 11, fontWeight: 600, color: "var(--ink-3)", cursor: "pointer",
                }}>{s}</div>
              ))}
            </div>
          </div>
          <div>
            <h4>Productos</h4>
            <ul>
              <li><a href="#/catalogo">Catálogo completo</a></li>
              <li><a href="#/colecciones">Colecciones</a></li>
              <li><a href="#/colecciones/maxema">Maxema</a></li>
              <li><a href="#/colecciones/agendas">Agendas 2026</a></li>
              <li><a href="#/colecciones/textiles">Textiles</a></li>
            </ul>
          </div>
          <div>
            <h4>Servicios</h4>
            <ul>
              <li><a href="#/servicios">Promocionales</a></li>
              <li><a href="#/servicios">Fulfillment</a></li>
              <li><a href="#/servicios">Proyectos especiales</a></li>
              <li><a href="#/servicios">Personalizado</a></li>
              <li><a href="#/servicios">Textil & talabartería</a></li>
            </ul>
          </div>
          <div>
            <h4>Compañía</h4>
            <ul>
              <li><a href="#/conocenos">Quiénes somos</a></li>
              <li><a href="#/contacto">Contacto</a></li>
              <li><a href="#/responsabilidad">Responsabilidad social</a></li>
              <li><a href="#/privacidad">Aviso de privacidad</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-legal">
          <span>©2026 Generando Ideas · México</span>
          <span>v2.0 · Powered by Remix + Shopify</span>
        </div>
      </div>
    </footer>
  );
}

/* -------- PRODUCT CARD -------- */
function ProductCard({ product, view = "grid", onClick }) {
  const { auth, favs, toggleFav, addToCart, addToQuote } = useApp();
  const { navigate } = useRouter();
  const toast = useToast();
  const isFav = favs.includes(product.id);
  const showPrice = !!auth;
  const canBuy = auth?.role === "buyer";

  const goToProduct = () => navigate(`/producto/${product.id}`);

  const handleAdd = (e) => {
    e.stopPropagation();
    if (!auth) { navigate("/login"); return; }
    if (canBuy) {
      addToCart(product, product.moq, { color: product.colors[0] });
      toast(`${product.name} agregado al carrito`, { icon: "cart", accent: true });
    } else {
      addToQuote(product, product.moq, { color: product.colors[0] });
      toast(`${product.name} agregado a tu cotización`, { icon: "quote", accent: true });
    }
  };

  if (view === "list") {
    return (
      <div className="pcard-list lift" onClick={goToProduct}>
        <PH tint={product.tint} src={product.image} alt={product.name} zoom />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {product.new && <span className="tag tag-accent">Nuevo</span>}
            {product.bestseller && <span className="tag tag-ink">Bestseller</span>}
          </div>
          <div className="pcard-name">{product.name}</div>
          <div className="pcard-sku">{product.id} · MOQ {product.moq} pz</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {product.colors.slice(0, 5).map((c) => {
              const color = window.GI_DATA.COLORS.find(x => x.id === c);
              return <div key={c} style={{ width: 16, height: 16, borderRadius: "50%", background: color?.hex, border: "1px solid rgba(20,17,10,0.1)" }} />;
            })}
          </div>
        </div>
        <div className="pcard-list-actions">
          {showPrice ? (
            <div style={{ textAlign: "right" }}>
              <div className="pcard-price-from">Desde</div>
              <div className="pcard-price">{window.GI_FORMAT_PRICE(product.price)}</div>
            </div>
          ) : (
            <div className="pcard-quote-label"><Icon name="eye_off" size={11} /> Inicia sesión</div>
          )}
          <Button variant={canBuy ? "accent" : "primary"} size="sm" icon={canBuy ? "cart" : "quote"} onClick={handleAdd}>
            {!auth ? "Ver detalles" : canBuy ? "Agregar" : "Cotizar"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pcard" onClick={goToProduct}>
      <div className="pcard-img">
        <PH tint={product.tint} src={product.image} alt={product.name} zoom />
        <div className="pcard-badges">
          {product.new && <span className="tag tag-accent">Nuevo</span>}
          {product.bestseller && <span className="tag tag-ink">Bestseller</span>}
        </div>
        <button className={`pcard-fav ${isFav ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); toggleFav(product.id); }} aria-label="Favorito">
          <Icon name={isFav ? "heart_fill" : "heart_outline"} size={16} />
        </button>
        <div className="pcard-quickactions">
          <Button variant={canBuy ? "accent" : "primary"} size="sm" icon={canBuy ? "plus" : "quote"} onClick={handleAdd} className="grow">
            {!auth ? "Ver detalles" : canBuy ? "Añadir al carrito" : "Añadir a cotización"}
          </Button>
        </div>
      </div>
      <div className="pcard-info">
        <div className="pcard-sku">{product.id} · MOQ {product.moq} pz</div>
        <div className="pcard-name">{product.name}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {product.colors.slice(0, 5).map((c) => {
            const color = window.GI_DATA.COLORS.find(x => x.id === c);
            return <div key={c} style={{ width: 14, height: 14, borderRadius: "50%", background: color?.hex, border: "1px solid rgba(20,17,10,0.1)" }} />;
          })}
        </div>
        <div className="pcard-foot">
          {showPrice ? (
            <div>
              <span className="pcard-price-from">desde</span>
              <span className="pcard-price">{window.GI_FORMAT_PRICE(product.price)}</span>
            </div>
          ) : (
            <span className="pcard-quote-label">
              <Icon name="eye_off" size={11} /> Precio para clientes
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------- CATEGORY ICON STRIP -------- */
function CategoryIcon({ name, size = 24 }) {
  return <Icon name={name} size={size} strokeWidth={1.5} />;
}

Object.assign(window, {
  Icon, Logo, Button, PH, Img, CountUp,
  ToastProvider, useToast,
  AppProvider, useApp,
  RouterProvider, useRouter, Link,
  Header, Footer, RoleBanner,
  ProductCard, CategoryIcon,
});
