# Alineación visual del storefront — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinear el storefront Hydrogen con generandoideas.com según el feedback de `docs/Página web.docx`, y corregir los dos bugs del wizard de registro.

**Architecture:** Se reusan los componentes existentes de `app/components/marketing/` dentro del home, encerrados en un wrapper `.gi-mkt` porque todo `gi-marketing.css` está namespaceado bajo esa clase. El resto son ajustes puntuales de copy, color y layout, más una migración idempotente que renombra la columna `rfc` a `razon_social`.

**Tech Stack:** React Router 7, Shopify Hydrogen 2026.4.2, Vitest, libsql/Turso, CSS plano con tokens.

**Spec:** `docs/superpowers/specs/2026-07-20-alineacion-visual-pagina-design.md`

## Global Constraints

- Rama de trabajo: `feat/alineacion-visual-pagina`. No commitear a `main`.
- Naranja de marca: `#ff8300` (Pantone 151C), disponible como `var(--accent)`.
- Gris del manual: `#636569` (Cool Gray 10C). **Solo** para el fondo de los paneles de auth.
- El gris de los títulos es un carbón más oscuro, distinto del anterior. Reusar el neutro oscuro que ya existe en `app/styles/gi-tokens.css`; no introducir un color nuevo.
- Tests: Vitest. Los archivos viven junto al código como `*.test.js` / `*.test.jsx`. Los tests de componente necesitan `// @vitest-environment jsdom` en la primera línea.
- El alias `~` resuelve a `./app`.
- Comandos: `npm test` (todo), `npx vitest run <ruta>` (un archivo), `npm run lint`.
- Fuera de alcance: Colecciones, la taxonomía de categorías de hhglobal y las imágenes en contexto. No tocar la sección "Líneas curadas para campañas precisas" del home.

---

### Task 1: Wrapper `.gi-mkt` y secciones de marketing en el home

Es la tarea de mayor riesgo y va primero: si el wrapper falla, las secciones renderizan sin estilo y sin error en consola.

**Files:**
- Modify: `app/routes/_index.jsx` (hero/cifras ~130-148, proceso ~299-326, cierre ~345-392)
- Test: `app/routes/_index.giMkt.test.jsx` (crear)

**Interfaces:**
- Consumes: `ImpactBand` de `~/components/marketing/ImpactBand`, `ProcessSection` de `~/components/marketing/ProcessSection`, `ClosingCTA` de `~/components/marketing/ClosingCTA`, `useMarketingReveal` de `~/components/marketing/MarketingLayout`
- Produces: el home queda con un contenedor `<div className="gi-mkt">` que envuelve las tres secciones importadas.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/routes/_index.giMkt.test.jsx`. El test debe montar el **componente real** de `_index.jsx`, no un árbol construido dentro del propio test: lo que se quiere atrapar es que el home olvide el wrapper, y un stub local siempre pasaría.

```jsx
// @vitest-environment jsdom
import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {createRoutesStub} from 'react-router';

vi.mock('~/lib/AppContext', () => ({
  useApp: () => ({
    isLoggedIn: false,
    openQuoteDrawer: () => {},
    openSearch: () => {},
    quoteCount: 0,
  }),
}));

import Homepage from './_index.jsx';

const datosLoader = {
  isShopLinked: true,
  categoryCards: [],
  featuredCollections: [],
  products: [],
};

describe('home: secciones de marketing', () => {
  it('envuelve ImpactBand en un ancestro .gi-mkt', () => {
    const Stub = createRoutesStub([
      {path: '/', Component: Homepage, loader: () => datosLoader},
    ]);
    render(<Stub initialEntries={['/']} />);

    const label = screen.getByText('Clientes activos');
    expect(label.closest('.gi-mkt')).not.toBeNull();
  });
});
```

Este test **debe fallar** si se quita el `<div className="gi-mkt">` de `_index.jsx`. Compruébalo a propósito en el Step 7.

Nota: montar el home real arrastra sus dependencias. `ProcessSection` importa gsap/ScrollTrigger y `ImpactBand` usa IntersectionObserver. Si alguna revienta bajo jsdom, añade el `vi.mock` que haga falta para esa dependencia — es trabajo esperado de esta tarea, no un bloqueo. Lo que no se vale es debilitar la afirmación para que pase.

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/routes/_index.giMkt.test.jsx`
Expected: FAIL con "Unable to find an element with the text: Clientes activos" — `ImpactBand` todavía no está en el home. Ese es el fallo correcto.

- [ ] **Step 3: Verificar el nombre real de los exports**

Run: `grep -n "^export" app/components/marketing/ImpactBand.jsx app/components/marketing/ProcessSection.jsx app/components/marketing/ClosingCTA.jsx app/components/marketing/MarketingLayout.jsx`
Usar exactamente lo que devuelva este comando en los imports de `_index.jsx`. No asumir named vs default.

- [ ] **Step 4: Añadir los imports y el hook en `_index.jsx`**

Agregar junto a los imports existentes:

```jsx
import {ImpactBand} from '~/components/marketing/ImpactBand';
import {ProcessSection} from '~/components/marketing/ProcessSection';
import {ClosingCTA} from '~/components/marketing/ClosingCTA';
import {useMarketingReveal} from '~/components/marketing/MarketingLayout';
```

Dentro de `export default function Homepage()`, después de los hooks existentes:

```jsx
useMarketingReveal();
```

- [ ] **Step 5: Sustituir el bloque de cifras del hero**

