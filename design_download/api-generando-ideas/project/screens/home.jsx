/* ============================================================
   HOME SCREEN — Landing público (v2: dynamic + photo-rich)
   ============================================================ */

const { useState, useEffect, useRef, useMemo } = React;

/* useInView — scroll-reveal */
function useInView(opts = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        obs.disconnect();
      }
    }, { threshold: 0.15, ...opts });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

/* Floating image collage that cycles */
function HeroCollage() {
  const { HERO_IMAGES, PRODUCTS } = window.GI_DATA;
  const [mainIdx, setMainIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setMainIdx((i) => (i + 1) % HERO_IMAGES.length);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const mainImg = HERO_IMAGES[mainIdx];
  const secondaryImg = HERO_IMAGES[(mainIdx + 2) % HERO_IMAGES.length];
  const tertiaryImg = HERO_IMAGES[(mainIdx + 4) % HERO_IMAGES.length];

  const featured = PRODUCTS[mainIdx % PRODUCTS.length];

  return (
    <div className="hero-collage">
      {/* Main rotating card */}
      <div className="hc-main">
        {HERO_IMAGES.map((src, i) => (
          <img key={i} src={src} alt=""
            style={{
              opacity: i === mainIdx ? 1 : 0,
              transform: i === mainIdx ? "scale(1)" : "scale(1.04)",
            }}
          />
        ))}
        <div className="hc-main-meta">
          <div className="hc-sku">{featured.id}</div>
          <div className="hc-name">{featured.name}</div>
          <div className="hc-pr">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Desde</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
              {window.GI_FORMAT_PRICE(featured.price)}
            </span>
          </div>
        </div>
        <div className="hc-main-dots">
          {HERO_IMAGES.map((_, i) => (
            <button key={i} className={i === mainIdx ? "on" : ""} onClick={() => setMainIdx(i)} aria-label={`Producto ${i + 1}`} />
          ))}
        </div>
      </div>

      {/* Floating secondary card (top right) */}
      <div className="hc-float hc-float-1">
        <img src={secondaryImg} alt="" />
        <div className="hc-rating">
          <div style={{ display: "flex", gap: 1, color: "var(--accent-deep)" }}>
            {[0,1,2,3,4].map(s => <Icon key={s} name="star_fill" size={11} />)}
          </div>
          <span>4.9 · 1,240 reseñas</span>
        </div>
      </div>

      {/* Floating tertiary card (bottom left) */}
      <div className="hc-float hc-float-2">
        <img src={tertiaryImg} alt="" />
      </div>

      {/* Floating stat chip */}
      <div className="hc-chip hc-chip-1">
        <Icon name="bolt" size={14} />
        <div>
          <div className="hc-chip-l">Producción</div>
          <div className="hc-chip-v">8–15 días</div>
        </div>
      </div>
      <div className="hc-chip hc-chip-2">
        <Icon name="package" size={14} />
        <div>
          <div className="hc-chip-l">Catálogo</div>
          <div className="hc-chip-v">1,847 SKUs</div>
        </div>
      </div>

      {/* Decorative orbit */}
      <svg className="hc-orbit" viewBox="0 0 400 400" fill="none">
        <circle cx="200" cy="200" r="180" stroke="var(--accent)" strokeWidth="1" strokeDasharray="2 6" />
      </svg>
    </div>
  );
}

/* Image marquee — infinite scrolling product strip */
function ImageMarquee({ direction = "left", speed = 50 }) {
  const { PRODUCTS } = window.GI_DATA;
  const items = PRODUCTS.filter(p => p.image).slice(0, 12);
  const duplicated = [...items, ...items];
  return (
    <div className="img-marquee">
      <div className="img-marquee-track" style={{
        animationDuration: `${speed}s`,
        animationDirection: direction === "right" ? "reverse" : "normal",
      }}>
        {duplicated.map((p, i) => (
          <div key={i} className="img-marquee-item">
            <img src={p.image} alt={p.name} loading="lazy" />
            <div className="img-marquee-label">
              <span className="mm-sku">{p.id}</span>
              <span className="mm-nm">{p.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeScreen() {
  const { CATEGORIES, COLLECTIONS, PRODUCTS, REVIEWS, FAQ, LIFESTYLE } = window.GI_DATA;
  const { navigate } = useRouter();
  const { auth } = useApp();

  const featured = PRODUCTS.slice(0, 8);

  return (
    <div data-screen-label="01 Home">
      {/* HERO */}
      <section className="home-hero">
        <div className="container">
          <div className="home-hero-grid">
            <div>
              <div className="fade-up" style={{ animationDelay: "0ms" }}>
                <div className="home-hero-eyebrow">
                  <span className="tag-ink tag">v2.0</span>
                  <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
                    Catálogo 2026 disponible
                  </span>
                  <Icon name="arrow_right" size={14} className="muted-2" />
                </div>
              </div>

              <h1 className="fade-up" style={{ animationDelay: "80ms" }}>
                Promocionales<br />
                que <em>generan</em><br />
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2em" }}>
                  memoria.
                </span>
              </h1>

              <p className="home-hero-sub fade-up" style={{ animationDelay: "160ms" }}>
                Más de 1,800 productos personalizables para tu próxima campaña, kit de bienvenida
                o evento corporativo. Cotiza, aprueba arte y produce en una sola plataforma.
              </p>

              <div className="home-hero-actions fade-up" style={{ animationDelay: "220ms" }}>
                <Button variant="primary" size="lg" iconRight="arrow_right"
                  onClick={() => navigate("/catalogo")}>
                  Explorar catálogo
                </Button>
                <Button variant="ghost" size="lg" icon="quote"
                  onClick={() => navigate(auth ? "/cotizacion" : "/registro")}>
                  {auth ? "Solicitar cotización" : "Crear cuenta gratis"}
                </Button>
              </div>

              <div className="home-hero-meta fade-up stagger" style={{ animationDelay: "280ms" }}>
                <div>
                  <span className="n ticker"><CountUp to={1847} /></span>
                  <span className="l">Productos en catálogo</span>
                </div>
                <div>
                  <span className="n ticker"><CountUp to={12} suffix=" años" /></span>
                  <span className="l">En la industria</span>
                </div>
                <div>
                  <span className="n ticker"><CountUp to={420} suffix="+" /></span>
                  <span className="l">Clientes corporativos</span>
                </div>
                <div>
                  <span className="n ticker">8–15d</span>
                  <span className="l">Producción promedio</span>
                </div>
              </div>
            </div>

            <HeroCollage />
          </div>
        </div>
      </section>

      {/* IMAGE MARQUEE */}
      <div className="home-marquee-wrap">
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          textAlign: "center", color: "var(--ink-4)",
          textTransform: "uppercase", letterSpacing: "0.06em",
          padding: "20px 0 0",
        }}>
          // Una muestra del inventario · {PRODUCTS.length}+ productos disponibles
        </div>
        <ImageMarquee speed={60} />
      </div>

      {/* PRODUCT SPOTLIGHT */}
      <ProductSpotlight />

      {/* CATEGORIES */}
      <section className="section container" style={{ paddingTop: 60 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">// Catálogo · 01</div>
            <h2>Encuentra por categoría.</h2>
          </div>
          <p>Productos curados en 8 grandes familias, todas con opciones de personalización.</p>
        </div>
        <ScrollReveal>
          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <a key={c.id} href={`#/catalogo?cat=${c.id}`} className="cat-card cat-card-photo"
                onClick={(e) => { e.preventDefault(); navigate(`/catalogo?cat=${c.id}`); }}>
                <div className="cat-card-bg">
                  <img src={c.image} alt={c.name} loading="lazy" />
                </div>
                <div className="cat-card-overlay" />
                <div className="cat-card-arrow">
                  <Icon name="arrow_up_right" size={14} />
                </div>
                <div className="cat-card-bottom">
                  <div className="cat-card-name">{c.name}</div>
                  <div className="cat-card-count">{c.count} productos</div>
                </div>
              </a>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* FEATURED COLLECTIONS */}
      <section className="section container" style={{ paddingTop: 40 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">// Colecciones · 02</div>
            <h2>Líneas curadas para campañas precisas.</h2>
          </div>
          <p>Cada colección une calidad, oferta y propósito. Diseñadas por nuestro equipo creativo.</p>
        </div>
        <ScrollReveal>
          <div className="collections">
            {COLLECTIONS.slice(0, 3).map((c, i) => (
              <div key={c.id} className={`coll-card ${i === 0 ? "coll-card-large" : ""}`}
                onClick={() => navigate(`/colecciones/${c.id}`)}>
                <div className="coll-card-img">
                  <PH tint={c.tint} src={c.image} alt={c.name} zoom className={i === 0 ? "" : "ph-square"} />
                  <div className="coll-card-tag">// {String(i + 1).padStart(2, "0")}</div>
                </div>
                <div className="coll-card-info">
                  <div>
                    <div className="coll-card-name">{c.name}</div>
                    <div className="coll-card-meta">{c.subtitle} · {c.count} productos</div>
                  </div>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    display: "grid", placeItems: "center",
                    background: "var(--bg-soft)", color: "var(--ink)",
                    transition: "all 220ms cubic-bezier(0.16, 1, 0.3, 1)",
                  }}>
                    <Icon name="arrow_right" size={16} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
          <Button variant="ghost" size="lg" iconRight="arrow_right" onClick={() => navigate("/colecciones")}>
            Ver las 9 colecciones
          </Button>
        </div>
      </section>

      {/* LOOKBOOK */}
      <section className="section container" style={{ paddingTop: 40 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">// Lookbook · 03</div>
            <h2>Ediciones curadas por temporada.</h2>
          </div>
          <Button variant="ghost" iconRight="arrow_right" onClick={() => navigate("/lookbook")}>
            Ver lookbook completo
          </Button>
        </div>
        <LookbookGrid limit={6} />
      </section>

      {/* STATS BAND */}
      <StatsBand />

      {/* HOW IT WORKS — with lifestyle image */}
      <section className="section container">
        <div className="how">
          <div className="how-bg">
            <img src={LIFESTYLE.team} alt="" />
          </div>
          <div className="how-head">
            <div className="eyebrow">// Proceso · 03</div>
            <h2>De la idea al inventario,<br />en una plataforma.</h2>
          </div>
          <div className="how-steps">
            {[
              { num: "01", title: "Explora el catálogo", desc: "1,800+ productos visibles. Crea favoritos y compara opciones sin registro previo." },
              { num: "02", title: "Cotiza o compra", desc: "Compradores aprobados pagan directo. Clientes nuevos solicitan cotización con un clic." },
              { num: "03", title: "Aprueba arte", desc: "Subes tu logo, nuestro equipo prepara dummies digitales para tu validación en 24h." },
              { num: "04", title: "Recibe y rastrea", desc: "Producción 8-15 días. Fulfillment opcional con envíos individuales y reportería." },
            ].map((s, i) => (
              <div key={i} className="how-step">
                <div className="num">{s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="section container" style={{ paddingTop: 80 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">// Destacados · 04</div>
            <h2>Lo más cotizado este mes.</h2>
          </div>
          <Button variant="ghost" iconRight="arrow_right" onClick={() => navigate("/catalogo")}>
            Ver todos los productos
          </Button>
        </div>
        <ScrollReveal>
          <div className="product-grid">
            {featured.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* IMAGE MARQUEE 2 — reverse direction */}
      <div style={{ paddingTop: 24 }}>
        <ImageMarquee speed={70} direction="right" />
      </div>

      {/* CUSTOMIZER */}
      <CustomizerSection />

      {/* FEATURE STRIP — with lifestyle image */}
      <section className="section container">
        <div className="feat-strip-photo">
          <div className="feat-strip-img">
            <img src={LIFESTYLE.printing} alt="" />
            <div className="feat-strip-img-overlay" />
            <div className="feat-strip-img-meta">
              <div className="eyebrow" style={{ color: "var(--accent)" }}>// Producción</div>
              <h3 style={{
                fontFamily: "var(--font-display)", fontWeight: 700,
                fontSize: 32, letterSpacing: "-0.02em",
                color: "var(--bg-elev)", margin: "12px 0 0", maxWidth: 320,
                lineHeight: 1,
              }}>
                Producción nacional,<br />estándares globales.
              </h3>
            </div>
          </div>
          <div className="feat-strip-list">
            {[
              { icon: "shield", title: "Calidad garantizada", desc: "Inspección al 100% antes de envío. Reposición sin costo en cualquier defecto." },
              { icon: "truck", title: "Logística nacional", desc: "Cobertura en CDMX, Yucatán, Sonora y Baja California Sur. Fulfillment punto a punto." },
              { icon: "sparkle", title: "Diseño incluido", desc: "Dummies digitales y propuestas creativas sin costo para clientes registrados." },
            ].map((f, i) => (
              <div key={i} className="feat-row">
                <div className="feat-icon"><Icon name={f.icon} size={18} /></div>
                <div>
                  <h4>{f.title}</h4>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS with avatars */}
      <section className="section container">
        <div className="section-head">
          <div>
            <div className="eyebrow">// Clientes · 05</div>
            <h2>Confianza desde 2013.</h2>
          </div>
        </div>
        <ScrollReveal>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }} className="testimonials-grid">
            {REVIEWS.map((r, i) => (
              <div key={i} className="testi-card lift">
                <div style={{ display: "flex", gap: 2, color: "var(--accent-deep)" }}>
                  {[0,1,2,3,4].map(s => <Icon key={s} name="star_fill" size={14} />)}
                </div>
                <p style={{
                  margin: 0, fontSize: 17, lineHeight: 1.4,
                  fontFamily: "var(--font-display)", fontWeight: 500,
                  letterSpacing: "-0.01em",
                  flex: 1,
                }}>"{r.quote}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                  <img src={r.avatar} alt="" style={{
                    width: 44, height: 44, borderRadius: "50%", objectFit: "cover",
                    border: "2px solid var(--bg)",
                  }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>
                      {r.company}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* FAQ */}
      <section className="section container" style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 56 }} data-cols="2">
        <div>
          <div className="eyebrow">// FAQ · 06</div>
          <h2 style={{
            fontFamily: "var(--font-display)", fontWeight: 700,
            fontSize: "clamp(32px, 4.2vw, 56px)", letterSpacing: "-0.025em",
            lineHeight: 1, margin: "12px 0 24px",
          }}>Preguntas que ahorran tiempo.</h2>
          <Button variant="ghost" iconRight="arrow_right" onClick={() => navigate("/contacto")}>
            Hablar con un asesor
          </Button>
        </div>
        <div>
          <FAQAccordion items={FAQ} />
        </div>
      </section>

      {/* BIG CTA with lifestyle background */}
      <section className="container">
        <div className="big-cta-photo">
          <div className="big-cta-bg">
            <img src={LIFESTYLE.unboxing} alt="" />
          </div>
          <div className="big-cta-overlay" />
          <div style={{ position: "relative" }}>
            <div className="eyebrow" style={{ color: "var(--accent)" }}>// Empieza hoy</div>
            <h2 style={{ marginTop: 16 }}>
              Tu próxima campaña<br />
              empieza con un <em style={{ fontStyle: "italic", fontWeight: 400, color: "var(--accent)" }}>clic</em>.
            </h2>
            <div className="actions" style={{ position: "relative" }}>
              <Button variant="accent" size="lg" iconRight="arrow_right"
                onClick={() => navigate(auth ? "/catalogo" : "/registro")}>
                {auth ? "Ver catálogo" : "Crear cuenta gratis"}
              </Button>
              <Button variant="ghost" size="lg" icon="chat" onClick={() => navigate("/contacto")}
                style={{
                  color: "var(--bg-elev)", borderColor: "rgba(244,242,236,0.3)",
                  background: "rgba(255,255,255,0.05)",
                  backdropFilter: "blur(8px)",
                }}>
                Agendar demo
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ScrollReveal({ children, delay = 0 }) {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

function FAQAccordion({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((it, i) => (
        <div key={i} style={{
          borderTop: "1px solid var(--line)",
          borderBottom: i === items.length - 1 ? "1px solid var(--line)" : "none",
        }}>
          <button onClick={() => setOpen(open === i ? -1 : i)} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "24px 0", textAlign: "left", gap: 16,
          }}>
            <span style={{
              fontFamily: "var(--font-display)", fontSize: 22,
              fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.2,
            }}>{it.q}</span>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              display: "grid", placeItems: "center",
              background: open === i ? "var(--ink)" : "var(--bg-soft)",
              color: open === i ? "var(--bg-elev)" : "var(--ink)",
              transition: "all 220ms cubic-bezier(0.16, 1, 0.3, 1)",
              transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
              flexShrink: 0,
            }}>
              <Icon name="plus" size={14} />
            </div>
          </button>
          <div style={{
            maxHeight: open === i ? 200 : 0,
            overflow: "hidden",
            transition: "max-height 400ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <p style={{ paddingBottom: 24, color: "var(--ink-3)", margin: 0, maxWidth: 540 }}>{it.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

window.HomeScreen = HomeScreen;
window.ScrollReveal = ScrollReveal;
window.useInView = useInView;
