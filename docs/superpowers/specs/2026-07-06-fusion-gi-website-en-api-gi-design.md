# Fusión: gi-website-final → API-GI (Hydrogen)

- **Fecha:** 2026-07-06
- **Estado:** Aprobado (diseño) — pendiente escribir plan de implementación
- **Autor:** Ivan + Claude

## 1. Objetivo

Unificar los dos proyectos del repositorio en **una sola aplicación** dentro de `API-GI`:

- El **sitio de marketing** de `gi-website-final` (Astro) se migra a `API-GI` convirtiendo sus páginas y componentes a React (React Router 7 / Hydrogen).
- La sección **"Catálogo"** apunta al **catálogo real de Shopify** que ya vive en `API-GI` (`/catalogo`), no al catálogo estático de Astro.
- Resultado: un solo build, un solo deploy (Shopify Oxygen), un solo dominio, header/footer unificados. Se retiran el build de Astro y la función serverless de Vercel.

## 2. Contexto de los dos proyectos

- **API-GI** — Storefront Shopify Hydrogen (React Router 7). Ya es un e-commerce B2B completo con marca "Generando Ideas": home comercial, catálogo (`catalogo.jsx`), colecciones, productos, carrito, búsqueda, sistema de cotizaciones, cuentas y autenticación. Tiene su propia librería de componentes (`app/components/gi/`) y sistema de diseño (`app/styles/gi-tokens.css`, `gi-sections.css`, `gi-screens.css`). Corre en Oxygen (`server.js`, mini-oxygen). Rutas file-based vía `@react-router/fs-routes` (`app/routes.js`). El shell (`PageLayout.jsx`) monta `GiHeader` + `GiFooter` + `QuoteDrawer` + `GiSearchModal`.
- **gi-website-final** — Sitio de marketing en Astro 5 (estático). Páginas: home, conócenos, servicios (+ detalle), blog (+ detalle), bolsa de trabajo (+ detalle), contacto, catálogo. Todo el contenido es **estático** y vive en `src/data/site.ts` (servicios, blog, vacantes, testimonios, oficinas, redes, catálogos). Animaciones GSAP + Lenis (`src/lib/motion.ts`) + reveal por IntersectionObserver. Google Analytics y chat Brevo. Formulario de contacto vía función serverless de Vercel (`api/contact.js`, Resend). Corre en Vercel.

**Restricción clave:** Astro y Hydrogen son motores de render distintos; los `.astro` no corren en Hydrogen. "Migrar el sitio" = **portar páginas y componentes de Astro a React**.

## 3. Decisiones tomadas

1. **Arquitectura:** una sola app en API-GI (port Astro → React dentro de Hydrogen).
2. **Diseño:** `gi-website-final` manda en las páginas de marketing; API-GI conserva su diseño en las pantallas de comercio (catálogo, producto, carrito, cuenta, cotización). Header y footer unificados.
3. **Flipbooks:** se **eliminan** por completo (los 12 catálogos digitales tipo flipbook). `/catalogo` es el catálogo Shopify de API-GI. La sección "Catálogos 2026" del home se quita y en su lugar el home enlaza a `/catalogo`.
4. **Extras:** se traen los tres — formulario de contacto (Resend), Google Analytics (G-4Z8RFG1DT0) y chat Brevo Conversations.

## 4. Arquitectura final

Aplicación única **Hydrogen (React Router 7)** en `API-GI`. Las páginas de marketing se agregan como rutas file-based en `app/routes/`. El contenido estático se porta a un módulo de datos. El shell (`PageLayout`) sigue envolviendo todo con header/footer unificados. Deploy único en Oxygen.

## 5. Mapa de rutas

### Marketing (portadas de Astro, diseño gi-website-final)

| Ruta | Archivo nuevo (flatRoutes) | Origen Astro | Acción |
|------|----------------------------|--------------|--------|
| `/` | `app/routes/_index.jsx` | `pages/index.astro` | **Reemplaza** el home comercial actual |
| `/conocenos` | `app/routes/conocenos.jsx` | `pages/conocenos.astro` | nueva |
| `/servicios` | `app/routes/servicios._index.jsx` | `pages/servicios/index.astro` | nueva |
| `/servicios/:id` | `app/routes/servicios.$id.jsx` | `pages/servicios/[id].astro` | nueva (5 servicios de `SERVICE_DETAILS`) |
| `/blog` | `app/routes/blog._index.jsx` | `pages/blog/index.astro` | nueva (6 posts) |
| `/blog/:slug` | `app/routes/blog.$slug.jsx` | `pages/blog/[slug].astro` | nueva |
| `/bolsa-de-trabajo` | `app/routes/bolsa-de-trabajo._index.jsx` | `pages/bolsa-de-trabajo/index.astro` | nueva (6 vacantes) |
| `/bolsa-de-trabajo/:id` | `app/routes/bolsa-de-trabajo.$id.jsx` | `pages/bolsa-de-trabajo/[id].astro` | nueva |
| `/contacto` | `app/routes/contacto.jsx` | `pages/contacto.astro` | **Reemplaza** el contacto actual de API-GI |
| `/api/contact` | `app/routes/api.contact.jsx` | `api/contact.js` | resource route (action Resend) |