En `_index.jsx`, borrar el bloque de tres `<CountUp>` (aprox. líneas 128-140: `1847`, `12 años`, `420+`) y colocar `<ImpactBand />` como sección propia después del hero, envuelta:

```jsx
<div className="gi-mkt">
  <ImpactBand />
</div>
```

Si tras borrar los `CountUp` el import de `CountUp` en la línea 4 queda sin uso, quitarlo de la lista de imports.

- [ ] **Step 6: Sustituir proceso y cierre**

Reemplazar la sección de proceso (la que abre en la línea ~299) por `<ProcessSection />` y la de cierre (~345) por `<ClosingCTA />`, ambas dentro de un `<div className="gi-mkt">`. Se pueden agrupar en un solo wrapper si quedan contiguas.

- [ ] **Step 7: Correr el test y comprobar que de verdad protege**

Run: `npx vitest run app/routes/_index.giMkt.test.jsx`
Expected: PASS

Ahora la comprobación que da valor al test: quita temporalmente el `className="gi-mkt"` del wrapper y vuelve a correrlo.
Expected: FAIL. Si pasa igual, el test no sirve — arréglalo antes de continuar. Restaura el `className` al terminar.

- [ ] **Step 8: Ajustar los botones de `ClosingCTA`**

`ClosingCTA` se comparte con las rutas de marketing, así que este cambio **también afecta a `/conocenos`, `/servicios` y `/blog`**, que lo montan vía `MarketingLayout`. Es el precio del enfoque de fuente única y es el resultado buscado: el documento pide que ambos lados coincidan.

En `app/components/marketing/ClosingCTA.jsx`: apuntar el CTA "Cotizar" a la ruta de catálogo y eliminar el botón "Ver e-store" junto con su import si queda huérfano.
Run primero: `grep -n "Cotizar\|e-store\|estore\|to=\|href=" app/components/marketing/ClosingCTA.jsx` para ver los destinos actuales, y `grep -n "catalogo" app/lib/site-content.js` por si `ROUTES` ya tiene la constante del catálogo — usarla en vez de escribir la ruta a mano.

Después del cambio, abrir `/conocenos` y confirmar que su cierre sigue coherente.

- [ ] **Step 9: Verificar visualmente que renderizan CON estilo**

Run: `npm run dev` y abrir el home.
Expected: las tres secciones se ven estilizadas (fondo oscuro en `ImpactBand`, números grandes, hairlines). **Si se ven como texto plano sin formato, el wrapper no está aplicando** — revisar que `.gi-mkt` esté en un ancestro real y no como hermano.
Verificar también que las secciones `gi/` vecinas no cambiaron de aspecto.

- [ ] **Step 10: Correr lint y tests**

