# Fusión gi-website-final → API-GI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar el sitio de marketing de `gi-website-final` (Astro) a la app Hydrogen de `API-GI` como rutas React, dejando "Catálogo" apuntando al catálogo Shopify existente, con header/footer unificados y un solo deploy.

**Architecture:** Una sola app Hydrogen (React Router 7). Las páginas de marketing se agregan como rutas file-based en `app/routes/`, todas envueltas en un contenedor `.gi-mkt` que **aísla los tokens y clases CSS del marketing** de las pantallas de comercio. El contenido estático se porta a `app/lib/site-content.js`. Las animaciones (GSAP + Lenis + reveal por IntersectionObserver) se portan a inicialización client-only. Header y footer se unifican reusando el shell existente (`PageLayout` → `GiHeader`/`GiFooter`).

**Tech Stack:** React 18, React Router 7, Shopify Hydrogen 2026.4.2 (Oxygen/Workers runtime), Vite, Vitest + @testing-library/react, GSAP + Lenis, Resend (vía `fetch`).

## Convención de este plan

Este es un **port fiel** de archivos que ya existen y están completos. Para las tareas de conversión de componentes/páginas, el plan da: ruta destino exacta, interfaz (props/consume/produce), datos que usa, **archivo Astro fuente a abrir**, reglas de transformación precisas y pasos de verificación — en lugar de reproducir 100+ líneas de JSX traducido por archivo. Para la infraestructura nueva/no trivial (motion, reveal, layout, datos, header, footer, formulario, CSP) el plan da **código completo**. El detalle por-componente (scripts, clases, hooks `data-*`) ya fue extraído y vive en el spec y en las notas de exploración; cada tarea lo referencia.

## Reglas de transformación Astro → React (aplican a TODA tarea de port)

1. Frontmatter (`---`) → imports de módulo + cuerpo del componente. `Astro.props` con defaults → `function C({ prop = default })`.
2. `class` → `className`. `class:list={['a', {b: cond}]}` → template string o helper `cx('a', cond && 'b')`.
3. `Astro.url.pathname` → `useLocation().pathname` de `react-router`.
4. `<a href>` interno → `<NavLink to>`/`<Link to>` de `react-router` (con `prefetch="intent"`); externos (`http…`, `mailto:`, `tel:`) quedan como `<a>`.
5. `set:html={svgString}` / `<Fragment set:html>` → renderizar el SVG como JSX directamente.
6. `getStaticPaths()` → no aplica; la ruta lee `useParams()` y hace el lookup en el loader (ver Tarea de cada página dinámica). `Astro.redirect('/x')` → `throw redirect('/x')` (de `react-router`) en el loader.
7. Los `<style>` scoped de cada `.astro` → mover a `app/styles/gi-marketing.css`, **prefijando cada selector con `.gi-mkt `** (ver Tarea 1.3). En el JSX NO se dejan `<style>` embebidos.
8. `<script>` cliente:
   - `.reveal` → lo maneja el hook global `useMarketingReveal()` del `MarketingLayout` (Tarea 1.5). No portar el IntersectionObserver por página.
   - Efectos GSAP (magnetic, parallax zoom, line-draw, stagger, count-up, carrusel) → `useEffect` client-only con cleanup, usando `app/lib/motion.js`. Cada uno guardado por `prefersReducedMotion()`. Ver componentes específicos.
   - `astro:before-swap` teardown → `return () => {...}` del `useEffect`.
9. Todo componente/página de marketing se renderiza dentro del wrapper `.gi-mkt` (lo provee `MarketingLayout`).

---

## Global Constraints

- **Runtime:** Oxygen (Workers-like). NO usar APIs de Node ni el SDK `resend`; usar `fetch`. Env vars vía `context.env`, nunca `process.env`.
- **Node engine:** `^22 || ^24` (ya declarado en package.json).
- **Rutas:** file-based (`@react-router/fs-routes`), archivos en `app/routes/`. Tests co-locados `*.test.{js,jsx}` NO se registran como rutas (ya ignorados en `app/routes.js`).
- **Idioma/marca:** todo el copy en español (es-MX). Marca "Generando Ideas". Acento = naranja `#ff8300`.
- **Aislamiento CSS:** todo estilo de marketing vive bajo `.gi-mkt`. No introducir tokens `--orange-*`, `--gray-*`, `--paper`, `--blue-*`, `--mint`, `--magenta`, `--max`, `--radius*`, `--shadow-sm/md/lg` en `:root` global — sólo bajo `.gi-mkt`.
- **Accesibilidad/motion:** respetar `prefers-reduced-motion` en toda animación (rama de fallback que muestra el estado final).
- **Estilo de código:** JS/JSX con JSDoc (no TS) para archivos nuevos en `app/`, siguiendo el patrón de API-GI. Prettier `@shopify/prettier-config`.
- **Commits:** uno por tarea, al final, tras verificar. Mensajes `feat:`/`chore:`/`test:`.
- **Verificación de build:** `npm run build` (`shopify hydrogen build --codegen`) debe compilar al cerrar cada fase.

---

## File Structure

**Nuevos archivos:**
- `app/lib/site-content.js` — contenido estático portado de `src/data/site.ts`.
- `app/lib/motion.js` — port de `src/lib/motion.ts` (GSAP + Lenis, client-only).
- `app/lib/format.js` — `formatCount` (port de `src/lib/format.ts`).
- `app/components/marketing/MarketingLayout.jsx` — wrapper `.gi-mkt` + `useMarketingReveal` + hooks de motion.
- `app/components/marketing/Reveal.jsx` — hook/util `useMarketingReveal` (o incluido en MarketingLayout).
- `app/components/marketing/CountUp.jsx` — count-up con decimales/prefijo/sufijo (IntersectionObserver).
- `app/components/marketing/MagneticButton.jsx` — wrapper botón magnético (GSAP quickTo).
- `app/components/marketing/SocialIcons.jsx` — port de `SocialIcons.astro`.
- `app/components/marketing/Hero.jsx`, `ServicesShowcase.jsx`, `ProcessSection.jsx`, `ImpactBand.jsx`, `TestimonialsCarousel.jsx`, `ClosingCTA.jsx`, `Ticker.jsx`, `MexicoMap.jsx`, `Logo.jsx` — ports de los `.astro` homónimos.
- `app/styles/gi-marketing.css` — tokens (bajo `.gi-mkt`) + clases globales + estilos scoped de todos los componentes/páginas de marketing (todo prefijado `.gi-mkt`).
- `app/routes/conocenos.jsx`, `servicios._index.jsx`, `servicios.$id.jsx`, `blog._index.jsx`, `blog.$slug.jsx`, `bolsa-de-trabajo._index.jsx`, `bolsa-de-trabajo.$id.jsx`, `api.contact.jsx` — rutas nuevas.
- Tests: `app/lib/site-content.test.js`, `app/lib/format.test.js`, `app/routes/api.contact.logic.test.js`, `app/components/marketing/navActive.test.js`.

**Archivos modificados:**
- `app/routes/_index.jsx` — reemplazar home comercial por home de marketing portado.
- `app/routes/contacto.jsx` — reemplazar por página de contacto portada.
- `app/components/gi/Header.jsx` — nav de marketing + acciones de comercio + `data-drawer-open` móvil.
- `app/components/gi/Footer.jsx` — footer de marketing (4 columnas + slogan + social).
- `app/root.jsx` — enlazar `gi-marketing.css`; montar init de motion; agregar GA + Brevo (con nonce).
- `app/entry.server.jsx` — CSP: permitir dominios de GA/GTM/Brevo.
- `package.json` — agregar `gsap`, `lenis`.
- `.env` / `.env.example` — `RESEND_API_KEY`, `CONTACT_EMAIL` (ya existe patrón de email en `~/lib/email/resend`).
- `public/` — copiar assets de marketing (`bannerupdated.jpg`, `promocionales.jpg`, `printshop.jpg`, `workshop.jpg`, `fulfillment.jpg`, `publicitas.jpg`, `banner.jpg`, `legal/aviso-de-privacidad-esi-2026.pdf`); verificar `/brand/logo-horizontal*.svg`.

---

## FASE 0 — Preparación

### Task 0.1: Rama de trabajo y dependencias

**Files:**
- Modify: `API-GI/package.json`

**Interfaces:**
- Produces: dependencias `gsap`, `lenis` disponibles; rama `feat/fusion-marketing`.

- [ ] **Step 1: Crear rama en el repo de API-GI**

Run:
```bash
cd "/Users/ivan/Documents/Generando Ideas/api/API-GI" && git checkout -b feat/fusion-marketing
```
Expected: `Switched to a new branch 'feat/fusion-marketing'`

- [ ] **Step 2: Instalar dependencias de animación**

Run:
```bash
cd "/Users/ivan/Documents/Generando Ideas/api/API-GI" && npm install gsap@^3.13.0 lenis@^1.3.23
```
Expected: se agregan a `dependencies` sin errores de peer deps.

- [ ] **Step 3: Verificar build base intacto**

Run: `cd "/Users/ivan/Documents/Generando Ideas/api/API-GI" && npm run build`
Expected: build de Hydrogen exitoso (línea final "build ... done" sin errores).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add gsap and lenis for marketing animations"
```

---

## FASE 1 — Cimientos (datos, estilos, motion, layout, extras)

### Task 1.1: Portar el contenido estático (`site-content.js`)

**Files:**
- Create: `app/lib/site-content.js`
- Test: `app/lib/site-content.test.js`
- Source: `gi-website-final/src/data/site.ts` (portar verbatim)

**Interfaces:**
- Produces (named exports): `BRAND`, `NAV_ITEMS`, `ROUTES`, `SERVICES`, `SERVICE_DETAILS`, `SERVICE_DETAIL_IDS`, `BLOG_POSTS`, `BLOG_CATEGORIES`, `JOBS`, `RECRUITMENT`, `RECRUITMENT_DISCLAIMER`, `TESTIMONIALS`, `OFFICES`, `SOCIAL_LINKS`, `BUSINESS_HOURS`, `TICKER_WORDS`, `IMAGES`.

- [ ] **Step 1: Escribir el test de integridad de datos**

```js
// app/lib/site-content.test.js
import {describe, it, expect} from 'vitest';
import * as C from './site-content';

