# Home híbrido (producto-primero + web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el home (`app/routes/_index.jsx`) por un híbrido producto-primero: el home comercial de API-GI (productos/categorías/colecciones en vivo) + 3 secciones nuevas de la web (Servicios, Testimonios, teaser Conócenos), todo con el diseño nativo de API-GI.

**Architecture:** El home comercial anterior (con su loader Shopify) se restaura como base. Se crean 3 componentes presentacionales nuevos con clases/componentes de API-GI (no `.gi-mkt`). El home NO usa `MarketingLayout`; usa el `ScrollReveal` de `~/components/gi/ui`.

**Tech Stack:** React 18, React Router 7, Shopify Hydrogen 2026.4.2, Vitest + @testing-library/react.

## Global Constraints
- Diseño NATIVO de API-GI para las 3 secciones nuevas: usar clases/componentes existentes (`section`, `container`, `section-head`, `eyebrow`, `Button`, `Icon`, `ScrollReveal`, patrones de tarjeta de `gi-screens.css`). NO usar `.gi-mkt` ni los componentes de `app/components/marketing/*`.
- El home NO se envuelve en `MarketingLayout`.
- Datos estáticos desde `~/lib/site-content` (`SERVICES`, `TESTIMONIALS`, `BRAND`, `OFFICES`); productos/categorías/colecciones desde el loader Shopify.
- Enlaces internos con `react-router` (`useNavigate`/`Link`/`<a onClick>`), siguiendo el patrón del home comercial anterior.
- `app/components/marketing/*` NO se borra.
- Runtime Oxygen: `context`/loader como el home comercial anterior; sin Node APIs.
- Commits: uno por tarea, tras verificar. Build (`npm run build`), lint (`npm run lint`), tests (`npm test`) deben pasar. NO commitear `storefrontapi.generated.d.ts` (revertir tras build).
- Referencia del home comercial anterior (verbatim): `git show 1a81fac^:app/routes/_index.jsx` (también guardado en el scratchpad de la sesión como `old-commerce-index.jsx`). Reusar su loader y sus secciones de producto.

## File Structure
- **Create:** `app/components/gi/HomeGiSections.jsx` — `ServicesStrip`, `ClientTestimonials`, `AboutTeaser`.
- **Create (test):** `app/components/gi/HomeGiSections.test.jsx` — render tests de las 3 secciones.
- **Modify:** `app/styles/gi-screens.css` — reglas nuevas mínimas para las 3 secciones (si los patrones existentes no bastan).
- **Modify (reescritura):** `app/routes/_index.jsx` — loader comercial + lineup híbrido.
- **Reusar sin cambios:** `app/components/gi/HomeSections.jsx`, `ProductCard.jsx`, `ui.jsx`, `Icon.jsx`, `app/lib/gi.js`, `app/lib/giFragments.js`.

---

### Task 1: Secciones nuevas nativas de API-GI (ServicesStrip, ClientTestimonials, AboutTeaser)

**Files:**
- Create: `app/components/gi/HomeGiSections.jsx`
- Create: `app/components/gi/HomeGiSections.test.jsx`
- Modify: `app/styles/gi-screens.css`

**Interfaces:**
- Produces:
  - `ServicesStrip()` — sección `<section className="section container">` con `section-head` (eyebrow "// Servicios · Todo lo que hacemos" + h2) y un grid de tarjetas mapeando `SERVICES` (campos `id`, `num`, `title`, `desc`) → cada tarjeta navega a `/servicios/${id}` (usar `useNavigate` o `<a href onClick preventDefault navigate>` como el home comercial). Cada tarjeta: número (`num`), título, descripción, `Icon name="arrow_up_right"`. Envolver el grid en `<ScrollReveal>`.
  - `ClientTestimonials()` — sección con `section-head` (eyebrow "// Clientes · Relaciones que duran años" + h2) y un grid/carril de `TESTIMONIALS` (campos `quote`, `company`) como tarjetas de cita con avatar de iniciales (helper local `initials(company)`) y acento naranja. Envolver en `<ScrollReveal>`.
  - `AboutTeaser()` — bloque de marca: `eyebrow` + h2 + copy corto + `<Button ... onClick={() => navigate('/conocenos')}>Conócenos</Button>`; menciona cobertura CDMX·Sonora·Yucatán (derivar de `OFFICES` o texto). Estilo tipo `.how`/`.feat-strip` del home comercial.