### Comercio (sin cambios, diseño API-GI)

`/catalogo`, `/collections`, `/collections/:handle`, `/collections/all`, `/products/:handle`, `/cart`, `/search`, `/cotizacion`, `/account/*`, `/auth/*`, `/login`, `/registro`, `/lookbook`, `/policies`, `/policies/:handle`, sitemap/robots.

### Descartadas

- `pages/catalogo.astro` (lo sustituye el catálogo Shopify).
- `components/CatalogsCarousel.astro` y datos `CATALOGS` / `CATALOG_CATEGORIES` (flipbooks eliminados).
- La sección "Catálogos 2026" del home.

### Conflictos de ruta a resolver

- `/` — el `_index.jsx` comercial actual se reemplaza por el home portado. El original queda en el historial de git de API-GI (no se conserva copia paralela).
- `/contacto` — existe en ambos; gana la versión portada de Astro con su formulario.

## 6. Modelo de contenido

`gi-website-final/src/data/site.ts` → `app/lib/site-content.js` (JS plano con JSDoc, siguiendo el estilo de API-GI). Incluye:

- `BRAND`, `NAV_ITEMS`, `ROUTES` (ajustados: `estore` deja de apuntar a `api.generandoideas.com`; se usa `/catalogo` interno).
- `SERVICES`, `SERVICE_DETAILS`, `SERVICE_DETAIL_IDS`.
- `BLOG_POSTS`, `BLOG_CATEGORIES`.
- `JOBS`, `RECRUITMENT`, `RECRUITMENT_DISCLAIMER`.
- `TESTIMONIALS`, `OFFICES`, `SOCIAL_LINKS`, `BUSINESS_HOURS`, `TICKER_WORDS`.
- `IMAGES` (mapa de URLs de Unsplash usadas como placeholders).
- **Se omiten** `CATALOGS`, `CATALOG_CATEGORIES`, `PRODUCTS`, `PRODUCT_CATEGORIES` (pertenecían al catálogo estático/flipbooks descartados).

## 7. Componentes a portar

De `.astro` → `app/components/marketing/*.jsx`:

- `Hero`, `ServicesShowcase`, `ProcessSection`, `ImpactBand`, `TestimonialsCarousel`, `ClosingCTA`, `MexicoMap` (contacto), `Ticker`, `Logo`, `SocialIcons`, `Footer` (se integra al footer unificado), `MobileMenu` (se integra al header).
- **No se portan:** `CatalogsCarousel` (flipbooks), `Nav` (se fusiona con `GiHeader`).

Los `<style>` scoped de cada `.astro` se convierten en CSS con clases globales. Los nombres de clase actuales son distintivos (`.home-cat-grid`, `.nav-burger`, etc.), por lo que el riesgo de colisión es bajo, pero se verifica durante el port.

## 8. Header y footer unificados

- **Header:** se extiende `app/components/gi/Header.jsx` (`GiHeader`), conservando toda su lógica de comercio (buscador `openSearch`, drawer de cotización `openQuoteDrawer` + badge, login/registro, menú de cuenta con logout). Se cambia su arreglo `NAV` por los items de marketing: **Inicio (`/`) · Conócenos · Servicios · Catálogo (`/catalogo`) · Blog · Contacto**. Se incorpora el pulido del `Nav.astro`: shrink al hacer scroll (toggle de clase con listener pasivo) y hover, respetando `prefers-reduced-motion`.
- **Footer:** se reescribe `app/components/gi/Footer.jsx` (`GiFooter`) adoptando el contenido del `Footer.astro`: oficinas (`OFFICES`), redes (`SOCIAL_LINKS`), horario (`BUSINESS_HOURS`), enlace al aviso de privacidad (PDF), más enlaces de comercio (catálogo, cotización, cuenta).
- El shell `PageLayout` no cambia su estructura (sigue montando `GiHeader`/`GiFooter`/`QuoteDrawer`/`GiSearchModal`).

## 9. Estilos y tokens (punto de mayor cuidado)

- `global.css` + `motion.css` de Astro entran como `app/styles/gi-marketing.css` (y `gi-motion.css`), enlazados en el `Layout` de `root.jsx`.
- **Reconciliación de variables CSS** con `gi-tokens.css` de API-GI: auditar nombres compartidos (`--ink`, `--orange-500`, `--gray-100`, radios, sombras) y resolver choques (unificar valores o renombrar los del marketing). Es el principal riesgo de integración.
- Las fuentes ya coinciden (Gantari, Open Sans, Bebas Neue cargadas en `root.jsx`), lo que reduce fricción.

## 10. Animaciones (GSAP + Lenis)

- `src/lib/motion.ts` → `app/lib/motion.js` (init client-only, idempotente).
- En SPA (React Router): Lenis se inicializa una vez del lado cliente; `ScrollTrigger` se refresca en cada navegación; el reveal por `.reveal`/IntersectionObserver corre por página (montaje de ruta). Respeta `prefers-reduced-motion`.
- Reconciliar con el `ScrollReveal` existente de API-GI (`components/gi/ui.jsx`) para no duplicar mecanismos.
- Nuevas dependencias: `gsap`, `lenis`.