describe('site-content', () => {
  it('exposes marketing collections with expected sizes', () => {
    expect(C.SERVICES).toHaveLength(5);
    expect(C.SERVICE_DETAIL_IDS).toEqual([
      'promo', 'print-shop', 'promotional-workshop', 'digital-evolution', 'importaciones',
    ]);
    expect(C.BLOG_POSTS.length).toBeGreaterThanOrEqual(6);
    expect(C.JOBS).toHaveLength(6);
    expect(C.OFFICES.map((o) => o.id)).toEqual(['cdmx', 'sonora', 'yucatan']);
    expect(C.NAV_ITEMS.map((n) => n.href)).toEqual([
      '/', '/conocenos', '/servicios', '/catalogo', '/blog', '/contacto',
    ]);
  });

  it('every SERVICE has a matching SERVICE_DETAILS entry', () => {
    for (const s of C.SERVICES) expect(C.SERVICE_DETAILS[s.id]).toBeTruthy();
  });

  it('ROUTES.estore points to the internal Shopify catalog', () => {
    expect(C.ROUTES.estore).toBe('/catalogo');
    expect(C.ROUTES.service('promo')).toBe('/servicios/promo');
  });

  it('does not export dropped flipbook/product data', () => {
    expect(C.CATALOGS).toBeUndefined();
    expect(C.PRODUCTS).toBeUndefined();
  });
});
```

- [ ] **Step 2: Ejecutar el test (debe fallar)**

Run: `npx vitest run app/lib/site-content.test.js`
Expected: FAIL — "Failed to resolve import './site-content'".

- [ ] **Step 3: Crear `app/lib/site-content.js`**

Copiar el contenido de `gi-website-final/src/data/site.ts` a JS con estos cambios:
- Quitar todas las anotaciones de tipo TS (`interface`, `: Type`, `Record<...>`, `as const`, etc.). Convertir `export const X: T[] = [...]` → `export const X = [...]`.
- **Omitir** por completo: `Catalog`/`CATALOGS`, `CATALOG_CATEGORIES`, `Product`/`PRODUCTS`, `PRODUCT_CATEGORIES` (flipbooks y catálogo estático descartados).
- Conservar verbatim (mismos valores): `IMAGES`, `BRAND`, `NAV_ITEMS` (labels: Inicio/Conócenos/Servicios/Catálogo/Blog/Contacto), `SERVICES`, `SERVICE_DETAILS`, `SERVICE_DETAIL_IDS`, `TESTIMONIALS`, `OFFICES`, `SOCIAL_LINKS`, `BUSINESS_HOURS`, `BLOG_POSTS`, `BLOG_CATEGORIES`, `JOBS`, `RECRUITMENT`, `RECRUITMENT_DISCLAIMER`, `TICKER_WORDS`.
- En `ROUTES`: mantener `home/about/services/catalog/blog/contact/careers/privacy` iguales; **cambiar `estore: 'https://api.generandoideas.com'` → `estore: '/catalogo'`**; mantener `service: (id) => \`/servicios/${id}\``.
- Encabezar el archivo con un comentario `// Portado de gi-website-final/src/data/site.ts — contenido estático de marketing.`

- [ ] **Step 4: Ejecutar el test (debe pasar)**

Run: `npx vitest run app/lib/site-content.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/site-content.js app/lib/site-content.test.js
git commit -m "feat: port static marketing content to site-content.js"
```

---

### Task 1.2: Portar `formatCount` y copiar assets

**Files:**
- Create: `app/lib/format.js`
- Test: `app/lib/format.test.js`
- Modify: `API-GI/public/` (copiar imágenes/PDF)
- Source: `gi-website-final/src/lib/format.ts`, `gi-website-final/public/*`

**Interfaces:**
- Produces: `formatCount({prefix, value, suffix, decimals})` → string.

- [ ] **Step 1: Escribir el test**

```js
// app/lib/format.test.js
import {describe, it, expect} from 'vitest';
import {formatCount} from './format';

describe('formatCount', () => {
  it('groups thousands with en-US separators', () => {
    expect(formatCount({value: 2700})).toBe('2,700');
    expect(formatCount({value: 67000})).toBe('67,000');
  });
  it('applies prefix, suffix and decimals', () => {
    expect(formatCount({prefix: '+', value: 12})).toBe('+12');
    expect(formatCount({value: 4.9, decimals: 1})).toBe('4.9');
    expect(formatCount({value: 140, suffix: '+'})).toBe('140+');
  });
});
```

- [ ] **Step 2: Ejecutar (debe fallar)**

Run: `npx vitest run app/lib/format.test.js`
Expected: FAIL — import no resuelto.

- [ ] **Step 3: Crear `app/lib/format.js`**

```js
// Portado de gi-website-final/src/lib/format.ts
export function formatCount({prefix = '', value, suffix = '', decimals = 0} = {}) {
  const n = Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${prefix}${n}${suffix}`;
}
```

- [ ] **Step 4: Ejecutar (debe pasar)**

Run: `npx vitest run app/lib/format.test.js`
Expected: PASS.

- [ ] **Step 5: Copiar assets de marketing a `public/`**

Run:
```bash
cd "/Users/ivan/Documents/Generando Ideas/api"
cp gi-website-final/public/bannerupdated.jpg gi-website-final/public/banner.jpg \
   gi-website-final/public/promocionales.jpg gi-website-final/public/printshop.jpg \
   gi-website-final/public/workshop.jpg gi-website-final/public/fulfillment.jpg \
   gi-website-final/public/publicitas.jpg API-GI/public/
mkdir -p API-GI/public/legal
cp gi-website-final/public/legal/aviso-de-privacidad-esi-2026.pdf API-GI/public/legal/
```
Expected: archivos copiados. (NO copiar `public/catalogos/*` — flipbooks descartados.)

- [ ] **Step 6: Verificar/reconciliar logo del footer**

Run: `ls -la "/Users/ivan/Documents/Generando Ideas/api/API-GI/public/brand/"`
El footer de marketing usa `/brand/logo-horizontal-blanco.svg` y el `Logo` usa `/brand/logo-horizontal.svg`. Si no existen en API-GI/public/brand, copiarlos:
```bash
cp "/Users/ivan/Documents/Generando Ideas/api/gi-website-final/public/brand/logo-horizontal.svg" \
   "/Users/ivan/Documents/Generando Ideas/api/gi-website-final/public/brand/logo-horizontal-blanco.svg" \
   "/Users/ivan/Documents/Generando Ideas/api/API-GI/public/brand/"
```
Expected: existen `logo-horizontal.svg` y `logo-horizontal-blanco.svg` en `API-GI/public/brand/`.

- [ ] **Step 7: Commit**

```bash
git add app/lib/format.js app/lib/format.test.js public/
git commit -m "feat: port formatCount and copy marketing assets"
```

---

### Task 1.3: Hoja de estilos de marketing aislada (`gi-marketing.css`)

**Files:**
- Create: `app/styles/gi-marketing.css`
- Source: `gi-website-final/src/styles/global.css`, `gi-website-final/src/styles/motion.css`, y los `<style>` scoped de cada componente/página `.astro`.

**Interfaces:**
- Produces: todas las clases de marketing (`.section`, `.wrap`, `.btn*`, `.eyebrow`, `.reveal`, `.services-grid`, `.testimonial*`, `.impact*`, `.process*`, `.closing*`, `.ticker*`, `.drawer*`, `.map*`, `.blog*`, `.job*`, `.svc*`, `.about*`, `.mv*`, `.certs*`, `.contact*`, `.form-*`, `.footer-slogan`, etc.) y los tokens de marketing, **todo bajo `.gi-mkt`**.

- [ ] **Step 1: Crear el archivo con los tokens bajo `.gi-mkt`**

Copiar el bloque `:root` completo de `global.css` pero como `.gi-mkt { ... }` (todos los `--blue-*`, `--orange-*`, `--magenta`, `--mint`, `--ink`, `--ink-soft`, `--gray-*`, `--paper`, `--paper-2`, `--white`, `--radius*`, `--shadow-sm/md/lg`, `--font-*`, `--max`). Valores verbatim (ver spec §9 y exploración). Ejemplo del inicio del archivo:
```css
/* Estilos de marketing (gi-website-final) — AISLADOS bajo .gi-mkt para no
   colisionar con los tokens/clases de comercio de API-GI (gi-tokens.css). */
