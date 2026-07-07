# Home híbrido (producto-primero + web) — Diseño

- **Fecha:** 2026-07-07
- **Estado:** Aprobado (diseño) — pendiente plan de implementación
- **Rama:** feat/home-hibrido (desde feat/auth-decoration-quotes @ 1408c16)
- **Contexto previo:** [[2026-07-06-fusion-gi-website-en-api-gi-design]] — la fusión ya dejó el home como el home de marketing puro (`MarketingLayout` + Hero banner + ServicesShowcase…). Esta iteración lo reemplaza por un home híbrido.

## 1. Objetivo

Rehacer el home (`app/routes/_index.jsx`) como una **mezcla producto-primero**: el home comercial de API-GI (productos/categorías/colecciones en vivo de Shopify) como base, integrando contenido relevante del sitio web (servicios, testimonios de clientes, teaser de Conócenos), todo con el **diseño nativo de API-GI** para que se vea coherente.

## 2. Decisiones tomadas

1. **Base:** home comercial de API-GI (loader Shopify con productos en vivo), no el home de marketing.
2. **Contenido web a integrar:** Servicios (los 5), Testimonios/clientes, y un teaser de Conócenos. **NO** se integran los "números de impacto" de la web (se mantiene, si acaso, la lógica comercial; ver §5).
3. **Estilo:** las 3 secciones web nuevas se construyen **nativas en el diseño de API-GI** (clases/componentes existentes: `eyebrow`, `section`, `section-head`, `Button`, `Icon`, `ScrollReveal`, patrones de tarjeta de `gi-sections.css`). NO se reusan los componentes de marketing `.gi-mkt` como islas.
4. **Recorte:** para no inflar el home, se dejan fuera (por ahora) marquee de productos, spotlight, banda de stats, 2º marquee, customizer, feature strip y FAQ. Reincorporables después si se desea.
5. El home de marketing puro y sus componentes (`app/components/marketing/*`) **no se borran**; siguen disponibles.

## 3. Lineup del home (orden final)

1. **HERO** — hero comercial con productos en vivo (`HeroCollage`) + propuesta de valor + CTAs "Explorar catálogo" y "Solicitar cotización"/"Crear cuenta".
2. **Categorías** — tarjetas de categoría (colecciones en vivo, `HOME_CATEGORIES` + imágenes).
3. **Servicios (5)** — NUEVA. Los 5 servicios (`SERVICES`) enlazando a `/servicios/:id`.
4. **Productos destacados** — grid de best-sellers (`ProductCard`).
5. **Colecciones destacadas** — `FEATURED_COLLECTIONS`.
6. **Conócenos teaser** — NUEVA. Bloque de marca corto → `/conocenos` (usa `BRAND` + cobertura CDMX·Sonora·Yucatán).
7. **Cómo funciona** — pasos de proceso (el mismo bloque del home comercial).
8. **Testimonios / clientes** — NUEVA. Prueba social con `TESTIMONIALS`.
9. **Lookbook** — `LookbookGrid`.
10. **CTA final** — cierre comercial (big CTA).

## 4. Componentes nuevos (diseño API-GI)

En `app/components/gi/HomeSections.jsx` (o un archivo nuevo `HomeGiSections.jsx` para no engordar el existente):

- **`ServicesStrip`** — mapea `SERVICES` (id, num, title, desc) a tarjetas estilo API-GI con `Icon` y flecha, cada una `<Link>`/navegación a `/servicios/${id}`. Encabezado con `eyebrow` + `h2` (p. ej. "// Servicios · Todo lo que hacemos"). Reutiliza clases de tarjeta existentes (p. ej. patrón `cat-card`/`coll-card`) o unas nuevas mínimas.
- **`ClientTestimonials`** — muestra `TESTIMONIALS` (quote, company) en un carrusel/grid con estilo API-GI (tarjetas, avatar con iniciales, acento naranja). Encabezado `eyebrow` + `h2` ("// Clientes · Relaciones que duran años").
- **`AboutTeaser`** — bloque de marca: `eyebrow` + `h2` + copy corto + `Button` "Conócenos" → `/conocenos`; menciona cobertura (CDMX·Sonora·Yucatán) desde `OFFICES`/texto. Estilo tipo "feature strip" o "how" del home comercial.

Estas secciones usan `ScrollReveal` de `~/components/gi/ui` (IntersectionObserver de API-GI), NO el reveal de `MarketingLayout`.

## 5. Datos y loader

- Se restaura el **loader comercial** en `_index.jsx` (basado en el `_index.jsx` previo a la fusión, recuperable en git): `fetchCollectionCards` para `HOME_CATEGORIES` y `FEATURED_COLLECTIONS`, y `GI_PRODUCTS_QUERY` (best-selling) → `normalizeProduct`. Devuelve `{categoryCards, featuredCollections, products, isShopLinked}`.
- Servicios/testimonios/teaser son **estáticos** (`SERVICES`, `TESTIMONIALS`, `BRAND`, `OFFICES` de `~/lib/site-content`) — no requieren datos del loader.
- El home NO usa `MarketingLayout` ni el wrapper `.gi-mkt`.

## 6. Archivos

- **Modificar (reescritura):** `app/routes/_index.jsx` — home híbrido con loader comercial + lineup §3.
- **Crear:** `app/components/gi/HomeGiSections.jsx` — `ServicesStrip`, `ClientTestimonials`, `AboutTeaser`.
- **Modificar:** `app/styles/gi-sections.css` — pocas reglas nuevas si los patrones de tarjeta existentes no bastan (reutilizar lo existente al máximo).
- Reusar sin cambios: `app/components/gi/HomeSections.jsx` (HeroCollage, ImageMarquee, ProductSpotlight, LookbookGrid, StatsBand, CustomizerSection, FAQAccordion), `ProductCard`, `ui.jsx` (Button, Icon, ScrollReveal), `gi.js` (HOME_CATEGORIES, FEATURED_COLLECTIONS, LIFESTYLE, normalizeProduct), `giFragments.js`.

## 7. Fuera de alcance

- Otras páginas de marketing (conócenos, servicios, blog, bolsa de trabajo, contacto) — sin cambios.
- El catálogo Shopify (`/catalogo`) — sin cambios.
- Borrar los componentes de marketing (`app/components/marketing/*`) — se conservan.
- Reincorporar marquee/spotlight/stats/customizer/feature-strip/FAQ (recortados; futuros opcionales).

## 8. Criterios de aceptación

- `/` renderiza el home híbrido producto-primero con el lineup §3.
- Cargan productos, categorías y colecciones en vivo de Shopify (o el estado mock si `isShopLinked` es falso), como el home comercial anterior.
- Las 3 secciones nuevas (Servicios, Testimonios, Conócenos teaser) se ven **coherentes con el diseño de API-GI** (no como islas de otro estilo) y enlazan correctamente (`/servicios/:id`, `/conocenos`).
- El header/footer unificados y el resto del sitio siguen intactos.
- `npm test`, `npm run lint`, `npm run build` pasan; smoke-test en dev: `/` responde 200 con las secciones.