Run: `npm run lint && npm test`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add app/routes/_index.jsx app/routes/_index.giMkt.test.jsx app/components/marketing/ClosingCTA.jsx
git commit -m "feat(home): reusar secciones de marketing bajo wrapper .gi-mkt"
```

---

### Task 2: Eliminar secciones del home y limpiar el hero

**Files:**
- Modify: `app/routes/_index.jsx`

- [ ] **Step 1: Quitar el badge y el chip del hero**

En el hero, eliminar el badge `v2.0 · Catálogo 2026 disponible` y el chip flotante `DE 2 CONTENEDORES SOTIRA` sobre el collage. Ambos aparecen resaltados en amarillo en la imagen 3 del documento.

- [ ] **Step 2: Localizar el widget de chat**

Run: `grep -rn "Chatea con nosotros\|chat" app/ --include='*.jsx' --include='*.js' --include='*.css'`
Eliminar el widget que renderiza "Chatea con nosotros, ¡estamos online!". Si resulta ser un script de terceros inyectado fuera del repo, **no borrar código a ciegas**: anotarlo y reportarlo al revisar la tarea.

- [ ] **Step 3: Eliminar la sección Destacado**

Borrar la sección que abre en la línea ~202 con el título "Lo más cotizado este mes."

- [ ] **Step 4: Eliminar Quiénes somos y Lookbook**

Borrar `<AboutTeaser />` (~296) y la sección "Ediciones curadas por temporada." junto con `<LookbookGrid limit={6} />` (~331-341).

- [ ] **Step 5: Limpiar imports y loader huérfanos**

Quitar de los imports `AboutTeaser`, `LookbookGrid` y cualquier otro que quede sin uso. Revisar si `loadCriticalData` sigue necesitando todo lo que consulta: si `products` solo alimentaba la sección Destacado, dejar de pedirlo evita una query inútil en cada carga. `heroImages` y `featured` sí siguen en uso por `HeroCollage`.

- [ ] **Step 6: Verificar**

Run: `npm run lint && npm test && npm run dev`
Expected: lint sin variables sin usar; el home carga sin huecos ni errores en consola.

- [ ] **Step 7: Commit**

```bash
git add app/routes/_index.jsx
git commit -m "feat(home): eliminar destacado, quiénes somos, lookbook y adornos del hero"
```

---

### Task 3: Header

**Files:**
- Modify: `app/components/gi/Header.jsx:17-27` (logo), `app/components/gi/Header.jsx:43-49` (nav), `app/components/gi/Header.jsx:51+` (actions)
- Modify: `app/styles/gi-tokens.css:410` (`.appbar`), `:473-482` (`.appbar-nav a`)
- Test: `app/components/marketing/navActive.test.js` (existente — no romperlo)

- [ ] **Step 1: Agrandar el logo**

En `Header.jsx:17-27`, cambiar `width={160} height={34}` por `width={200} height={42}`. Verificar que `.brand-logo` en CSS no imponga un alto fijo que anule el atributo; si lo hace, ajustar ahí.

- [ ] **Step 2: Cambiar el estado activo del nav**

En `app/styles/gi-tokens.css:482`, reemplazar:

```css
.appbar-nav a.active { background: var(--ink); color: var(--bg-elev); }
```

por:

```css
.appbar-nav a.active {
  background: var(--bg-soft);
  color: var(--ink);
  border-bottom: 2px solid var(--accent);
  border-radius: 6px 6px 0 0;
}
```

- [ ] **Step 3: Verificar que el test de nav sigue pasando**

Run: `npx vitest run app/components/marketing/navActive.test.js`
Expected: PASS. Ese test cubre qué link se marca activo, no su color, así que no debería verse afectado.

- [ ] **Step 4: Añadir las redes sociales**

Run primero: `grep -n "^export" app/components/marketing/SocialIcons.jsx` para conocer el nombre y las props.
Insertar el componente en `.appbar-actions` (`Header.jsx:51+`), antes del botón de búsqueda. Las redes de la página son Instagram, Facebook, LinkedIn y WhatsApp.
Si `SocialIcons` trae estilos que dependen de `.gi-mkt`, envolverlo en un `<div className="gi-mkt">` en línea o replicar el estilo mínimo en `.appbar-actions`.

- [ ] **Step 5: Barra blanca al hacer scroll**

En `.appbar` (`gi-tokens.css:410`), sustituir el fondo translúcido por uno opaco. Si el estado translúcido depende de una clase que se agrega al hacer scroll, ajustar esa regla; si es un `backdrop-filter` fijo, quitarlo y poner `background: var(--bg-elev)`.

- [ ] **Step 6: Verificar en navegador**

Run: `npm run dev`
Expected: logo más grande; "Inicio" con fondo gris claro y línea naranja, sin pill negro; iconos de redes visibles; al hacer scroll la barra es sólida y el contenido no se transparenta detrás.

- [ ] **Step 7: Commit**

```bash
git add app/components/gi/Header.jsx app/styles/gi-tokens.css
git commit -m "feat(header): logo mayor, estado activo naranja, redes sociales y barra opaca"
```

---

### Task 4: Encabezados de Clientes y Servicios

**Files:**
- Modify: `app/components/gi/HomeGiSections.jsx:23-27` (Servicios), `:67-71` (Clientes)
- Test: `app/components/gi/HomeGiSections.test.jsx` (existente — **este cambio lo puede romper**)

- [ ] **Step 1: Revisar el test existente antes de tocar nada**

Run: `npx vitest run app/components/gi/HomeGiSections.test.jsx`
Expected: PASS ahora. Leer el archivo: afirma sobre `TESTIMONIALS[0].company`, no sobre el encabezado, así que debería sobrevivir. Si afirma sobre el título viejo, actualizar el test junto con el componente en esta misma tarea.

- [ ] **Step 2: Cambiar el encabezado de Servicios**

En `HomeGiSections.jsx:25`, cambiar el eyebrow:

```jsx
<div className="eyebrow">// Servicios</div>
```

El título de la línea 26 ("Cinco servicios, una sola relación.") ya coincide con la página; lo que cambia es el color, que se atiende en la Task 5.

- [ ] **Step 3: Cambiar el encabezado de Clientes**

En `HomeGiSections.jsx:69-71`, reemplazar por el encabezado de la página (imagen 17 del documento):

```jsx
<div className="eyebrow">Lo que dicen nuestros clientes</div>
<h2>
  Relaciones que <span className="text-accent">duran años.</span>
</h2>
```

Las tarjetas de testimonios **no se tocan**: el documento pide conservar el diseño de la API.
Verificar que `.text-accent` aplique fuera de `.gi-mkt`; si está namespaceada, usar `style={{color: 'var(--accent)'}}` o añadir una utilidad equivalente en `gi-tokens.css`.

- [ ] **Step 4: Cuadros de servicios en gris con texto blanco**

En el bloque de tarjetas de `ServicesStrip`, cambiar el fondo a gris claro con texto blanco. Localizar la clase con `grep -n "class" app/components/gi/HomeGiSections.jsx` y ajustar la regla correspondiente en `app/styles/gi-sections.css`.
Verificar contraste: texto blanco sobre gris claro puede quedar ilegible. Si el resultado no alcanza contraste AA, usar el gris del manual `#636569`, que sí lo sostiene, y anotarlo al reportar la tarea.

- [ ] **Step 5: Verificar**

Run: `npm run lint && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/components/gi/HomeGiSections.jsx app/styles/gi-sections.css
git commit -m "feat(home): encabezados de clientes y servicios según la página"
```

---

### Task 5: Tipografía de títulos, categorías y CTA

**Files:**
- Modify: `app/routes/_index.jsx` (sección categorías ~154-198, CTA del hero)
- Modify: `app/lib/gi.js:HOME_CATEGORIES`
- Modify: `app/styles/gi-sections.css` o `gi-tokens.css` (color de `h2`)
- Test: `app/lib/gi.categorias.test.js` (crear)

- [ ] **Step 1: Escribir el test del orden alfabético**

Crear `app/lib/gi.categorias.test.js`:

```js
import {describe, it, expect} from 'vitest';
import {HOME_CATEGORIES} from './gi.js';

describe('HOME_CATEGORIES', () => {
  it('está ordenada alfabéticamente por nombre', () => {
    const nombres = HOME_CATEGORIES.map((c) => c.name);
    const ordenados = [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
    expect(nombres).toEqual(ordenados);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/lib/gi.categorias.test.js`