.gi-mkt {
  --blue-900:#43454a; --blue-700:#636569; --blue-500:#85878c; --blue-100:#efeff0;
  --orange-700:#d96f00; --orange-500:#ff8300; --orange-300:#ffa64d; --orange-100:#ffe6cc;
  --magenta:#ff8300; --mint:#ffe6cc;
  --ink:#43454a; --ink-soft:#54565b;
  --gray-700:#636569; --gray-500:#8a8c91; --gray-300:#d9dadc; --gray-200:#e9eaeb; --gray-100:#f4f4f5;
  --paper:#fafafa; --paper-2:#f1f1f2; --white:#ffffff;
  --radius-sm:10px; --radius:18px; --radius-lg:28px; --radius-xl:40px;
  --shadow-sm:0 2px 8px rgba(67,69,74,.06); --shadow-md:0 12px 32px rgba(67,69,74,.10); --shadow-lg:0 28px 60px rgba(67,69,74,.14);
  --font-display:'Gantari',ui-sans-serif,system-ui,sans-serif;
  --font-body:'Open Sans',ui-sans-serif,system-ui,sans-serif;
  --font-mono:'Gantari',ui-sans-serif,system-ui,sans-serif;
  --font-slogan:'Bebas Neue','Gantari',sans-serif;
  --max:1280px;
  font-family: var(--font-body);
  color: var(--ink);
}
```

- [ ] **Step 2: Copiar el resto de `global.css` + `motion.css` prefijando selectores**

Reglas de transformación al pegar cada regla:
- Selectores de clase/elemento normales → prefijar con `.gi-mkt ` (ej. `.section {` → `.gi-mkt .section {`; `body {` → NO copiar reglas de `body/html/*` globales — ver abajo).
- **NO copiar** las reglas base globales `* { box-sizing }`, `html, body {...}`, `body {...}`, `img {...}`, `a {...}`, `button {...}` (API-GI ya tiene su reset). En su lugar, aplicar lo esencial al contenedor: agregar a `.gi-mkt`: `overflow-x: hidden;` y a `.gi-mkt img { max-width:100%; display:block; }`, `.gi-mkt a { color: inherit; text-decoration:none; }`, `.gi-mkt button { font-family:inherit; cursor:pointer; }`.
- `@keyframes` (`float`, `bob`, `scroll`, `pulse`, `pageIn`) → copiar **sin** prefijar (los keyframes son globales; renómbralos con sufijo `-mkt` para evitar choque, p.ej. `@keyframes floatMkt`, y actualiza sus usos dentro de `.gi-mkt`).
- `@media (...) { selector {...} }` → mantener el `@media`, prefijar los selectores internos con `.gi-mkt `.
- `@media (prefers-reduced-motion: reduce)` → mantener; prefijar selectores internos.
- `:focus-visible` → `.gi-mkt :focus-visible`.
- Incluir verbatim (prefijados): `.wrap`, `.display`, `.eyebrow`, `.btn`, `.btn-primary`, `.btn-accent`, `.btn-ghost`, `.btn-lg`, `.section`, `.section-head`, `.section-alt`, `.section-dark` (+ variantes), `.reveal`/`.reveal.in`, `.text-accent`, `.text-grad-word`, y todos los bloques de componentes usados (nav no—se reemplaza por GiHeader; ver Fase 2), servicios (`.services-grid`, `.svc`, `.svc-hero/-a/-b/-c/-d`, `.svc-decoration`, `.svc-num`, `.svc-cta`, `.svc-num-hero`), testimonios (`.testimonials`, `.testimonial-track`, `.testimonial`, `.avatar`, `.carousel-nav`, `.carousel-btn`, `.testi-progress`), impacto (`.impact-grid`, `.impact-cell`), proceso (`.process-list`, `.process-step`, `.proc-rail`, `.proc-path`), closing (`.closing*`, `.magnetic`), ticker (`.ticker`, `.ticker-marquee`, `.ticker-item`, `.ticker-dot`), drawer móvil (`.drawer*`), mapa (`.map-container`, `.map-svg`, `.map-pin-group`, `.map-ripple`, `.map-dot`, `.offices-wrap`, `.offices-list`, `.office`), formularios (`.form-grid`, `.field`, `.field input/textarea/select`, `.error`, `.err-msg`, `.form-success`, `.form-error`, `.form-privacy`), blog (`.blog-hero`, `.blog-h1`, `.cat-filter`, `.chip`, `.blog-feature*`, `.blog-grid`, `.blog-card*`, `.blog-empty`, `.article*`, `.prose*`), careers (`.careers*`, `.stat-band`, `.stat-n`, `.stat-label`, `.jobs-list`, `.job-row`, `.job-*`, `.apply*`, `.prose-list*`, `.li-mark-good`), conócenos (`.about*`, `.mv*`, `.diff*`, `.certs*`, `.value*`), footer slogan (`.footer-slogan`, `.footer-slogan .r`).
- Pegar `motion.css` (`.pin-track`, `.marquee`, `.magnetic` + su `@media reduced-motion`) prefijado.

- [ ] **Step 3: Copiar los `<style>` scoped de cada componente/página**

Abrir cada `.astro` con `<style>` y anexar sus reglas a `gi-marketing.css`, prefijando con `.gi-mkt `. Fuentes con estilos scoped a portar: `Hero.astro` (`.hero-cine`, `.hero-stage`), `ServicesShowcase.astro` (tonos + pinned, sólo si se usan), `ProcessSection.astro` (`.proc-*`, `[data-proc-line]`, hidden-step reduced-motion), `ImpactBand.astro` (`.impact-*`), `TestimonialsCarousel.astro` (`.testi-progress*`), `ClosingCTA.astro` (`.closing*`, `.magnetic`), `Ticker.astro`, `MobileMenu.astro` (`.drawer*`), `Logo.astro` (`.logo`), `SocialIcons.astro` (`.social-icons*`), `MexicoMap.astro` (`.map-pin-group*`), y las páginas (`conocenos`, `servicios/index`, `servicios/[id]`, `blog/index`, `blog/[slug]`, `bolsa-de-trabajo/index`, `bolsa-de-trabajo/[id]`, `contacto`) que traen estilos scoped propios (`.about*`, `.svc-*`, `.blog-*`, `.article*`, `.prose*`, `.careers*`, `.job*`, `.contact*`, etc.).

- [ ] **Step 4: Enlazar la hoja en `root.jsx`** (se hace en Task 1.7). Verificación de sintaxis:

Run: `npx stylelint app/styles/gi-marketing.css || true` (si no hay stylelint, saltar) y revisar visualmente que todo selector no-`@` empiece con `.gi-mkt`.

- [ ] **Step 5: Commit**

```bash
git add app/styles/gi-marketing.css
git commit -m "feat: add isolated marketing stylesheet scoped under .gi-mkt"
```

---

### Task 1.4: Portar el módulo de motion (GSAP + Lenis)

**Files:**
- Create: `app/lib/motion.js`
- Source: `gi-website-final/src/lib/motion.ts`

**Interfaces:**
- Produces: `initMotion()`, `destroyMotion()`, `prefersReducedMotion()`, y re-exports `gsap`, `ScrollTrigger`.
- Consumes: `gsap`, `lenis` (Task 0.1).

- [ ] **Step 1: Crear `app/lib/motion.js`**

```js
// Portado de gi-website-final/src/lib/motion.ts — GSAP + Lenis, client-only.
import Lenis from 'lenis';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let lenis = null;
let initialized = false;
const tickerCb = (time) => {
  if (lenis) lenis.raf(time * 1000);
};

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function initMotion() {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;
  if (prefersReducedMotion()) {
    ScrollTrigger.refresh();
    return;
  }
  lenis = new Lenis({duration: 1.1, smoothWheel: true});
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(tickerCb);
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.refresh();
}

export function destroyMotion() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
  gsap.ticker.remove(tickerCb);
  if (lenis) lenis.destroy();
  lenis = null;
  initialized = false;
}

export {gsap, ScrollTrigger};
```

- [ ] **Step 2: Verificar que importa sin romper SSR**

Nota: `motion.js` sólo debe usarse dentro de `useEffect` (cliente). No importarlo a nivel de módulo en componentes que corren en SSR salvo dentro de efectos. Verificación diferida al build (Task 1.7).

- [ ] **Step 3: Commit**

```bash
git add app/lib/motion.js
git commit -m "feat: port GSAP+Lenis motion module (client-only)"
```

---

### Task 1.5: `MarketingLayout` + hook de reveal

**Files:**
- Create: `app/components/marketing/MarketingLayout.jsx`
- Test: `app/components/marketing/navActive.test.js`

**Interfaces:**
- Produces:
  - `export default function MarketingLayout({children, className})` — envuelve en `<div className="gi-mkt {className}">`, dispara `useMarketingReveal()` y asegura `initMotion()`.
  - `export function useMarketingReveal()` — IntersectionObserver que agrega `.in` a `.gi-mkt .reveal:not(.in)`; corre en cada mount/navegación.
  - `export function isNavActive(href, pathname)` — helper de estado activo (port de la lógica de `Nav.astro`/`MobileMenu.astro`).
- Consumes: `initMotion` (Task 1.4).

- [ ] **Step 1: Escribir el test del helper de nav activo**

```js
// app/components/marketing/navActive.test.js
import {describe, it, expect} from 'vitest';
import {isNavActive} from './MarketingLayout';

describe('isNavActive', () => {
  it('matches home and servicios only exactly', () => {
    expect(isNavActive('/', '/')).toBe(true);
    expect(isNavActive('/', '/conocenos')).toBe(false);
    expect(isNavActive('/servicios', '/servicios')).toBe(true);
    expect(isNavActive('/servicios', '/servicios/promo')).toBe(false);
  });
  it('matches other routes on prefix', () => {
    expect(isNavActive('/blog', '/blog')).toBe(true);
    expect(isNavActive('/blog', '/blog/tendencias-2026')).toBe(true);
    expect(isNavActive('/conocenos', '/conocenos')).toBe(true);
  });
  it('ignores trailing slashes', () => {
    expect(isNavActive('/blog', '/blog/')).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar (debe fallar)**

Run: `npx vitest run app/components/marketing/navActive.test.js`
Expected: FAIL — import no resuelto.

- [ ] **Step 3: Crear `MarketingLayout.jsx`**

```jsx
import {useEffect} from 'react';
import {useLocation} from 'react-router';
import {initMotion} from '~/lib/motion';

/** Port de la lógica isActive() de Nav.astro/MobileMenu.astro. */
export function isNavActive(href, pathname) {
  const path = (pathname || '/').replace(/\/$/, '') || '/';
  if (href === '/' || href === '/servicios') return path === href;
  return path === href || path.startsWith(href + '/');
}

/** Reemplaza el IntersectionObserver `.reveal` del Layout.astro. Corre por navegación. */
export function useMarketingReveal() {
  const {pathname} = useLocation();
  useEffect(() => {
    const els = document.querySelectorAll('.gi-mkt .reveal:not(.in)');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      {threshold: 0.12},
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
}

export default function MarketingLayout({children, className = ''}) {
  useEffect(() => {
    initMotion();
  }, []);
  useMarketingReveal();
  return <div className={`gi-mkt ${className}`.trim()}>{children}</div>;
}
```

- [ ] **Step 4: Ejecutar el test (debe pasar)**

Run: `npx vitest run app/components/marketing/navActive.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/components/marketing/MarketingLayout.jsx app/components/marketing/navActive.test.js
git commit -m "feat: add MarketingLayout wrapper, reveal hook and nav-active helper"
```

---

### Task 1.6: Primitivas de marketing (`CountUp`, `MagneticButton`, `SocialIcons`, `Logo`)

**Files:**
- Create: `app/components/marketing/CountUp.jsx`, `MagneticButton.jsx`, `SocialIcons.jsx`, `Logo.jsx`
- Test: `app/components/marketing/CountUp.test.jsx`

**Interfaces:**
- Produces:
  - `CountUp({value, prefix='', suffix='', decimals=0, duration=1600})` — anima 0→value al entrar en viewport (IntersectionObserver, una vez); respeta reduced-motion (muestra final). Formatea con `formatCount`.
  - `MagneticButton({children, factor=0.35, className=''})` — wrapper `<span className="magnetic">` con efecto GSAP quickTo en `(pointer:fine)` + motion; cleanup en unmount.
  - `SocialIcons({variant='footer', className=''})` — port de `SocialIcons.astro` con `SOCIAL_LINKS`.
  - `Logo({variant='color', className='logo'})` — `<img>` a `/brand/logo-horizontal[-blanco].svg`.
- Consumes: `formatCount` (1.2), `gsap`/`prefersReducedMotion` (1.4), `SOCIAL_LINKS` (1.1).

- [ ] **Step 1: Escribir test de CountUp (fallback reduced-motion)**

```jsx
// app/components/marketing/CountUp.test.jsx
import {describe, it, expect, vi, beforeAll} from 'vitest';
import {render, screen} from '@testing-library/react';
import {CountUp} from './CountUp';

beforeAll(() => {
  // jsdom: forzar reduced-motion → CountUp muestra el valor final de inmediato.
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  }));
});

describe('CountUp', () => {
  it('renders the final formatted value under reduced motion', () => {
    render(<CountUp value={2700} prefix="+" />);
    expect(screen.getByText('+2,700')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar (debe fallar)**

Run: `npx vitest run app/components/marketing/CountUp.test.jsx`
Expected: FAIL — import no resuelto.

- [ ] **Step 3: Crear `CountUp.jsx`**

```jsx
import {useEffect, useRef, useState} from 'react';
import {formatCount} from '~/lib/format';
import {prefersReducedMotion} from '~/lib/motion';

export function CountUp({value, prefix = '', suffix = '', decimals = 0, duration = 1600}) {
  const ref = useRef(null);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setV(value);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let started = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          started = true;
          const start = performance.now();
          const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setV(value * eased);
            if (t < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      {threshold: 0.6},
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);
  const display = formatCount({
    prefix,
    value: decimals ? Number(v.toFixed(decimals)) : Math.round(v),
    suffix,
    decimals,
  });
  return <span ref={ref}>{display}</span>;
}
```
Nota: `performance.now()` es válido en cliente; el efecto sólo corre en cliente.

- [ ] **Step 4: Ejecutar test (debe pasar)**

Run: `npx vitest run app/components/marketing/CountUp.test.jsx`
Expected: PASS.

- [ ] **Step 5: Crear `MagneticButton.jsx`**

```jsx
import {useEffect, useRef} from 'react';

export function MagneticButton({children, factor = 0.35, className = ''}) {
  const ref = useRef(null);
  useEffect(() => {
    const wrap = ref.current;
    if (!wrap) return;
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(pointer: fine)').matches
    ) {
      return;
    }
    let ctx;
    let cleanup = () => {};
    import('~/lib/motion').then(({gsap}) => {
      const xTo = gsap.quickTo(wrap, 'x', {duration: 0.4, ease: 'power3'});
      const yTo = gsap.quickTo(wrap, 'y', {duration: 0.4, ease: 'power3'});
      const onMove = (e) => {
        const r = wrap.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * factor);
        yTo((e.clientY - (r.top + r.height / 2)) * factor);
      };
      const onLeave = () => {
        xTo(0);
        yTo(0);
      };
      wrap.addEventListener('pointermove', onMove);
      wrap.addEventListener('pointerleave', onLeave);
      cleanup = () => {
        wrap.removeEventListener('pointermove', onMove);
        wrap.removeEventListener('pointerleave', onLeave);
        gsap.killTweensOf(wrap);
      };
    });
    return () => cleanup();
  }, [factor]);
  return (
    <span ref={ref} className={`magnetic ${className}`.trim()}>
      {children}
    </span>
  );
}
```

- [ ] **Step 6: Crear `SocialIcons.jsx`**

Port de `SocialIcons.astro` (ver exploración §4): `function SocialIcons({variant='footer', className=''})`. Construir array `ITEMS` en orden instagram, facebook, linkedin, whatsapp desde `SOCIAL_LINKS`; objeto `PATHS` con los `d` de Simple Icons (copiar verbatim de `SocialIcons.astro` líneas 20–27). Render:
```jsx
<div className={`social-icons social-icons-${variant} ${className}`.trim()}>
  {ITEMS.map((it) => (
    <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer" aria-label={it.label} className="social-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={PATHS[it.key]} /></svg>
    </a>
  ))}
</div>
```

- [ ] **Step 7: Crear `Logo.jsx`**

```jsx
export function Logo({variant = 'color', className = 'logo'}) {
  const src = variant === 'blanco' ? '/brand/logo-horizontal-blanco.svg' : '/brand/logo-horizontal.svg';
  return <img className={className} src={src} alt="Generando Ideas" width={282} height={63} />;
}
```

- [ ] **Step 8: Commit**

```bash
git add app/components/marketing/CountUp.jsx app/components/marketing/CountUp.test.jsx app/components/marketing/MagneticButton.jsx app/components/marketing/SocialIcons.jsx app/components/marketing/Logo.jsx
git commit -m "feat: add marketing primitives (CountUp, MagneticButton, SocialIcons, Logo)"
```

---

### Task 1.7: Enlazar estilos + init de motion + GA + Brevo en `root.jsx`; CSP en `entry.server.jsx`

**Files:**
- Modify: `app/root.jsx`, `app/entry.server.jsx`

**Interfaces:**
- Consumes: `gi-marketing.css` (1.3), `nonce` (de `useNonce()`), CSP config existente.

- [ ] **Step 1: Enlazar `gi-marketing.css` en `root.jsx`**

En `app/root.jsx`, junto a los otros imports de estilos:
```jsx
import giMarketing from '~/styles/gi-marketing.css?url';
```
Y en el `<head>` del componente `Layout`, tras `giSections`:
```jsx
<link rel="stylesheet" href={giMarketing}></link>
```

- [ ] **Step 2: Montar init de motion (cliente)**

En `root.jsx`, dentro de `App()` (o `Layout`), agregar un efecto client-only. Import:
```jsx
import {useEffect} from 'react';
import {initMotion} from '~/lib/motion';
```
Y dentro de `App()`:
```jsx
useEffect(() => {
  initMotion();
}, []);
```
(Redundante con MarketingLayout pero inofensivo por ser idempotente; mantiene Lenis activo también donde no haya MarketingLayout.)

- [ ] **Step 3: Agregar Google Analytics con nonce**

En el `<head>` del componente `Layout` de `root.jsx` (que ya usa `const nonce = useNonce()`), agregar antes de `<Meta />`:
```jsx
<script async src="https://www.googletagmanager.com/gtag/js?id=G-4Z8RFG1DT0" nonce={nonce}></script>
<script
  nonce={nonce}
  dangerouslySetInnerHTML={{
    __html:
      "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-4Z8RFG1DT0');",
  }}
/>
```

- [ ] **Step 4: Agregar el widget de Brevo con nonce**

En el `<body>` del componente `Layout`, tras `{children}` y antes de `<Scripts>`:
```jsx
<script
  nonce={nonce}
  dangerouslySetInnerHTML={{
    __html:
      "(function(d,w,c){w.BrevoConversationsID='5e8cd971af0ac252357152dc';w[c]=w[c]||function(){(w[c].q=w[c].q||[]).push(arguments);};var s=d.createElement('script');s.async=true;s.src='https://conversations-widget.brevo.com/brevo-conversations.js';if(d.head)d.head.appendChild(s);})(document,window,'BrevoConversations');",
  }}
/>
```

- [ ] **Step 5: Ampliar la CSP en `entry.server.jsx`**

En el objeto pasado a `createContentSecurityPolicy`, agregar directivas `scriptSrc`, `connectSrc`, `frameSrc`, `imgSrc` (recordando re-incluir `'self'` y `cdn.shopify.com`). Basado en la config actual (ver exploración §1):
```jsx
scriptSrc: [
  "'self'", 'https://cdn.shopify.com',
  'https://www.googletagmanager.com', 'https://www.google-analytics.com',
  'https://conversations-widget.brevo.com',
],
connectSrc: [
  "'self'",
  'https://www.google-analytics.com', 'https://www.googletagmanager.com',
  'https://conversations-widget.brevo.com', 'https://api.brevo.com',
  'https://*.brevo.com',
],
frameSrc: ["'self'", 'https://conversations-widget.brevo.com'],
imgSrc: [
  "'self'", 'data:', 'https://cdn.shopify.com', 'https://images.unsplash.com',
  'https://www.google-analytics.com', 'https://www.googletagmanager.com', 'https://*.brevo.com',
],
```
(La `nonce` que ya inyecta Hydrogen sigue aplicando a los scripts inline de GA/Brevo — por eso llevan `nonce={nonce}`.)

- [ ] **Step 6: Verificar build**

Run: `cd "/Users/ivan/Documents/Generando Ideas/api/API-GI" && npm run build`
Expected: build exitoso.

- [ ] **Step 7: Verificar en dev que no hay bloqueos CSP**

Run: `npm run dev` (levanta en http://localhost:3000). Abrir la home, revisar consola del navegador: no debe haber errores CSP para `googletagmanager.com` ni `brevo.com`. Detener dev.
Expected: sin violaciones CSP; `window.gtag` definido; widget Brevo carga.

- [ ] **Step 8: Commit**

```bash
git add app/root.jsx app/entry.server.jsx
git commit -m "feat: wire marketing styles, motion init, GA and Brevo with CSP allowances"
```

---

## FASE 2 — Shell unificado (header + footer)

### Task 2.1: Header unificado (nav de marketing + acciones de comercio)

**Files:**
- Modify: `app/components/gi/Header.jsx`
- Source de referencia: `gi-website-final/src/components/Nav.astro`, `MobileMenu.astro`

**Interfaces:**
- Consumes: `useApp()` (existente), `NAV_ITEMS` opcional.
- Produces: header con nav marketing + búsqueda/cotización/cuenta; menú móvil con los mismos items.

- [ ] **Step 1: Reemplazar el arreglo `NAV` de `GiHeader`**

En `app/components/gi/Header.jsx`, cambiar:
```jsx
const NAV = [
  {to: '/', label: 'Inicio'},
  {to: '/conocenos', label: 'Conócenos'},
  {to: '/servicios', label: 'Servicios'},
  {to: '/catalogo', label: 'Catálogo'},
  {to: '/blog', label: 'Blog'},
  {to: '/contacto', label: 'Contacto'},
];
```
Mantener intactas las acciones existentes (búsqueda `openSearch`, cotización `openQuoteDrawer` + badge, login/registro, menú de cuenta, toggle móvil `setMobile`). El `NavLink` de `/` debe llevar `end` para no marcarse activo en subrutas.

- [ ] **Step 2: Añadir `end` al NavLink de Inicio**

En el `.map(NAV)`, para el item `/` pasar `end`:
```jsx
<NavLink key={n.to} to={n.to} prefetch="intent" end={n.to === '/'}>
  {n.label}
</NavLink>
```
Aplicar lo mismo en el bloque `.mobile-menu`.

- [ ] **Step 3: Verificar dev**

Run: `npm run dev` → abrir `/`. El header muestra Inicio · Conócenos · Servicios · Catálogo · Blog · Contacto y conserva búsqueda/cotización/cuenta. Click en "Catálogo" abre el catálogo Shopify (`/catalogo`). Detener dev.
Expected: nav correcto; comercio intacto.

- [ ] **Step 4: Commit**

```bash
git add app/components/gi/Header.jsx
git commit -m "feat: unify header nav with marketing routes"
```

---

### Task 2.2: Footer unificado (diseño marketing)

**Files:**
- Modify: `app/components/gi/Footer.jsx`
- Modify: `app/styles/gi-sections.css` (o `gi-tokens.css`) — estilos del footer con tokens de API-GI
- Source de referencia: `gi-website-final/src/components/Footer.astro`

**Interfaces:**
- Consumes: `BRAND`, `ROUTES`, `SERVICES` (1.1), `SocialIcons` (1.6).
- Produces: `GiFooter()` con 4 columnas (Contáctanos, Empresa, Servicios, Recursos) + slogan Bebas Neue + social + barra inferior.

- [ ] **Step 1: Reescribir `GiFooter`**

Reemplazar el cuerpo de `app/components/gi/Footer.jsx` portando `Footer.astro` (ver exploración §1) a JSX, usando `NavLink` para rutas internas y `<a target="_blank">` para e-store (ahora `/catalogo` interno → usar `NavLink`) y el PDF de privacidad. El footer NO va dentro de `.gi-mkt` (es global), así que:
- Usar tokens de API-GI (`--accent` en vez de `--orange-500`; ambos son `#ff8300`). El `--font-slogan` (Bebas Neue) ya existe en API-GI.
- Logo blanco: `<img src="/brand/logo-horizontal-blanco.svg" width={282} height={63} />`.
- Columna 1 "Contáctanos": `{BRAND.phone}`, `{BRAND.email}`, "CDMX · Sonora · Yucatán", `<SocialIcons variant="footer" />` (nota: SocialIcons vive fuera de `.gi-mkt`; sus estilos están bajo `.gi-mkt`, así que **añadir también** reglas mínimas de `.social-icons*` globales en gi-sections.css, o envolver el footer con `className="gi-mkt"` sólo para heredar esos estilos. **Decisión:** envolver el `<footer>` en `<div className="gi-mkt">` para reutilizar los estilos de `.social-icons*` y `.footer-slogan` ya definidos; el resto del footer usa clases propias de API-GI). Aplicar `className="footer"` dentro.
- Columna "Servicios": `SERVICES.map((s) => <li><NavLink to={ROUTES.service(s.id)}>{s.title}</NavLink></li>)`.
- Barra inferior: "© 2026 Generando Ideas. Todos los derechos reservados." + "100% Empresa Mexicana · ● MX".

- [ ] **Step 2: Añadir/ajustar estilos del footer**

En `gi-marketing.css` ya quedaron `.footer-slogan` y `.social-icons*` bajo `.gi-mkt`. Añadir bajo `.gi-mkt` las reglas de layout del footer que vivían en `global.css` (`.footer`, `.footer-grid`, `.footer h3`, `.footer ul`, `.footer-bottom`, `.footer-brand`) para que el footer envuelto en `.gi-mkt` se vea igual que en Astro. Copiar esas reglas de `global.css` prefijadas con `.gi-mkt`.

- [ ] **Step 3: Verificar dev en una página de comercio y una de marketing**

Run: `npm run dev` → revisar el footer en `/` y en `/catalogo`: 4 columnas, slogan naranja, social, barra inferior; sin estilos rotos. Detener dev.
Expected: footer consistente en ambos tipos de página.

- [ ] **Step 4: Commit**

```bash
git add app/components/gi/Footer.jsx app/styles/gi-marketing.css
git commit -m "feat: unify footer with marketing 4-column design"
```

---

## FASE 3 — Componentes y páginas de marketing

> Cada tarea de página: crear la ruta, importar `MarketingLayout` + componentes + datos, exportar `meta`, y (para páginas dinámicas) un `loader` que hace el lookup y `throw redirect(...)` si no existe. Envolver el contenido en `<MarketingLayout>`. Verificar en dev.

### Task 3.1: Componentes del home (Hero, ServicesShowcase, ProcessSection, ImpactBand, TestimonialsCarousel, ClosingCTA, Ticker)

**Files:**
- Create: `app/components/marketing/Hero.jsx`, `ServicesShowcase.jsx`, `ProcessSection.jsx`, `ImpactBand.jsx`, `TestimonialsCarousel.jsx`, `ClosingCTA.jsx`, `Ticker.jsx`
- Source: los `.astro` homónimos (ver exploración detallada, sección "COMPONENTS")

**Interfaces:**
- Produces: cada componente como export nombrado del mismo nombre. Consumen datos de `site-content.js`.
- Consumes: `CountUp`, `MagneticButton` (1.6), `motion.js` (1.4).

- [ ] **Step 1: `Ticker.jsx`** (trivial, sin script)

Port directo de `Ticker.astro`: render `.ticker` > `.ticker-marquee` con `TICKER_WORDS.map((w,i) => <span className="ticker-item">{w}{i<words.length-1 && <b className="ticker-dot"> · </b>}</span>)`, `aria-hidden`.

- [ ] **Step 2: `Hero.jsx`** (sin animación, sólo asegura motion)

Render `.hero-cine` > `.hero-stage` > `<img src="/bannerupdated.jpg" alt="…" width={1440} height={400} loading="eager" fetchPriority="high" decoding="async" />`. `fetchpriority` en JSX es `fetchPriority`.

- [ ] **Step 3: `ProcessSection.jsx`** (line-draw + stagger via useEffect)

Render `<section className="section section-dark" ref={secRef} data-proc>` con `.section-head` (eyebrow "Cómo trabajamos", h2 con `.text-accent`), `.proc-rail` > svg `.proc-path` con `<path>` `data-proc-line` + `.process-list` de 4 `.process-step[data-proc-step]` (steps locales del componente). `useEffect`: si `!prefersReducedMotion()`, importar `{gsap, ScrollTrigger}` de `~/lib/motion` y replicar las dos animaciones (line `strokeDashoffset` scrub + steps stagger once) del script de `ProcessSection.astro`; cleanup mata triggers. Rama reduced-motion: dejar steps visibles (CSS ya lo cubre bajo `.gi-mkt`).

- [ ] **Step 4: `ImpactBand.jsx`** (usa `CountUp`)

Render `<section className="section section-dark impact">` con `.section-head` (eyebrow "Por qué nos eligen", h2 con `.text-accent`) y `.impact-grid` de 4 `.impact-cell`, cada una `<strong className="impact-cell-n"><CountUp value={s.value} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals} /></strong><span>{s.label}</span>`. Stats locales (ver `ImpactBand.astro`): 12(+), 2700(+), 67000(+), 4.9(decimals 1).

- [ ] **Step 5: `ClosingCTA.jsx`** (usa `MagneticButton` + `.reveal`)

Render `<section className="section closing">` > `.wrap.closing-inner` con `h2.closing-h.reveal`, `p.closing-sub.reveal`, `.closing-cta.reveal` conteniendo `<MagneticButton><Link to={ROUTES.contact} className="btn btn-accent btn-lg">Cotizar <svg.../></Link></MagneticButton>` y `<Link to={ROUTES.estore} className="btn btn-ghost btn-lg">Ver e-store</Link>` (estore ahora interno → `Link`, sin target). Los `.reveal` los activa `useMarketingReveal`.

- [ ] **Step 6: `ServicesShowcase.jsx`** (layout mosaic; sólo el usado)

Port del branch `mosaic` de `ServicesShowcase.astro`: `.services-grid` mapeando `SERVICES`; clase por tarjeta: índice 0 → `svc svc-hero`; 1..4 → `svc svc-${String.fromCharCode(96+i)}` (a,b,c,d). Cada `<Link to={ROUTES.service(s.id)}>` con `.svc-decoration`, `.svc-num` (índice 0: `"01 — Servicio principal"` + clase `svc-num-hero`), `h3`, `p`, `.svc-cta` "Ver más" + SVG flecha inline. Sin script (mosaic no anima). Prop `layout='mosaic'` aceptada por compatibilidad; sólo implementar mosaic.

- [ ] **Step 7: `TestimonialsCarousel.jsx`** (auto-advance + botones, un solo componente)

Consolidar el script propio + el wiring del Layout (ver `TestimonialsCarousel.astro` y notas). Estructura: `<div>` con `.testimonials > .testimonial-track (ref)` mapeando `TESTIMONIALS` a `.testimonial` (blockquote + `.avatar` con `initials(company)` + meta), `.testi-progress > i (barRef)`, y `.carousel-nav` con botones prev/next. `useEffect` client-only: helper `initials`; si `!prefersReducedMotion()`, correr el loop rAF que crece `barRef.scaleX` en 5s y hace `trackRef.scrollTo(+step | 0)` (step = primera `.testimonial`.offsetWidth + 24), pausado por IntersectionObserver (threshold 0.2) y por `mouseenter/focusin`/`mouseleave/focusout` del contenedor. Botones prev/next: `onClick` → `trackRef.scrollBy({left: ∓460, behavior:'smooth'})`. Cleanup: cancelar rAF + desconectar IO.

- [ ] **Step 8: Verificar build (los componentes aún no montados)**

Run: `npm run build`
Expected: compila (los componentes se usarán en 3.2).

- [ ] **Step 9: Commit**

```bash
git add app/components/marketing/Hero.jsx app/components/marketing/ServicesShowcase.jsx app/components/marketing/ProcessSection.jsx app/components/marketing/ImpactBand.jsx app/components/marketing/TestimonialsCarousel.jsx app/components/marketing/ClosingCTA.jsx app/components/marketing/Ticker.jsx
git commit -m "feat: port home marketing components to React"
```

---

### Task 3.2: Home (`_index.jsx`) — reemplazo

**Files:**
- Modify (reemplazo total): `app/routes/_index.jsx`
- Source: `gi-website-final/src/pages/index.astro`

**Interfaces:**
- Consumes: componentes de 3.1, `MarketingLayout`, `SERVICES` para la sección de servicios.

- [ ] **Step 1: Reescribir `_index.jsx`**

Nuevo home (sin loader Shopify; contenido estático de marketing). Exportar `meta` (title "Generando Ideas - Your one stop solution", description del `index.astro`). Estructura dentro de `<MarketingLayout>`:
```jsx
<Hero />
<section className="section"><div className="wrap reveal">
  <div className="section-head">…eyebrow "Servicios" + h2 "Cinco servicios, <span className="text-accent">una sola relación.</span>" + p…</div>
  <ServicesShowcase layout="mosaic" />
</div></section>
<ProcessSection />
<ImpactBand />
<section className="section"><div className="wrap reveal">
  <div className="section-head">…eyebrow "Lo que dicen nuestros clientes" + h2 "Relaciones que <span className="text-accent">duran años.</span>"…</div>
  <TestimonialsCarousel />
</div></section>
<ClosingCTA />
```
**Omitir** la sección "Catálogos 2026" (flipbooks eliminados) — decisión confirmada. (No portar el bloque `home-cat-grid`.)

- [ ] **Step 2: Eliminar imports/loader viejos**

Quitar del archivo todo lo del home comercial anterior (loader Shopify, `HomeSections`, `ProductCard`, etc.). El home ya no necesita `loader`.

- [ ] **Step 3: Verificar dev**

Run: `npm run dev` → `/` renderiza el home de marketing: hero banner, servicios mosaic, proceso (línea animada), impacto (count-up), testimonios (auto-avance), closing (botón magnético). Reveal al hacer scroll. Detener dev.
Expected: home de marketing funcional; sin errores de consola.

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: compila.

- [ ] **Step 5: Commit**

```bash
git add app/routes/_index.jsx
git commit -m "feat: replace homepage with ported marketing home"
```

---

### Task 3.3: `/conocenos`

**Files:**
- Create: `app/routes/conocenos.jsx`
- Source: `gi-website-final/src/pages/conocenos.astro`

**Interfaces:**
- Consumes: `MarketingLayout`, `MagneticButton`, `ROUTES`.

- [ ] **Step 1: Crear la ruta**

Port de `conocenos.astro` (ver exploración página 1): `meta` con el title/description dados. Dentro de `<MarketingLayout>` renderizar `div.page.conocenos` con: `.about-hero` (eyebrow + h1 con `.text-grad-word`), `.about-intro` (`.wrap.reveal`, `<img src="/publicitas.jpg">` + copy), `.section-alt .mv-grid` (2 `.mv-card` con principios), sección de valores (4 `.diff-card`), `.certs` (mapear el array local `CERTIFICATIONS` de 8 items — copiar verbatim del `.astro`), y `.section-dark.about-cta` con `<MagneticButton>` → `<Link to={ROUTES.contact} className="btn btn-accent btn-lg">`. El efecto magnético lo da `MagneticButton`; `.reveal` lo da el layout.

- [ ] **Step 2: Verificar dev**

Run: `npm run dev` → `/conocenos` renderiza completo, reveal ok, botón CTA. Detener dev.
Expected: ok.

- [ ] **Step 3: Commit**

```bash
git add app/routes/conocenos.jsx
git commit -m "feat: add /conocenos marketing page"
```

---

### Task 3.4: `/servicios` (índice)

**Files:**
- Create: `app/routes/servicios._index.jsx`
- Source: `gi-website-final/src/pages/servicios/index.astro`

**Interfaces:**
- Consumes: `MarketingLayout`, `ServicesShowcase`, `SERVICES`, `SERVICE_DETAILS`, `ROUTES`.

- [ ] **Step 1: Crear la ruta**

Port de `servicios/index.astro` (exploración página 2): `meta` con title/description dados + JSON-LD `OfferCatalog` (vía `meta` `'script:ld+json'` o un `<script type="application/ld+json">` con nonce). Contenido en `<MarketingLayout>`: `.svc-hero-sec` (eyebrow, h1 con `.text-grad-word`, `.svc-hero-foot` con `.svc-lede` y `ul.svc-index-list` mapeando `SERVICES` a `<li><Link to={ROUTES.service(s.id)}><span className="n">{s.num}</span><span className="t">{s.title}</span> + flecha</Link></li>`), y `.svc-mosaic-sec.section-alt` con `<ServicesShowcase layout="mosaic" />`. El reveal por `.svc-rev` del `.astro` se sustituye por clases `.reveal` (activadas por el layout) — usar `.reveal` en los bloques del hero y head.

- [ ] **Step 2: Verificar dev**

Run: `npm run dev` → `/servicios`. Índice + mosaic; enlaces a detalle. Detener dev.
Expected: ok.

- [ ] **Step 3: Commit**

```bash
git add app/routes/servicios._index.jsx
git commit -m "feat: add /servicios index page"
```

---

### Task 3.5: `/servicios/:id` (detalle)

**Files:**
- Create: `app/routes/servicios.$id.jsx`
- Source: `gi-website-final/src/pages/servicios/[id].astro`

**Interfaces:**
- Consumes: `MarketingLayout`, `MagneticButton`, `SERVICE_DETAILS`, `ROUTES`. `loader` con `useParams`/`redirect`.

- [ ] **Step 1: Crear la ruta con loader + lookup**

```jsx
import {redirect} from 'react-router';
import {SERVICE_DETAILS} from '~/lib/site-content';

export async function loader({params}) {
  const s = SERVICE_DETAILS[params.id];
  if (!s) throw redirect('/servicios');
  const other = Object.entries(SERVICE_DETAILS).filter(([k]) => k !== params.id);
  return {id: params.id, s, other};
}
export const meta = ({data}) => data?.s ? [
  {title: data.s.seoTitle ?? `${data.s.title} — Generando Ideas`},
  {name: 'description', content: data.s.seoDescription ?? `${data.s.tagline} ${data.s.intro}`},
] : [];
```
Default export: `useLoaderData()` → renderizar el detalle (exploración página 3) dentro de `<MarketingLayout>`: `.svc-intro` (back-link, eyebrow "Servicio {num}", h1 con primera palabra en `.text-grad-word` sólo si el título es multi-palabra, `p.svc-tagline` con `style={{'--svc-color': s.color}}`), `.svc-hero-wrap` (`<img src={s.hero} width={1400} height={612} data-hero-img />`), `.svc-includes.reveal` (grid: intro + examples como `.svc-chip`, features como `ul.svc-features`), `.svc-process.reveal` (steps `PROCESS` locales), `.section-dark.svc-end-cta` (`<MagneticButton>` → contacto + `<Link to={ROUTES.estore}>` "Ver e-store"), `.section-alt.svc-more` (`other.map` a `.svc-more-card.reveal`). Parallax de hero (zoom scale 1.04→1.14) opcional vía `useEffect` con `~/lib/motion` (guardado por reduced-motion); si se omite, dejar la imagen estática.

- [ ] **Step 2: Verificar dev (los 5 servicios + fallback)**

Run: `npm run dev` → `/servicios/promo`, `/servicios/digital-evolution`, etc. renderizan; `/servicios/inexistente` redirige a `/servicios`. Detener dev.
Expected: 5 detalles ok + redirect.

- [ ] **Step 3: Commit**

```bash
git add app/routes/servicios.\$id.jsx
git commit -m "feat: add /servicios/:id detail page"
```

---

### Task 3.6: `/blog` (índice con filtro de categorías)

**Files:**
- Create: `app/routes/blog._index.jsx`
- Source: `gi-website-final/src/pages/blog/index.astro`

**Interfaces:**
- Consumes: `MarketingLayout`, `BLOG_POSTS`, `BLOG_CATEGORIES`.

- [ ] **Step 1: Crear la ruta con filtro en estado React**

Port de `blog/index.astro` (exploración página 4). El filtro por categoría (que en Astro se hacía con `innerHTML`) se implementa con `useState`:
```jsx
const [cat, setCat] = useState('Todos');
const filtered = cat === 'Todos' ? BLOG_POSTS : BLOG_POSTS.filter((p) => p.cat === cat);
const featured = filtered[0];
const rest = filtered.slice(1);
```
Render dentro de `<MarketingLayout>`: `.blog-hero` (eyebrow, h1 `.text-grad-word`, lead), `.blog-body` con `.cat-filter.blog-filter[role=group]` mapeando `BLOG_CATEGORIES` a `<button className={cx('chip', c===cat && 'active')} aria-pressed={c===cat} onClick={() => setCat(c)}>{c}</button>`, y el contenido: si hay `featured`, `<Link className="blog-feature reveal" to={\`/blog/${featured.id}\`}>…</Link>`; luego `<div className="blog-grid reveal">` mapeando `rest` a `<Link className="blog-card" style={{'--i': i}} to={\`/blog/${p.id}\`}>…</Link>`; si `!filtered.length`, `<p className="blog-empty">Aún no hay artículos…</p>`. Al cambiar de categoría, los nodos nuevos deben tener `.in` (el `useMarketingReveal` corre por navegación, no por cambio de estado) → aplicar `.reveal.in` directamente o re-ejecutar el observer; **más simple:** en el filtro, renderizar las tarjetas ya con clase `reveal in` (sin animación de entrada al filtrar, igual que el original hacía con el `requestAnimationFrame`).

- [ ] **Step 2: Verificar dev (filtro)**

Run: `npm run dev` → `/blog`: chips filtran; "Todos" muestra todo; categoría vacía muestra el mensaje. Detener dev.
Expected: filtro funcional en cliente.

- [ ] **Step 3: Commit**

```bash
git add app/routes/blog._index.jsx
git commit -m "feat: add /blog index with client-side category filter"
```

---

### Task 3.7: `/blog/:slug` (detalle)

**Files:**
- Create: `app/routes/blog.$slug.jsx`
- Source: `gi-website-final/src/pages/blog/[slug].astro`

**Interfaces:**
- Consumes: `MarketingLayout`, `BLOG_POSTS`, `ROUTES`. `loader` con lookup/redirect.

- [ ] **Step 1: Crear la ruta**

```jsx
export async function loader({params}) {
  const post = BLOG_POSTS.find((p) => p.id === params.slug);
  if (!post) throw redirect('/blog');
  return {post};
}
export const meta = ({data}) => data?.post ? [
  {title: `${data.post.title} — Blog Generando Ideas`},
  {name: 'description', content: data.post.excerpt},
] : [];
```
Default export renderiza `article.page.article` (exploración página 5): back-link a `ROUTES.blog`, `.article-meta.reveal` (cat · time · read), `h1.article-title.reveal`, `figure.article-figure` (`<img src={post.img} width={1400} height={700} loading="eager" fetchPriority="high" />`), `.article-body-section .prose` (lead = `post.excerpt` + cuerpo boilerplate estático idéntico al `.astro`). Parallax de figura opcional (reduced-motion guard) u omitir.

- [ ] **Step 2: Verificar dev**

Run: `npm run dev` → `/blog/tendencias-2026` y otro slug; `/blog/nope` → redirect. Detener dev.
Expected: ok.

- [ ] **Step 3: Commit**

```bash
git add app/routes/blog.\$slug.jsx
git commit -m "feat: add /blog/:slug article page"
```

---

### Task 3.8: `/bolsa-de-trabajo` (índice)

**Files:**
- Create: `app/routes/bolsa-de-trabajo._index.jsx`
- Source: `gi-website-final/src/pages/bolsa-de-trabajo/index.astro`

**Interfaces:**
- Consumes: `MarketingLayout`, `CountUp`, `MagneticButton`, `JOBS`, `RECRUITMENT`.

- [ ] **Step 1: Crear la ruta**

Port de `bolsa-de-trabajo/index.astro` (exploración página 6): `meta` con title/description dados. `openCvHref = \`mailto:${RECRUITMENT.email}?subject=${encodeURIComponent('CV abierto — Generando Ideas')}\``. STATS locales (6 count / 140+ estático). Dentro de `<MarketingLayout>`: `.careers-hero` (eyebrow, h1 `.text-grad-word`, lede), `.careers-stats-sec` (`.wrap.reveal` con `.stat-band`: item count → `<strong className="stat-n"><CountUp value={6} /></strong>`, item estático → `<strong className="stat-n">140+</strong>` + `.stat-label`), `.careers-jobs-sec` (`h2.reveal` + `.jobs-list.reveal` mapeando `JOBS` a `<Link className="job-row careers-job" to={\`/bolsa-de-trabajo/${j.id}\`}>` con `.job-main` (title + `{j.dept} · {j.location}`) y `.job-tail` (`j.type` + flecha)), `.careers-cta-sec.reveal` (`.open-cv.section-dark` con `<MagneticButton>` → `<a href={openCvHref} className="btn btn-accent btn-lg">Enviar CV abierto</a>`).

- [ ] **Step 2: Verificar dev**

Run: `npm run dev` → `/bolsa-de-trabajo`: stats con count-up, lista de 6 vacantes, CTA mailto. Detener dev.
Expected: ok.

- [ ] **Step 3: Commit**

```bash
git add app/routes/bolsa-de-trabajo._index.jsx
git commit -m "feat: add /bolsa-de-trabajo index page"
```

---

### Task 3.9: `/bolsa-de-trabajo/:id` (detalle)

**Files:**
- Create: `app/routes/bolsa-de-trabajo.$id.jsx`
- Source: `gi-website-final/src/pages/bolsa-de-trabajo/[id].astro`

**Interfaces:**
- Consumes: `MarketingLayout`, `MagneticButton`, `JOBS`, `RECRUITMENT`, `RECRUITMENT_DISCLAIMER`, `ROUTES`. `loader` con lookup/redirect.

- [ ] **Step 1: Crear la ruta**

```jsx
export async function loader({params}) {
  const job = JOBS.find((j) => String(j.id) === params.id);
  if (!job) throw redirect('/bolsa-de-trabajo');
  return {job};
}
export const meta = ({data}) => data?.job ? [
  {title: `${data.job.title} — Bolsa de trabajo · Generando Ideas`},
  {name: 'description', content: `Vacante: ${data.job.title} · ${data.job.dept} · ${data.job.location}`},
] : [];
```
Default export (exploración página 7): `applyHref = mailto:` con subject "Postulación: {title}". `div.page.job-detail`: `.job-hero` (back-link a `ROUTES.careers`, eyebrow `{dept} · {location}`, `h1.job-h1` plano, `.job-chips`), `.job-body-sec .job-layout` con `article.job-prose` (4 `.prose-block.reveal`: "Sobre el rol", "Lo que harás" = `job.responsibilities`, "Lo que buscamos" = `job.requirements`, "Lo que ofrecemos" = `job.offer` con `.prose-list-check`) y `aside.job-aside .apply-box.reveal` (mailto principal, `<MagneticButton>` → botón aplicar, alt email + tel, `dl.apply-meta` con dept/location/type/salary, `p.apply-note` = `RECRUITMENT_DISCLAIMER`). El stagger reveal por bloque lo cubre `useMarketingReveal` (sin GSAP) — aceptable.

- [ ] **Step 2: Verificar dev (6 vacantes + fallback)**

Run: `npm run dev` → `/bolsa-de-trabajo/1` … `/6`; `/bolsa-de-trabajo/99` → redirect. Detener dev.
Expected: ok.

- [ ] **Step 3: Commit**

```bash
git add app/routes/bolsa-de-trabajo.\$id.jsx
git commit -m "feat: add /bolsa-de-trabajo/:id detail page"
```

---

### Task 3.10: `MexicoMap` (componente del contacto)

**Files:**
- Create: `app/components/marketing/MexicoMap.jsx`
- Source: `gi-website-final/src/components/MexicoMap.astro`

**Interfaces:**
- Produces: `MexicoMap({activeId='cdmx', onSelect})` — SVG con pines; marca activo `activeId`; `onSelect(id)` al hacer click en un pin.
- Consumes: `OFFICES`.

- [ ] **Step 1: Crear el componente**

Port de `MexicoMap.astro` (exploración §5). Copiar **verbatim** el `<svg className="map-svg" viewBox="0 156 1024 712">` con sus `<defs>` (pattern `mapdots`, gradient `mapfill`), el `<rect>`, el `<g transform="translate(0,1024) scale(0.1,-0.1)">` con el `<path d="…">` largo (copiar el `d` exacto del `.astro`, es geometría). Mapear `OFFICES` a grupos `<g className={cx('map-pin-group', o.id===activeId && 'active')} data-office={o.id} transform={\`translate(${o.mx}, ${o.my})\`} onClick={() => onSelect?.(o.id)}>` con ripple `<circle className="map-ripple">` (con `<animate>`), `<circle className="map-dot">`, punto blanco, y `<text y={o.id==='cdmx'?-28:44}>{o.name}</text>`. Envolver en `<div className="map-container">`.

- [ ] **Step 2: Commit**

```bash
git add app/components/marketing/MexicoMap.jsx
git commit -m "feat: port MexicoMap component"
```

---

## FASE 4 — Contacto (página + endpoint Resend)

### Task 4.1: Endpoint `api.contact.jsx` (Resend vía fetch) + lógica testeable

**Files:**
- Create: `app/routes/api.contact.jsx`
- Create: `app/lib/contact.js` (validación + construcción de payload, testeable)
- Test: `app/routes/api.contact.logic.test.js`
- Source de referencia: `gi-website-final/api/contact.js`; email helper existente `~/lib/email/resend`.

**Interfaces:**
- Produces:
  - `app/lib/contact.js`: `validateContact(fields)` → `{errors}` (map por campo, `{}` si válido); `buildContactEmail(fields)` → `{subject, html, text}`.
  - `app/routes/api.contact.jsx`: `action({request, context})` → JSON `{ok:true}` / `{ok:false, error, fields?}` con status apropiado.
- Consumes: `context.env.RESEND_API_KEY`, `context.env.CONTACT_EMAIL`.

- [ ] **Step 1: Escribir el test de la lógica**

```js
// app/routes/api.contact.logic.test.js
import {describe, it, expect} from 'vitest';
import {validateContact, buildContactEmail} from '~/lib/contact';

const valid = {
  name: 'Ana', company: 'ACME', role: 'Marketing', email: 'ana@acme.com',
  phone: '5555555555', service: 'Promocionales', source: 'Internet',
  message: 'Necesito 500 termos personalizados para un evento.',
};

describe('validateContact', () => {
  it('passes a fully valid payload', () => {
    expect(validateContact(valid)).toEqual({});
  });
  it('flags missing and malformed fields', () => {
    const e = validateContact({...valid, email: 'nope', message: 'corto'});
    expect(e.email).toBeTruthy();
    expect(e.message).toBeTruthy();
  });
  it('requires all mandatory fields', () => {
    const e = validateContact({});
    ['name', 'company', 'role', 'email', 'phone', 'service', 'source', 'message']
      .forEach((f) => expect(e[f]).toBeTruthy());
  });
});

describe('buildContactEmail', () => {
  it('builds subject/html/text and escapes html', () => {
    const {subject, html, text} = buildContactEmail({...valid, name: '<b>Ana</b>'});
    expect(subject).toContain('ACME');
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(text).toContain('Necesito 500 termos');
  });
});
```

- [ ] **Step 2: Ejecutar (debe fallar)**

Run: `npx vitest run app/routes/api.contact.logic.test.js`
Expected: FAIL — import no resuelto.

- [ ] **Step 3: Crear `app/lib/contact.js`**

Portar la validación y el armado de correo de `gi-website-final/api/contact.js` (ver exploración página 8 y §5). Incluir `EMAIL_RE`, `esc`, `validateContact(fields)` (mismas reglas: todos requeridos trim; email regex; `message` ≥10), y `buildContactEmail(fields)` (filas Nombre/Empresa/Cargo/Correo/Celular/Servicio/¿Cómo llegó? + Mensaje; `subject: \`Nueva solicitud — ${name} (${company})\``).

- [ ] **Step 4: Ejecutar (debe pasar)**

Run: `npx vitest run app/routes/api.contact.logic.test.js`
Expected: PASS.

- [ ] **Step 5: Crear `app/routes/api.contact.jsx`**

```jsx
import {data} from 'react-router';
import {validateContact, buildContactEmail} from '~/lib/contact';

export async function action({request, context}) {
  if (request.method !== 'POST') {
    return data({ok: false, error: 'method_not_allowed'}, {status: 405});
  }
  const body = await request.json().catch(() => null);
  if (!body) return data({ok: false, error: 'bad_request'}, {status: 400});

  const fields = {
    name: String(body.name ?? '').trim(),
    company: String(body.company ?? '').trim(),
    role: String(body.role ?? '').trim(),
    email: String(body.email ?? '').trim(),
    phone: String(body.phone ?? '').trim(),
    service: String(body.service ?? '').trim(),
    source: String(body.source ?? '').trim(),
    message: String(body.message ?? '').trim(),
  };
  const errors = validateContact(fields);
  if (Object.keys(errors).length) {
    return data({ok: false, error: 'validation', fields: errors}, {status: 422});
  }

  const apiKey = context.env.RESEND_API_KEY;
  if (!apiKey) return data({ok: false, error: 'server_misconfigured'}, {status: 500});

  const {subject, html, text} = buildContactEmail(fields);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      from: 'Generando Ideas <formulario@notificaciones.generandoideas.com>',
      to: context.env.CONTACT_EMAIL || 'marketing@generandoideas.com',
      reply_to: fields.email,
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) return data({ok: false, error: 'send_failed'}, {status: 502});
  return data({ok: true});
}
```

- [ ] **Step 6: Añadir env vars**

Agregar a `API-GI/.env` y `.env.example` (si existe):
```
RESEND_API_KEY=""
CONTACT_EMAIL="marketing@generandoideas.com"
```
Nota operativa: configurar `RESEND_API_KEY` real en las variables de entorno de Oxygen (deploy).

- [ ] **Step 7: Commit**

```bash
git add app/lib/contact.js app/routes/api.contact.jsx app/routes/api.contact.logic.test.js .env .env.example
git commit -m "feat: add /api/contact resource route (Resend via fetch)"
```

---

### Task 4.2: Página `/contacto` (reemplazo) con formulario

**Files:**
- Modify (reemplazo total): `app/routes/contacto.jsx`
- Source: `gi-website-final/src/pages/contacto.astro`

**Interfaces:**
- Consumes: `MarketingLayout`, `MexicoMap` (3.10), `OFFICES`, `BUSINESS_HOURS`, `ROUTES`; POST a `/api/contact`.

- [ ] **Step 1: Reescribir `contacto.jsx`**

Reemplazar el contacto actual. `meta` con el title/description del `.astro`. Dentro de `<MarketingLayout>` renderizar `div.page.contacto` (exploración página 8):
- Intro (eyebrow/h1 `.text-grad-word`/lead, todo `.reveal`).
- `.contact-grid.reveal` de 2 columnas:
  - Izquierda: `h2` + tarjeta de éxito condicional + `<form className="form-grid" noValidate onSubmit={onSubmit}>` con 8 campos en wrappers `.field[data-field]` (name, company, role, email[type=email], phone[type=tel], service[select], source[select], message[textarea]). Selects con las opciones exactas (service: "", Promocionales, Promotional Workshop, Print Shop, Digital Evolution, Importaciones, Otro; source: "", Recomendación, Internet, Redes Sociales, Otro). Botón submit + `p.form-error` + `p.form-privacy` con `<a href={ROUTES.privacy} target="_blank" rel="noopener noreferrer">`.
  - Derecha: `h2` "Nuestras sucursales", `p.contact-hours` = `BUSINESS_HOURS`, `.offices-wrap` con `<MexicoMap activeId={active} onSelect={setActive} />` y `.offices-list` mostrando **sólo** la oficina cdmx (`OFFICES.filter(o => o.id==='cdmx')`), con estado `.active` sincronizado.
- Estado React: `const [values, setValues] = useState({...})`, `const [errors, setErrors] = useState({})`, `const [status, setStatus] = useState('idle')` (idle|sending|success|error), `const [active, setActive] = useState('cdmx')`.
- `onSubmit`: `preventDefault`; validar con las mismas reglas (reusar `validateContact` de `~/lib/contact` importado — es puro, corre en cliente); si hay errores, set y enfocar el primer campo inválido; si no, `setStatus('sending')`, `fetch('/api/contact', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(values)})`; en `res.ok && json.ok` → `setStatus('success')` (ocultar form, mostrar tarjeta con primer nombre); en 422 con `fields` → marcar esos campos; cualquier otro/catch → `setStatus('error')`.
- La coordinación mapa↔oficina se hace con `active`/`setActive` (click en pin o en `.office`).

- [ ] **Step 2: Verificar dev (validación + envío)**

Run: `npm run dev` → `/contacto`: enviar vacío muestra errores y enfoca el primero; email inválido marca error; mapa marca oficina activa. (Sin `RESEND_API_KEY` el POST responde 500 → estado error; con la key real responde ok.) Detener dev.
Expected: validación cliente ok; POST llega a `/api/contact`.

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: compila.

- [ ] **Step 4: Commit**

```bash
git add app/routes/contacto.jsx
git commit -m "feat: replace /contacto with ported marketing contact form"
```

---

## FASE 5 — Integración, SEO y limpieza

### Task 5.1: Cross-links y limpieza de referencias a e-store

**Files:**
- Modify: cualquier port que use `ROUTES.estore` o "Ver e-store" con `target="_blank"`.

- [ ] **Step 1: Auditar enlaces a e-store**

Run:
```bash
cd "/Users/ivan/Documents/Generando Ideas/api/API-GI" && grep -rn "estore\|api.generandoideas.com\|e-store\|Ver e-store" app/
```
Expected: sólo referencias internas ya migradas.

- [ ] **Step 2: Confirmar que estore es interno**

Verificar que todo uso de `ROUTES.estore` (`/catalogo`) use `<Link>` (no `<a target="_blank">`). Ajustar `ClosingCTA.jsx` y `servicios.$id.jsx` si quedaron con `target="_blank"`.

- [ ] **Step 3: Commit (si hubo cambios)**

```bash
git add -A && git commit -m "chore: point e-store links to internal /catalogo"
```

---

### Task 5.2: SEO — sitemap incluye rutas de marketing

**Files:**
- Modify: `app/routes/[sitemap.xml].jsx` y/o `app/routes/sitemap.$type.$page[.xml].jsx`

- [ ] **Step 1: Revisar el sitemap actual**

Leer `app/routes/[sitemap.xml].jsx` para ver cómo se generan las URLs (probablemente desde Shopify). Añadir las rutas estáticas de marketing (`/`, `/conocenos`, `/servicios` + 5 detalles, `/blog` + N posts, `/bolsa-de-trabajo` + 6, `/contacto`) generándolas desde `site-content.js` (`SERVICE_DETAIL_IDS`, `BLOG_POSTS`, `JOBS`).

- [ ] **Step 2: Verificar dev**

Run: `npm run dev` → abrir `/sitemap.xml`; confirmar que aparecen las rutas de marketing. Detener dev.
Expected: URLs de marketing presentes.

- [ ] **Step 3: Commit**

```bash
git add app/routes/
git commit -m "feat: include marketing routes in sitemap"
```

---

### Task 5.3: Verificación integral y build final

**Files:** —

- [ ] **Step 1: Correr toda la suite de tests**

Run: `cd "/Users/ivan/Documents/Generando Ideas/api/API-GI" && npm test`
Expected: todos los tests pasan (incluye site-content, format, navActive, CountUp, contact logic + los existentes de API-GI).

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores (corregir imports/no-usados que hayan quedado).

- [ ] **Step 3: Build de producción**

Run: `npm run build`
Expected: build de Hydrogen exitoso.

- [ ] **Step 4: Recorrido manual en dev (checklist de criterios de aceptación)**

Run: `npm run dev` y verificar:
- `/` home de marketing (hero, servicios, proceso, impacto, testimonios, closing).
- `/conocenos`, `/servicios` (+ 5 detalles), `/blog` (filtro + 6 posts + detalles), `/bolsa-de-trabajo` (+ 6 detalles), `/contacto` (form + mapa).
- Header: nav marketing + búsqueda/cotización/cuenta; "Catálogo" abre el catálogo Shopify (`/catalogo`) y el comercio sigue: `/collections`, `/products/...`, `/cart`, `/cotizacion`, `/account`.
- Footer unificado en marketing y comercio.
- GA (`window.gtag`) y Brevo cargan sin CSP errors.
- Animaciones ok y respetan reduced-motion (probar con "Reduce motion" del SO).
Detener dev.
Expected: todos los criterios de aceptación del spec cumplidos.

- [ ] **Step 5: Commit final / merge**

```bash
git add -A && git commit -m "chore: final integration verification for marketing merge"
```
(La integración a la rama principal se decide por separado; ver superpowers:finishing-a-development-branch.)

---

## FASE 6 — Retiro de gi-website-final (opcional, tras verificación)

### Task 6.1: Archivar el proyecto Astro

- [ ] **Step 1:** Confirmar con el usuario que la app fusionada quedó verificada en dev/preview.
- [ ] **Step 2:** No borrar `gi-website-final/` hasta que el usuario lo apruebe explícitamente. Cuando lo apruebe, retirar el deploy de Vercel y mover la carpeta a un archivo/branch de respaldo.

---

## Self-Review (cobertura del spec)

- **§4 Arquitectura una-app / §5 Rutas:** cubierto — Fase 3 (marketing pages, home/contacto reemplazados), catálogo Shopify intacto (Task 2.1 verifica), Astro `catalogo`/flipbooks NO portados (Task 3.2 omite la sección).
- **§6 Modelo de contenido:** Task 1.1 (site-content.js, drop de CATALOGS/PRODUCTS, estore interno).
- **§7 Componentes:** Tasks 1.6, 3.1, 3.10 (todos los `.astro` menos CatalogsCarousel/Nav).
- **§8 Header/Footer:** Tasks 2.1, 2.2.
- **§9 Estilos/tokens:** Task 1.3 (aislamiento `.gi-mkt`, tokens verbatim).
- **§10 Animaciones:** Tasks 1.4 (motion), 1.5 (reveal), 1.6 (CountUp/Magnetic), 3.1 (process/testimonials).
- **§11 Contacto Resend:** Tasks 4.1, 4.2.
- **§12 GA/Brevo/CSP:** Task 1.7.
- **§13 Assets:** Task 1.2.
- **§14 SEO:** Tasks 3.x (`meta` por ruta), 5.2 (sitemap).
- **§15 Dependencias:** Task 0.1.
- **§19 Criterios de aceptación:** Task 5.3.

Sin placeholders TBD/TODO en pasos de código. Nombres consistentes: `MarketingLayout`, `useMarketingReveal`, `isNavActive`, `CountUp({value,...})`, `MagneticButton({factor})`, `validateContact`/`buildContactEmail`, `ROUTES.estore='/catalogo'`, `.gi-mkt` en todo el CSS de marketing.