## 11. Formulario de contacto (Resend)

- `api/contact.js` → `app/routes/api.contact.jsx` como resource route con `action`.
- Envío por **Resend vía `fetch`** a `https://api.resend.com/emails` (Oxygen corre en runtime tipo Workers; se evita el SDK `resend`). Se conserva la validación server-side, el escape HTML y el formato de correo del original.
- `RESEND_API_KEY` se lee de `context.env`; se agrega a `.env` y a las variables de entorno de Oxygen.
- La página `/contacto` postea al endpoint (fetch o `Form` de React Router) y refleja estados de éxito/error/validación.

## 12. Extras (Analytics, chat)

- **Google Analytics** (`G-4Z8RFG1DT0`) y **Brevo Conversations**: scripts agregados al `Layout` de `root.jsx` con `nonce`.
- **CSP:** Hydrogen aplica CSP estricta (`entry.server.jsx`). Hay que permitir los dominios de Google Analytics (`googletagmanager.com`, `google-analytics.com`) y Brevo (`conversations-widget.brevo.com` y afines) en la directiva correspondiente.

## 13. Assets

- Copiar de `gi-website-final/public/` → `API-GI/public/`: imágenes de servicios (`promocionales.jpg`, `printshop.jpg`, `workshop.jpg`, `fulfillment.jpg`), banners (`bannerupdated.jpg`, `banner.jpg`), imágenes de blog locales, y `legal/aviso-de-privacidad-esi-2026.pdf`.
- **No** se copian `public/catalogos/*` (flipbooks eliminados).
- Reconciliar `/brand/`: API-GI referencia `/brand/gi-logo-horizontal.svg`; Astro usa `/brand/logo-horizontal.svg`. Verificar que el logo del header/footer resuelva a un archivo existente (unificar nombre o copiar el faltante).

## 14. SEO

- Cada ruta de marketing exporta su `meta` (título/description; los detalles de servicio ya traen `seoTitle`/`seoDescription` en `SERVICE_DETAILS`).
- Agregar las rutas de marketing al sitemap de API-GI.
- `robots.txt` / `llms.txt`: reconciliar con lo que ya sirve API-GI (no duplicar).

## 15. Dependencias nuevas

- `gsap`, `lenis` (animaciones).
- Resend se usa vía `fetch` (no se agrega el SDK).

## 16. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Colisión de variables/clases CSS entre marketing y tokens de API-GI | Auditar y reconciliar tokens antes de portar páginas (fase 1) |
| CSP bloquea GA/Brevo | Actualizar `entry.server.jsx` y verificar en runtime |
| GSAP/Lenis en navegaciones SPA (memory leaks, doble init) | Init idempotente + cleanup en desmontaje/navegación |
| SDK `resend` no corre en Workers | Usar `fetch` a la API de Resend |
| Conflicto de rutas `/` y `/contacto` | Reemplazo explícito; original queda en git |
| Logo con nombre distinto entre proyectos | Unificar nombre/copiar asset |

## 17. Fases de implementación

1. **Cimientos:** portar datos (`site-content.js`), copiar assets, integrar y reconciliar CSS/tokens, portar motion (GSAP/Lenis) + reveal, agregar GA + Brevo + CSP en `root.jsx`/`entry.server.jsx`, agregar dependencias.
2. **Shell:** header unificado (nav marketing + acciones de comercio) + footer unificado.
3. **Páginas de marketing:** home → conócenos → servicios (+ detalle) → blog (+ detalle) → bolsa de trabajo (+ detalle).
4. **Contacto:** página `/contacto` + resource route Resend + env.
5. **Enlaces y limpieza:** nav "Catálogo" → catálogo Shopify, quitar sección de flipbooks del home, arreglar cross-links (`estore`, "Ver e-store", etc.), descartar `catalogo.astro`.
6. **SEO + verificación:** meta por ruta, sitemap; build de Hydrogen y verificación de cada ruta (marketing y comercio).

## 18. Fuera de alcance

- Rediseñar las pantallas de comercio para igualar el look de marketing (se decidió conservar el diseño de API-GI en comercio).
- Migrar contenido a un CMS (el contenido sigue estático en `site-content.js`).
- Conservar flipbooks o el catálogo estático de Astro.

## 19. Criterios de aceptación

- Las 6 áreas de marketing renderizan con el diseño de gi-website-final: `/`, `/conocenos`, `/servicios` (+ detalle), `/blog` (+ detalle), `/bolsa-de-trabajo` (+ detalle), `/contacto`.
- El header muestra el nav de marketing y conserva buscador, cotización, login/registro/cuenta.
- "Catálogo" en el nav abre el catálogo Shopify de API-GI y el resto del comercio sigue funcionando.
- El formulario de `/contacto` envía correo vía Resend y maneja validación/errores.
- GA y Brevo cargan sin ser bloqueados por CSP.
- Las animaciones (reveal, smooth scroll) funcionan y respetan `prefers-reduced-motion`.
- `shopify hydrogen build` compila sin errores.
