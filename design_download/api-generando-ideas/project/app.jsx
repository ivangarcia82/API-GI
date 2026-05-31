/* ============================================================
   APP — Router + Tweaks + Layout
   ============================================================ */

const { useState, useEffect } = React;

function App() {
  const { path } = useRouter();
  const { auth } = useApp();
  const cleanPath = path.split("?")[0];

  // ROUTING
  let screen;
  if (cleanPath === "/" || cleanPath === "") screen = <HomeScreen />;
  else if (cleanPath === "/login") screen = <LoginScreen />;
  else if (cleanPath === "/registro") screen = <RegisterScreen />;
  else if (cleanPath === "/catalogo" || cleanPath.startsWith("/catalogo")) screen = <CatalogScreen />;
  else if (cleanPath === "/colecciones") screen = <CollectionsScreen />;
  else if (cleanPath === "/lookbook") screen = <LookbookScreen />;
  else if (cleanPath.startsWith("/colecciones/")) {
    const id = cleanPath.replace("/colecciones/", "");
    screen = <CollectionDetailScreen collectionId={id} />;
  }
  else if (cleanPath.startsWith("/producto/")) {
    const id = cleanPath.replace("/producto/", "");
    screen = <ProductScreen productId={id} />;
  }
  else if (cleanPath === "/carrito") screen = <CartScreen />;
  else if (cleanPath === "/cotizacion") screen = <QuoteScreen />;
  else if (cleanPath === "/cuenta") screen = <AccountScreen subRoute="overview" />;
  else if (cleanPath.startsWith("/cuenta/")) {
    const sub = cleanPath.replace("/cuenta/", "");
    screen = <AccountScreen subRoute={sub} />;
  }
  else if (cleanPath === "/servicios") screen = <StubScreen title="Servicios" label="// Servicios · /servicios"
    desc="Promocionales · Fulfillment · Proyectos especiales · Talleres de personalizado · Fabricación textil & talabartería."
    items={[
      { t: "Promocionales", d: "Catálogo de 1,800+ productos personalizables con producción 8-15 días." },
      { t: "Fulfillment", d: "Almacenaje, kitting y envíos individuales con tu identidad de marca." },
      { t: "Proyectos especiales", d: "Producción a medida: empaques, displays, materiales POP corporativos." },
      { t: "Talleres de personalizado", d: "Activaciones en vivo: serigrafía, grabado y bordado on-site para tus eventos." },
      { t: "Textil & Talabartería", d: "Fabricación nacional de uniformes, accesorios de piel y artículos corporativos." },
    ]} />;
  else if (cleanPath === "/conocenos") screen = <StubScreen title="Quiénes somos" label="// Conócenos · /conocenos"
    desc="Empresa 100% mexicana líder en la industria promocional desde 2013."
    items={[
      { t: "Misión", d: "Crear soluciones promocionales que generen impacto y memoria de marca." },
      { t: "Visión", d: "Ser el aliado estratégico de las marcas que valoran calidad, diseño y propósito." },
      { t: "Valores", d: "Calidad sin concesiones · Tiempo de respuesta · Innovación constante · Responsabilidad social." },
    ]} />;
  else if (cleanPath === "/contacto") screen = <ContactScreen />;
  else screen = <NotFoundScreen />;

  const hideChrome = cleanPath === "/login" || cleanPath === "/registro";

  return (
    <>
      <Header />
      {auth && !hideChrome && <RoleBanner />}
      <main style={{ minHeight: "60vh" }} key={cleanPath} className="fade-in">
        {screen}
      </main>
      {!hideChrome && <Footer />}
      <TweaksController />
    </>
  );
}