- Consumes: `SERVICES`, `TESTIMONIALS`, `BRAND`, `OFFICES` de `~/lib/site-content`; `Button`, `Icon`, `ScrollReveal` de `~/components/gi/ui` (`Icon` de `~/components/gi/Icon`); `useNavigate` de `react-router`.

- [ ] **Step 1: Escribir el test de render (RED)**

```jsx
// app/components/gi/HomeGiSections.test.jsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {ServicesStrip, ClientTestimonials, AboutTeaser} from './HomeGiSections';
import {SERVICES, TESTIMONIALS} from '~/lib/site-content';

function renderWithRouter(ui) {
  const Stub = createRoutesStub([{path: '/', Component: () => ui}]);
  return render(<Stub initialEntries={['/']} />);
}

describe('HomeGiSections', () => {
  it('ServicesStrip renders every service linking to its detail', () => {
    renderWithRouter(<ServicesStrip />);
    for (const s of SERVICES) {
      expect(screen.getByText(s.title)).toBeInTheDocument();
    }
  });
  it('ClientTestimonials renders client quotes', () => {
    renderWithRouter(<ClientTestimonials />);
    // At least the first testimonial's company appears
    expect(screen.getAllByText(TESTIMONIALS[0].company).length).toBeGreaterThan(0);
  });
  it('AboutTeaser renders a Conócenos CTA', () => {
    renderWithRouter(<AboutTeaser />);
    expect(screen.getByText(/Conócenos/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Ejecutar (debe fallar)**

Run: `npx vitest run app/components/gi/HomeGiSections.test.jsx`
Expected: FAIL — import no resuelto.

- [ ] **Step 3: Implementar `HomeGiSections.jsx`**

Crear los 3 componentes usando clases/patrones de API-GI. Guía:
- Imports: `import {useNavigate} from 'react-router';` `import {Button, ScrollReveal} from '~/components/gi/ui';` `import {Icon} from '~/components/gi/Icon';` `import {SERVICES, TESTIMONIALS, BRAND, OFFICES} from '~/lib/site-content';`
- `ServicesStrip`: patrón de sección del home comercial (ver `old-commerce-index.jsx` sección CATEGORIES/`section container` + `section-head` con `eyebrow` y `h2`). Grid de tarjetas (reusar `.cat-grid`/`.cat-card` o un grid propio `.svc-strip-grid`); cada tarjeta con `num`, `title`, `desc`, y `Icon name="arrow_up_right"`; click → `navigate(\`/servicios/${s.id}\`)`. Envolver el grid en `<ScrollReveal>`.
- `ClientTestimonials`: `section container` + `section-head`; grid `.testi-grid` de tarjetas `.testi-card` con `<blockquote>{quote}</blockquote>` y pie con avatar (`.testi-avatar` con `initials(company)`) + `company`. Helper `const initials = (n) => n.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();`. Envolver en `<ScrollReveal>`.
- `AboutTeaser`: bloque tipo `.how`/feature (2 columnas o banda): `eyebrow` "// Conócenos", `h2`, copy corto (marca 100% mexicana, cobertura CDMX·Sonora·Yucatán derivada de `OFFICES.map(o=>o.name)`), y `<Button variant="primary" iconRight="arrow_right" onClick={() => navigate('/conocenos')}>Conócenos</Button>`.
- Usa `Icon` sólo con nombres existentes (p. ej. `arrow_right`, `arrow_up_right`, `sparkle`). No inventes nombres de icono.

- [ ] **Step 4: Añadir CSS mínimo a `gi-screens.css`**

Sólo si los patrones existentes no bastan, agregar reglas para `.svc-strip-grid`/`.svc-strip-card`, `.testi-grid`/`.testi-card`/`.testi-avatar`, y el bloque `AboutTeaser` — usando tokens de API-GI (`--accent`, `--ink`, `--line`, `--bg-elev`, `--r-lg`, `--s-*`, `--font-display`). Reusar `.cat-card`/`.how`/`.feat-strip` donde aplique para minimizar CSS nuevo.

- [ ] **Step 5: Ejecutar test (GREEN) + lint**

Run: `npx vitest run app/components/gi/HomeGiSections.test.jsx` → PASS.
Run: `npx eslint app/components/gi/HomeGiSections.jsx app/components/gi/HomeGiSections.test.jsx` → 0 errores.

- [ ] **Step 6: Build**

Run: `npm run build` → succeeds. Luego `git checkout -- storefrontapi.generated.d.ts`.

- [ ] **Step 7: Commit**

```bash
git add app/components/gi/HomeGiSections.jsx app/components/gi/HomeGiSections.test.jsx app/styles/gi-screens.css
git commit -m "feat: add native API-GI home sections (services, testimonials, about teaser)"
```

---

### Task 2: Reescribir `_index.jsx` como home híbrido

**Files:**
- Modify (reescritura): `app/routes/_index.jsx`

**Interfaces:**
- Consumes: loader comercial (de `old-commerce-index.jsx`); secciones comerciales de `~/components/gi/HomeSections` (`HeroCollage`, `LookbookGrid`); `ProductCard`; `~/components/gi/HomeGiSections` (`ServicesStrip`, `ClientTestimonials`, `AboutTeaser`); `~/lib/giFragments` (`GI_PRODUCTS_QUERY`, `fetchCollectionCards`); `~/lib/gi` (`normalizeProduct`, `HOME_CATEGORIES`, `FEATURED_COLLECTIONS`, `LIFESTYLE`); `Button`, `Icon`, `ScrollReveal`, `PH` de `~/components/gi/ui`; `useApp` de `~/lib/AppContext`.

- [ ] **Step 1: Restaurar el loader y el esqueleto del home comercial**

Partir de `old-commerce-index.jsx` (`git show 1a81fac^:app/routes/_index.jsx`). Conservar VERBATIM: el `export const meta`, el `loader`/`loadCriticalData` (categorías, `featuredCollections`, `products`), y las secciones de producto que van en el lineup. Ajustar el `meta` title/description a algo producto-primero (mantener el del comercial es válido).

- [ ] **Step 2: Componer el lineup híbrido**

Reordenar/recortar a este lineup (dentro del `<div data-screen-label="01 Home">`):
1. HERO (con `HeroCollage`, del comercial)
2. CATEGORÍAS (grid `cat-grid`/`cat-card`, del comercial)
3. `<ServicesStrip />` ← nuevo
4. PRODUCTOS DESTACADOS (grid de `ProductCard`, del comercial)
5. COLECCIONES DESTACADAS (del comercial)
6. `<AboutTeaser />` ← nuevo
7. CÓMO FUNCIONA (bloque `.how` con los 4 pasos, del comercial)
8. `<ClientTestimonials />` ← nuevo
9. LOOKBOOK (`<LookbookGrid limit={6} />`, del comercial)
10. BIG CTA (del comercial)

**Quitar** del comercial: MARQUEE, SPOTLIGHT (`ProductSpotlight`), STATS (`StatsBand`), MARQUEE 2, CUSTOMIZER (`CustomizerSection`), FEATURE STRIP, FAQ (`FAQAccordion`). No importar lo que ya no se use (evitar imports muertos → lint).

- [ ] **Step 3: Lint + build**

Run: `npx eslint app/routes/_index.jsx` → 0 errores (sin imports sin usar).
Run: `npm run build` → succeeds. Luego `git checkout -- storefrontapi.generated.d.ts`.

- [ ] **Step 4: Smoke-test en dev (lo hace el controlador)**

Levantar `npm run dev`, `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → 200; confirmar en el HTML que aparecen marcadores de las 3 secciones nuevas (p. ej. un `s.title` de servicio, una `company` de testimonio, y el CTA "Conócenos") y que las secciones de producto siguen presentes. Detener dev.

- [ ] **Step 5: Commit**

```bash
git add app/routes/_index.jsx
git commit -m "feat: rebuild homepage as product-first hybrid with web sections"
```

---

## Self-Review (cobertura del spec)
- §3 lineup → Task 2 Step 2 (orden exacto, recortes).
- §4 componentes nuevos (ServicesStrip/ClientTestimonials/AboutTeaser, diseño API-GI) → Task 1.
- §5 loader/datos → Task 2 Step 1 (loader comercial restaurado) + Task 1 (datos estáticos).
- §6 archivos → File Structure + ambas tareas.
- §7 fuera de alcance → no se tocan otras páginas ni se borra marketing (respetado).
- §8 criterios → Task 1 (tests render), Task 2 (build + dev smoke), y verificación integral final (test/lint/build + smoke).

Sin placeholders. Nombres consistentes: `ServicesStrip`, `ClientTestimonials`, `AboutTeaser`, `HomeGiSections.jsx`, loader del comercial restaurado.