Expected: FAIL — el orden actual es Bebidas, Ecológicos, Hogar, Tecnología, Oficina, Textil, Mochilas y maletas, Bienestar.

- [ ] **Step 3: Reordenar el arreglo**

En `app/lib/gi.js`, dejar `HOME_CATEGORIES` así (mismos handles e iconos, solo cambia el orden):

```js
export const HOME_CATEGORIES = [
  {handle: 'bebidas', name: 'Bebidas', icon: 'drink'},
  {handle: 'salud-y-bienestar', name: 'Bienestar', icon: 'heart'},
  {handle: 'ecologicos', name: 'Ecológicos', icon: 'leaf'},
  {handle: 'hogar', name: 'Hogar', icon: 'home'},
  {handle: 'mochilas-y-maletas', name: 'Mochilas y maletas', icon: 'bag'},
  {handle: 'oficina', name: 'Oficina', icon: 'office'},
  {handle: 'tecnologia', name: 'Tecnología', icon: 'tech'},
  {handle: 'textil', name: 'Textil', icon: 'shirt'},
];
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run app/lib/gi.categorias.test.js`
Expected: PASS

- [ ] **Step 5: Resaltar "categoría" en naranja**

En `_index.jsx:158`, cambiar `<h2>Encuentra por categoría.</h2>` por:

```jsx
<h2>Encuentra por <span style={{color: 'var(--accent)'}}>categoría.</span></h2>
```

- [ ] **Step 6: Color de títulos — gris oscuro en vez de negro**

Localizar la regla que define el color de los `h2` de sección y cambiarla de negro al neutro oscuro existente en tokens. **No** usar `#636569`, que es el gris de los paneles de auth y resulta demasiado claro para un título.
Run: `grep -n "\-\-ink" app/styles/gi-tokens.css | head` para ver los neutros disponibles y elegir el más oscuro que no sea negro puro.

- [ ] **Step 7: CTA "Explorar catálogo"**

Cambiar el botón de tono oscuro a gris, y su destino de todos los productos a la sección de categorías. Si la sección de categorías vive en el propio home, apuntar a su ancla (`href="#categorias"` más `id="categorias"` en la sección); si vive en `/catalogo`, apuntar ahí.

- [ ] **Step 8: Carrusel o botón "ver más"**

Mostrar las 8 categorías en carrusel horizontal, o mostrar 6 y añadir un botón "Ver más" que lleve a la vista completa. Elegir la opción que menos código nuevo requiera; si ya existe un carrusel en el repo, reusarlo.
Run: `grep -rln "carousel\|carrusel\|scroll-snap" app/components app/styles` antes de escribir uno desde cero.

- [ ] **Step 9: Verificar**

Run: `npm run lint && npm test && npm run dev`
Expected: PASS; categorías en orden alfabético, "categoría." en naranja, títulos en gris oscuro.

- [ ] **Step 10: Commit**

```bash
git add app/lib/gi.js app/lib/gi.categorias.test.js app/routes/_index.jsx app/styles/
git commit -m "feat(home): orden alfabético de categorías, acentos naranja y CTA a categorías"
```

---

### Task 6: Paneles de auth y eliminación del testimonio falso

**Files:**
- Modify: `app/routes/login.jsx:130-161`
- Modify: `app/routes/registro.jsx:247-275`
- Modify: `app/lib/gi.js:206-210` (borrar `REVIEWS`)
- Modify: `app/styles/` (regla `.auth-side`)
- Test: `app/routes/login.testimonio.test.js` (crear)

- [ ] **Step 1: Escribir el test que impide que el testimonio falso regrese**

Crear `app/routes/login.testimonio.test.js`. Es a propósito un guard sobre el código fuente, no un test de render: lo que se protege es una regla de contenido — que no vuelva a aparecer un testimonio fabricado — y eso incluye el borrado del array `REVIEWS`, que ningún render alcanzaría. No lleva `jsdom` porque no toca el DOM.

```js
import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';

describe('panel de login', () => {
  it('no contiene el testimonio fabricado', () => {
    const src = readFileSync('app/routes/login.jsx', 'utf8');
    expect(src).not.toMatch(/MARIANA RUIZ/i);
    expect(src).not.toMatch(/BANORTE/i);
  });

  it('no quedan datos demo de REVIEWS en gi.js', () => {
    const src = readFileSync('app/lib/gi.js', 'utf8');
    expect(src).not.toMatch(/export const REVIEWS/);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/routes/login.testimonio.test.js`
Expected: FAIL en ambos casos.

- [ ] **Step 3: Borrar el testimonio y los datos demo**

En `login.jsx`, eliminar el bloque `<div className="auth-quote">` completo (líneas 155-160).
En `app/lib/gi.js`, eliminar el arreglo `REVIEWS` (líneas 206-210). Ya se confirmó que no se usa en ningún otro archivo.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run app/routes/login.testimonio.test.js`
Expected: PASS

- [ ] **Step 5: Cambiar los títulos de los paneles**

En `login.jsx:135-139`:

```jsx
<h2>Accede a información <em>exclusiva</em>.</h2>
```

En `registro.jsx:252-256`:

```jsx
<h2>Estás a un clic de tus <em>beneficios</em>.</h2>
```

El `<em>` es lo que va en naranja (Step 7).

- [ ] **Step 6: Quitar los bullets pedidos**

En `login.jsx:142-147`, borrar `'Asesor de cuenta dedicado'`.
En `registro.jsx:259-265`, borrar `'Asesor asignado en 24 hrs'` y `'Soporte humano por WhatsApp'`.

- [ ] **Step 7: Fondo gris y acentos naranja**

Localizar `.auth-side`:
Run: `grep -rn "auth-side\|auth-quote\|auth-perks" app/styles/`
Cambiar el fondo de negro a `#636569`. Asegurar que el `<em>` del `h2` use `var(--accent)` y que el texto del panel siga legible sobre el gris nuevo — el gris es más claro que el negro, así que revisar los textos con opacidad reducida (por ejemplo el `rgba(244,242,236,0.5)` de `registro.jsx:272`) y subirlos si pierden contraste.