/* ----------- STUB SCREENS ----------- */
function StubScreen({ title, label, desc, items }) {
  return (
    <div className="container" data-screen-label={title} style={{ padding: "40px 0 80px" }}>
      <div className="eyebrow">{label}</div>
      <h1 style={{
        fontFamily: "var(--font-display)", fontWeight: 700,
        fontSize: "clamp(48px, 7vw, 96px)", letterSpacing: "-0.035em",
        lineHeight: 0.95, margin: "12px 0 16px", maxWidth: 900,
      }}>{title}</h1>
      <p style={{ color: "var(--ink-3)", fontSize: 17, maxWidth: 600 }}>{desc}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 56 }} className="stagger">
        {items.map((it, i) => (
          <div key={i} style={{
            background: "var(--bg-elev)", border: "1px solid var(--line)",
            borderRadius: 16, padding: 32,
          }} className="lift">
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {String(i + 1).padStart(2, "0")} · {it.t.split(" ")[0]}
            </div>
            <h3 style={{
              fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24,
              letterSpacing: "-0.015em", margin: "12px 0 8px",
            }}>{it.t}</h3>
            <p style={{ color: "var(--ink-3)", margin: 0, fontSize: 15, lineHeight: 1.55 }}>{it.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactScreen() {
  const toast = useToast();
  return (
    <div className="container" data-screen-label="10 Contact" style={{ padding: "40px 0 80px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56 }}>
        <div>
          <div className="eyebrow">// Contacto · /contacto</div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "clamp(48px, 7vw, 96px)", letterSpacing: "-0.035em",
            lineHeight: 0.9, margin: "12px 0 16px",
          }}>Hablemos.</h1>
          <p style={{ color: "var(--ink-3)", fontSize: 17 }}>
            Cuéntanos sobre tu proyecto. Un asesor responde en menos de 2 horas hábiles.
          </p>

          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { i: "chat", l: "WhatsApp", v: "+52 (55) 7098 8100" },
              { i: "receipt", l: "Correo", v: "marketing@generandoideas.com" },
              { i: "truck", l: "Oficinas", v: "CDMX · Yucatán · Sonora · Baja California Sur" },
            ].map((c) => (
              <div key={c.l} style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, background: "var(--bg-soft)",
                  display: "grid", placeItems: "center",
                }}>
                  <Icon name={c.i} size={18} />
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{c.l}</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{c.v}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: "var(--bg-elev)", border: "1px solid var(--line)",
          borderRadius: 16, padding: 32,
        }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, margin: "0 0 24px", letterSpacing: "-0.015em" }}>
            Envíanos un mensaje
          </h3>
          <form onSubmit={(e) => { e.preventDefault(); toast("Mensaje enviado · te contactaremos pronto", { icon: "check", accent: true }); }}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field"><label>Nombre</label><input className="input" required /></div>
              <div className="field"><label>Empresa</label><input className="input" required /></div>
            </div>
            <div className="field"><label>Correo</label><input className="input" type="email" required /></div>
            <div className="field"><label>¿En qué te ayudamos?</label>
              <textarea className="input" rows="5" style={{ resize: "vertical", fontFamily: "inherit" }}
                placeholder="Cuéntanos sobre tu proyecto…" required></textarea>
            </div>
            <Button type="submit" variant="primary" size="lg" iconRight="arrow_right" style={{ justifyContent: "center" }}>
              Enviar mensaje
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function NotFoundScreen() {
  const { navigate } = useRouter();
  return (
    <div className="container" style={{ padding: "120px 0", textAlign: "center" }} data-screen-label="404">
      <div className="eyebrow">// 404 · página no encontrada</div>
      <h1 style={{
        fontFamily: "var(--font-display)", fontWeight: 700,
        fontSize: "clamp(80px, 16vw, 240px)", letterSpacing: "-0.04em",
        lineHeight: 0.9, margin: "12px 0 16px", color: "var(--ink)",
      }}>
        4<span style={{ color: "var(--accent-deep)" }}>0</span>4
      </h1>
      <p style={{ color: "var(--ink-3)", fontSize: 17, marginBottom: 32 }}>
        Esa ruta no existe. Pero tenemos 1,847 productos esperándote.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <Button variant="primary" iconRight="arrow_right" onClick={() => navigate("/")}>Ir al inicio</Button>
        <Button variant="ghost" onClick={() => navigate("/catalogo")}>Ver catálogo</Button>
      </div>
    </div>
  );
}

/* ----------- TWEAKS ----------- */
const DEFAULTS = /*EDITMODE-BEGIN*/{
  "role": "buyer",
  "accent": "#f5b800",
  "density": "comfortable",
  "showRoleBanner": true,
  "fontPair": "bricolage+manrope"
}/*EDITMODE-END*/;

const ACCENTS = ["#f5b800", "#d97757", "#1f8a5b", "#2a6fdb", "#7a4ee0"];

function TweaksController() {
  const { auth, login, setRole: appSetRole } = useApp();
  const [t, setTweak] = useTweaks(DEFAULTS);

  // Apply accent color
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", t.accent);
    const accentDeep = darkenHex(t.accent, 0.15);
    const accentSoft = lightenHex(t.accent, 0.85);
    document.documentElement.style.setProperty("--accent-deep", accentDeep);
    document.documentElement.style.setProperty("--accent-soft", accentSoft);
  }, [t.accent]);

  // Apply density
  useEffect(() => {
    document.documentElement.dataset.density = t.density;
  }, [t.density]);

  // Apply banner visibility
  useEffect(() => {
    document.documentElement.dataset.banner = t.showRoleBanner ? "on" : "off";
  }, [t.showRoleBanner]);

  // Apply role to auth
  useEffect(() => {
    if (auth && auth.role !== t.role) appSetRole(t.role);
  }, [t.role, auth]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Rol simulado">
        <TweakRadio label="Tipo" value={t.role} onChange={(v) => setTweak("role", v)}
          options={[
            { value: "buyer", label: "Comprador" },
            { value: "quoter", label: "Cotizador" },
          ]} />
        {!auth && (
          <TweakButton label="Iniciar sesión rápido"
            onClick={() => login({ name: "Mariana Ruiz", email: "mariana@empresa.mx", company: "Acme Corp", role: t.role })} />
        )}
      </TweakSection>

      <TweakSection label="Color de acento">
        <TweakColor label="Accent" value={t.accent} options={ACCENTS} onChange={(v) => setTweak("accent", v)} />
      </TweakSection>

      <TweakSection label="Densidad">
        <TweakRadio label="Spacing" value={t.density} onChange={(v) => setTweak("density", v)}
          options={[
            { value: "comfortable", label: "Cómodo" },
            { value: "compact", label: "Compacto" },
          ]} />
      </TweakSection>

      <TweakSection label="Banner de modo simulación">
        <TweakToggle label="Visible" value={t.showRoleBanner} onChange={(v) => setTweak("showRoleBanner", v)} />
      </TweakSection>
    </TweaksPanel>
  );
}

/* ----------- COLOR HELPERS ----------- */
function darkenHex(hex, amt) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const nr = Math.round(r * (1 - amt));
  const ng = Math.round(g * (1 - amt));
  const nb = Math.round(b * (1 - amt));
  return `#${[nr, ng, nb].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
function lightenHex(hex, amt) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const nr = Math.round(r + (255 - r) * amt);
  const ng = Math.round(g + (255 - g) * amt);
  const nb = Math.round(b + (255 - b) * amt);
  return `#${[nr, ng, nb].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/* ----------- BOOT ----------- */
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <RouterProvider>
    <AppProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AppProvider>
  </RouterProvider>
);