- [ ] **Step 8: Botón de iniciar sesión en naranja**

En `login.jsx`, el botón de submit pasa a fondo naranja con texto blanco. Si `Button variant="primary"` se usa en otros lados, **no** cambiar la variante global: aplicar el color en esta instancia o crear una variante `accent`.
Run: `grep -rn "variant=\"primary\"" app/ | wc -l` para dimensionar el impacto antes de decidir.

- [ ] **Step 9: Verificar**

Run: `npm run lint && npm test && npm run dev`, y abrir `/login` y `/registro`.
Expected: paneles en gris, títulos nuevos con la palabra en naranja, sin los bullets eliminados, sin testimonio, botón naranja.

- [ ] **Step 10: Commit**

```bash
git add app/routes/login.jsx app/routes/registro.jsx app/lib/gi.js app/styles/ app/routes/login.testimonio.test.js
git commit -m "feat(auth): paneles en gris de marca y eliminación del testimonio fabricado"
```

---

### Task 7: Migración `rfc` → `razon_social`

Toca base de datos. Va en su propio commit para poder revertirla sola.

**Files:**
- Modify: `app/lib/db/migrate.js` (columna en el CREATE TABLE + helper nuevo)
- Modify: `app/lib/auth/users.js:2,25,38,47,56,68,87,116,118,124`
- Modify: `app/routes/auth.signup.jsx:20,39`
- Modify: `app/routes/account.profile.jsx:45,48,112,115,116,119`
- Modify: `app/routes/registro.jsx:20,56,143-153`
- Test: `app/lib/db/migrate.razonSocial.test.js` (crear)

**Interfaces:**
- Produces: `renameColumnIfPresent(db, table, from, to)` en `migrate.js` (no exportada, uso interno). `createUser` y `updateProfile` pasan a recibir `razonSocial` en lugar de `rfc`. El objeto usuario expone `razonSocial`.

- [ ] **Step 1: Escribir el test de la migración**

Crear `app/lib/db/migrate.razonSocial.test.js`. Cubre los dos caminos: base vieja con datos, y base nueva.

```js
import {describe, it, expect} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from './migrate.js';

async function columnas(db, tabla) {
  const res = await db.execute(`PRAGMA table_info(${tabla})`);
  return res.rows.map((r) => r.name);
}

describe('migración rfc -> razon_social', () => {
  it('renombra la columna y conserva el dato en una base existente', async () => {
    const db = createClient({url: ':memory:'});
    await db.execute(`CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL,
      password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL, session_version INTEGER NOT NULL DEFAULT 1,
      rfc TEXT, role TEXT NOT NULL DEFAULT 'quoter',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    await db.execute({
      sql: `INSERT INTO users (id,email,password_hash,password_salt,password_iterations,rfc,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?)`,
      args: ['u1', 'a@b.mx', 'h', 's', 1, 'ACM010203XXX', '2026-01-01', '2026-01-01'],
    });

    await migrate(db);

    const cols = await columnas(db, 'users');
    expect(cols).toContain('razon_social');
    expect(cols).not.toContain('rfc');

    const res = await db.execute(`SELECT razon_social FROM users WHERE id = 'u1'`);
    expect(res.rows[0].razon_social).toBe('ACM010203XXX');
  });

  it('en una base nueva crea razon_social y no falla al correr dos veces', async () => {
    const db = createClient({url: ':memory:'});
    await migrate(db);
    await migrate(db);

    const cols = await columnas(db, 'users');
    expect(cols).toContain('razon_social');
    expect(cols).not.toContain('rfc');
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/lib/db/migrate.razonSocial.test.js`
Expected: FAIL — la columna sigue llamándose `rfc`.

- [ ] **Step 3: Cambiar la columna en el CREATE TABLE**

En `app/lib/db/migrate.js`, dentro del `CREATE TABLE IF NOT EXISTS users`, cambiar la línea `rfc TEXT,` por:

```sql
    razon_social         TEXT,
```

- [ ] **Step 4: Añadir el helper de rename idempotente**

En `migrate.js`, junto a `addColumnIfMissing`:

```js
async function renameColumnIfPresent(db, table, from, to) {
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const cols = info.rows.map((r) => r.name);
  if (cols.includes(from) && !cols.includes(to)) {
    await db.execute(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
  }
}
```

Y llamarlo dentro de `migrate()`, después de las llamadas a `addColumnIfMissing`:

```js
  await renameColumnIfPresent(db, 'users', 'rfc', 'razon_social');
```

El orden importa: `CREATE TABLE IF NOT EXISTS` no altera una tabla existente, así que en bases viejas la columna sigue siendo `rfc` hasta que corre el rename. En bases nuevas el rename no hace nada porque `rfc` no existe.

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run app/lib/db/migrate.razonSocial.test.js`
Expected: PASS en los dos casos.

- [ ] **Step 6: Actualizar `users.js`**

Renombrar en `app/lib/auth/users.js`: el comentario de la línea 2, el mapeo `rfc: row.rfc ?? null` (25) a `razonSocial: row.razon_social ?? null`, la columna en `SELECT_COLS` (38), el parámetro y el INSERT de `createUser` (47, 56, 68, 87), y el parámetro, el UPDATE y el arg de `updateProfile` (116, 118, 124).
La convención es `snake_case` en SQL y `camelCase` en JS, así que la columna es `razon_social` y la propiedad `razonSocial`.

- [ ] **Step 7: Actualizar las rutas**

`app/routes/auth.signup.jsx:20,39` — leer `form.get('razonSocial')` y pasar `razonSocial` a `createUser`.
`app/routes/account.profile.jsx:45,48,112,115,116,119` — el campo pasa a `name="razonSocial"`, `id="razonSocial"`, `defaultValue={user?.razonSocial ?? ''}` y la etiqueta a `Razón social`.
`app/routes/registro.jsx:20,56` — la clave del estado pasa de `rfc` a `razonSocial` y el input oculto a `name="razonSocial"`.

- [ ] **Step 8: Actualizar el campo del paso 2 del wizard**

En `registro.jsx:142-154`:

```jsx
<div className="field">
  <label htmlFor="reg-razon-social">Razón social (opcional)</label>
  <input
    id="reg-razon-social"
    className="input"
    value={form.razonSocial}
    onChange={(e) => setField('razonSocial', e.target.value)}
    placeholder="Acme Corporativo S.A. de C.V."
  />
  <span className="help-msg">
    Si la proporcionas ahora aceleramos la apertura de crédito.
  </span>
</div>
```

- [ ] **Step 9: Verificar que no queda ninguna referencia**

Run: `grep -rn "rfc\|RFC" app/ --include='*.js' --include='*.jsx'`
Expected: sin resultados, salvo el helper `renameColumnIfPresent` y su test, que sí mencionan `rfc` a propósito.

- [ ] **Step 10: Correr toda la suite**

Run: `npm run lint && npm test`
Expected: PASS. Si `users.emailReset.test.js` u otro test construye usuarios con `rfc`, actualizarlo.

- [ ] **Step 11: Commit**

```bash
git add app/lib/db/migrate.js app/lib/db/migrate.razonSocial.test.js app/lib/auth/users.js app/routes/auth.signup.jsx app/routes/account.profile.jsx app/routes/registro.jsx
git commit -m "feat(auth): renombrar rfc a razon_social con migración idempotente"
```

---

### Task 8: Validación por paso en el wizard de registro

Corrige el bug raíz: hoy `registro.jsx:231` avanza de paso sin validar nada.

**Files:**
- Create: `app/routes/registro.validation.js`
- Create: `app/routes/registro.validation.test.js`
- Create: `app/routes/api.auth.check-email.jsx`
- Modify: `app/routes/registro.jsx:214-236`

**Interfaces:**
- Produces: `validateStep(step, form) -> {campo: mensaje}` — objeto vacío si el paso es válido.
- Produces: endpoint `GET /api/auth/check-email?email=<correo>` que responde `{disponible: boolean}`.

- [ ] **Step 1: Escribir el test de validación**

Crear `app/routes/registro.validation.test.js`:

```js
import {describe, it, expect} from 'vitest';
import {validateStep} from './registro.validation.js';

const base = {
  name: 'Ana', lastName: 'Pérez', email: 'ana@empresa.mx',
  password: 'secreto123', company: 'Acme', volume: 'Menos de $50,000 MXN',
};

describe('validateStep', () => {
  it('acepta un paso 1 completo', () => {
    expect(validateStep(1, base)).toEqual({});
  });

  it('exige nombre y apellido', () => {
    const errs = validateStep(1, {...base, name: '  ', lastName: ''});
    expect(errs.name).toBeTruthy();
    expect(errs.lastName).toBeTruthy();
  });

  it('rechaza un correo mal formado', () => {
    expect(validateStep(1, {...base, email: 'ana@'}).email).toBeTruthy();
  });

  it('exige contraseña de al menos 8 caracteres', () => {
    expect(validateStep(1, {...base, password: 'corta'}).password).toBeTruthy();
  });

  it('acepta un paso 2 completo y exige empresa y volumen', () => {
    expect(validateStep(2, base)).toEqual({});
    const errs = validateStep(2, {...base, company: '', volume: ''});
    expect(errs.company).toBeTruthy();
    expect(errs.volume).toBeTruthy();
  });

  it('no bloquea el paso 3, cuyos campos son opcionales', () => {
    expect(validateStep(3, base)).toEqual({});
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/routes/registro.validation.test.js`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar la validación**

Crear `app/routes/registro.validation.js`:

```js
// Validación por paso del wizard de registro. Pura y sin dependencias para
// poder probarla sin DOM; el chequeo de disponibilidad del correo es aparte
// porque requiere servidor.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStep(step, form) {
  const errores = {};

  if (step === 1) {
    if (!String(form.name ?? '').trim()) errores.name = 'Ingresa tu nombre.';
    if (!String(form.lastName ?? '').trim()) errores.lastName = 'Ingresa tu apellido.';
    if (!EMAIL_RE.test(String(form.email ?? ''))) errores.email = 'Ingresa un correo válido.';
    if (String(form.password ?? '').length < 8) {
      errores.password = 'La contraseña debe tener al menos 8 caracteres.';
    }
  }

  if (step === 2) {
    if (!String(form.company ?? '').trim()) errores.company = 'Ingresa el nombre de la empresa.';
    if (!String(form.volume ?? '')) errores.volume = 'Selecciona un volumen estimado.';
  }

  return errores;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run app/routes/registro.validation.test.js`
Expected: PASS

- [ ] **Step 5: Crear el endpoint de disponibilidad de correo**

Crear `app/routes/api.auth.check-email.jsx`:

```jsx
import {findByEmail, normalizeEmail} from '~/lib/auth/users';
import {getDb} from '~/lib/db/client';

export async function loader({request, context}) {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get('email') ?? '');
  if (!email) return Response.json({disponible: false});

  const db = getDb(context.env);
  const existente = await findByEmail(db, email);
  return Response.json({disponible: !existente});
}
```

Run antes de escribirlo: `grep -n "^export" app/lib/db/client.js` para confirmar el nombre real del helper que obtiene la conexión, y `grep -n "getDb\|createDb" app/routes/auth.signup.jsx` para copiar exactamente el patrón que ya usan las rutas.

Nota de seguridad: este endpoint permite enumerar correos registrados. El formulario ya revelaba lo mismo al enviar, así que no agrega exposición nueva, pero **no debe** devolver más datos que el booleano.

- [ ] **Step 6: Conectar la validación al botón Continuar**

En `registro.jsx`, añadir estado de errores e invocar la validación antes de avanzar:

```jsx
const [errores, setErrores] = useState({});
const [revisandoEmail, setRevisandoEmail] = useState(false);

async function continuar() {
  const errs = validateStep(step, form);
  if (Object.keys(errs).length > 0) {
    setErrores(errs);
    return;
  }
  if (step === 1) {
    setRevisandoEmail(true);
    try {
      const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(form.email)}`);
      const {disponible} = await res.json();
      if (!disponible) {
        setErrores({email: 'Ese correo ya está registrado.'});
        return;
      }
    } catch {
      // Si el chequeo falla por red, dejamos avanzar: el servidor vuelve a
      // validar al enviar, así que no bloqueamos el registro por eso.
    } finally {
      setRevisandoEmail(false);
    }
  }
  setErrores({});
  setStep(step + 1);
}
```

Cambiar el `onClick` de la línea 231 por `onClick={step === 3 ? undefined : continuar}` y añadir `disabled={revisandoEmail}` al botón.

- [ ] **Step 7: Mostrar los errores junto a cada campo**

Debajo de cada input de los pasos 1 y 2, renderizar su error:

```jsx
{errores.email && (
  <span className="help-msg" role="alert" style={{color: 'var(--danger, #c0392b)'}}>
    {errores.email}
  </span>
)}
```

Repetir el patrón para `name`, `lastName`, `password`, `company` y `volume`, cada uno bajo su campo.

- [ ] **Step 8: Verificar el bug original a mano**

Run: `npm run dev`, ir a `/registro` y capturar el caso exacto del documento: usar un correo **ya registrado**, llenar el paso 1 y pulsar Continuar.
Expected: el error "Ese correo ya está registrado." aparece **en el paso 1**, sin avanzar. Antes solo salía tras completar el paso 3.
Probar también dejar campos vacíos: debe señalar el campo y no avanzar.

- [ ] **Step 9: Correr lint y tests**

Run: `npm run lint && npm test`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add app/routes/registro.validation.js app/routes/registro.validation.test.js app/routes/api.auth.check-email.jsx app/routes/registro.jsx
git commit -m "fix(registro): validar cada paso antes de avanzar en vez de al final"
```

---

### Task 9: Ver contraseña y enlace al aviso de privacidad

**Files:**
- Modify: `app/routes/registro.jsx:102-114` (contraseña), `:207-209` (checkbox)

- [ ] **Step 1: Añadir el toggle de contraseña**

En `registro.jsx`, agregar estado y botón dentro del campo:

```jsx
const [verPassword, setVerPassword] = useState(false);
```

```jsx
<div className="field">
  <label htmlFor="reg-password">Contraseña</label>
  <div style={{position: 'relative'}}>
    <input
      id="reg-password"
      className="input"
      type={verPassword ? 'text' : 'password'}
      minLength={8}
      required
      value={form.password}
      onChange={(e) => setField('password', e.target.value)}
      placeholder="Mínimo 8 caracteres"
      style={{paddingRight: 44}}
    />
    <button
      type="button"
      onClick={() => setVerPassword((v) => !v)}
      aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-pressed={verPassword}
      style={{
        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', padding: 8,
        color: 'var(--ink-3)',
      }}
    >
      <Icon name={verPassword ? 'eye_off' : 'eye'} size={18} />
    </button>
  </div>
</div>
```

Run: `grep -n "eye" app/components/gi/Icon.jsx` para confirmar los nombres de icono disponibles. Si no existen `eye`/`eye_off`, usar los que sí estén o añadirlos al set de iconos.

- [ ] **Step 2: Enlazar el aviso de privacidad**

Importar la constante de rutas y enlazar en el checkbox del paso 3:

```jsx
import {ROUTES} from '~/lib/site-content';
```

```jsx
<span>
  Acepto el{' '}
  <a
    href={ROUTES.privacy}
    target="_blank"
    rel="noreferrer"
    style={{color: 'var(--accent)', textDecoration: 'underline'}}
  >
    Aviso de privacidad
  </a>{' '}
  y los Términos de uso de Generando Ideas.
</span>
```

`ROUTES.privacy` ya existe en `app/lib/site-content.js:95` y apunta a `/legal/aviso-de-privacidad-esi-2026.pdf`.

- [ ] **Step 3: Verificar que el PDF existe**

Run: `ls public/legal/`
Expected: aparece `aviso-de-privacidad-esi-2026.pdf`. Si no está, el enlace daría 404 — reportarlo en la revisión en lugar de inventar una ruta.

- [ ] **Step 4: Verificar a mano**

Run: `npm run dev` y abrir `/registro`.
Expected: el ojo alterna entre texto y puntos; el enlace del aviso abre el PDF en pestaña nueva.

- [ ] **Step 5: Correr lint y tests**

Run: `npm run lint && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/routes/registro.jsx
git commit -m "feat(registro): ver contraseña y enlace al aviso de privacidad"
```

---

### Task 10: Catálogo — sidebar de filtros y categoría individual

**Files:**
- Modify: `app/styles/gi-screens.css` (sidebar de filtros, cerca de `.cat-filter-list` en :1034)
- Modify: `app/routes/collections.$handle.jsx`

- [ ] **Step 1: Reproducir el bug antes de tocar nada**

Run: `npm run dev`, abrir `/catalogo` con una categoría de muchos productos y hacer scroll.
Documentar el síntoma exacto: qué parte del sidebar se corta y en qué momento reaparece. **No** asumir la causa.

- [ ] **Step 2: Diagnosticar**

Run: `grep -n "sticky\|position\|overflow\|max-height\|height" app/styles/gi-screens.css | sed -n '1,40p'` y localizar las reglas del contenedor del sidebar.
Causas típicas, en orden de probabilidad: un `position: sticky` cuyo ancestro tiene `overflow` distinto de `visible` (lo desactiva), un `max-height` sin `overflow-y: auto`, o un `top` que no considera la altura del header.
Confirmar cuál es con el inspector antes de editar.

- [ ] **Step 3: Corregir la causa encontrada**

Aplicar el arreglo mínimo. Si es `sticky` con altura, la forma habitual es:

```css
.cat-filters {
  position: sticky;
  top: calc(var(--appbar-h, 64px) + 16px);
  max-height: calc(100vh - var(--appbar-h, 64px) - 32px);
  overflow-y: auto;
}
```

Ajustar el nombre de la clase al real y usar la variable de altura del header si existe; si no, medirla y dejarla como constante documentada.

- [ ] **Step 4: Verificar en varios tamaños**

Run: `npm run dev`
Expected: el sidebar se ve completo durante todo el scroll, en escritorio y en pantallas cortas (por ejemplo 800px de alto). En móvil no debe quedar fijo ocupando la pantalla.

- [ ] **Step 5: Categoría individual — imagen de portada y cifras**

En `app/routes/collections.$handle.jsx`: usar la misma imagen de portada que muestra la categoría en el listado, y eliminar los contadores de producto y producción.
Run: `grep -n "image\|cifra\|count\|producción" app/routes/collections.\$handle.jsx` para ubicarlos.

- [ ] **Step 6: Agregar filtros a la categoría**

Reusar el mismo componente de filtros del catálogo en la vista de categoría. Localizarlo con `grep -rn "cat-filter-list" app/components app/routes` y montarlo, en lugar de escribir uno nuevo.

- [ ] **Step 7: Verificar**

Run: `npm run lint && npm test && npm run dev`
Expected: PASS; la categoría muestra portada, filtros y sin cifras.

- [ ] **Step 8: Commit**

```bash
git add app/styles/gi-screens.css app/routes/collections.\$handle.jsx
git commit -m "fix(catálogo): sidebar de filtros completo y ajustes de categoría individual"
```

---

### Task 11: Título de la página de Servicios

**Files:**
- Modify: `app/routes/servicios._index.jsx:39-108`

- [ ] **Step 1: Reducir el título**

Localizar el `h1` de la página y bajar su tamaño. Si usa una clase compartida con otras páginas, **no** cambiar la clase global: aplicar el tamaño solo en esta ruta.
Run: `grep -n "h1\|hero\|title" app/routes/servicios._index.jsx | head`

- [ ] **Step 2: Verificar**

Run: `npm run dev` y abrir `/servicios`.
Expected: el título es visiblemente menor y las otras páginas no cambian.

- [ ] **Step 3: Correr lint y tests**

Run: `npm run lint && npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/routes/servicios._index.jsx
git commit -m "feat(servicios): reducir el tamaño del título"
```

---

## Cierre

- [ ] **Suite completa en verde**

Run: `npm run lint && npm test`
Expected: PASS

- [ ] **Recorrido manual del home**

Confirmar contra las imágenes del documento: header, hero sin adornos, cifras nuevas, categorías alfabéticas, servicios, proceso, clientes y cierre. Verificar de nuevo que las secciones envueltas en `.gi-mkt` conservan su estilo.

- [ ] **Recorrido del registro de punta a punta**

Crear una cuenta real y **seguir hasta el final**, incluyendo la verificación por correo (`app/routes/auth.verify.jsx`). Ese tramo nunca se ha validado porque el bug del wizard lo impedía; es la primera vez que se puede observar.

- [ ] **Antes de desplegar**

Confirmar que el entorno de producción de Oxygen tiene `SESSION_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_PEPPER` y `RESEND_API_KEY`. La migración de `razon_social` corre sola al arrancar, pero conviene verificar la columna en Turso después del primer despliegue.
