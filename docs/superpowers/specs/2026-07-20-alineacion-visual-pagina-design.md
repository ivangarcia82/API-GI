# Alineación visual del storefront con generandoideas.com

**Fecha:** 2026-07-20
**Origen:** `Página web.docx` (feedback de cliente, texto + 25 imágenes de referencia)

## Contexto

El documento compara el sitio actual (`generandoideas.com`, "la página") contra este storefront
Hydrogen ("la API") y pide alinear el segundo con el primero. Son ~40 observaciones repartidas en
header, home, catálogo, categorías, colecciones, servicios y los flujos de autenticación.

El repo ya contiene dos capas de componentes en paralelo:

- `app/components/gi/` — el storefront (rutas de producto, cuenta, cotización)
- `app/components/marketing/` — port de generandoideas.com (`Hero`, `ImpactBand`, `ProcessSection`,
  `ClosingCTA`, `SocialIcons`, `TestimonialsCarousel`)

Cinco de las observaciones dicen literalmente "sustituir por la sección de la página". Esas secciones
ya existen en `marketing/`, así que el trabajo es reuso, no construcción.

## Alcance

**Dentro:** header, home, catálogo/categorías, servicios, login y registro.

**Fuera (spec aparte):** la redefinición de **Colecciones**. El documento pide que dejen de replicar
categorías y pasen a ser los catálogos actuales de la empresa. Eso es una decisión de producto que
necesita definir qué son esos catálogos y conseguir los assets; no es un ajuste visual.

Consecuencia deliberada: el home conserva por ahora la sección "Líneas curadas para campañas
precisas" (`featuredCollections`). Se resuelve completa en la segunda ronda en vez de borrarla a
medias.

**Diferido por falta de insumos:** la estandarización de la taxonomía de categorías ("considerar como
las de la API de hhglobal") y las "imágenes en contexto" por categoría. Ambas requieren información y
assets externos. En esta ronda sí entran el orden alfabético, el carrusel y el resaltado en naranja.

## Decisión de arquitectura: el wrapper `.gi-mkt`

**Problema.** 646 de los 647 selectores de `app/styles/gi-marketing.css` están namespaceados bajo
`.gi-mkt`, que aporta `MarketingLayout`. El home (`_index.jsx`) no usa `MarketingLayout`. Importar
`ImpactBand`/`ProcessSection`/`ClosingCTA` directamente habría renderizado divs sin estilo — una falla
silenciosa, sin error en consola.

**Solución.** Envolver las secciones importadas en un contenedor `.gi-mkt` dentro del home y llamar al
hook `useMarketingReveal()`, que `MarketingLayout.jsx:13` ya exporta.

```jsx
// _index.jsx
useMarketingReveal();            // activa los fade-in .reveal

<div className="gi-mkt">
  <ImpactBand />                 // cifras + count-up
  <ProcessSection />
  <ClosingCTA />
</div>
```

Esto resuelve tres cosas a la vez: estilo correcto, la animación que el documento pide conservar
(`.gi-mkt .reveal` más el `CountUp` que `ImpactBand` ya incluye), y una sola fuente de verdad entre la
página y el storefront.

El `.gi-mkt` funciona como frontera de contención: el CSS de marketing queda encerrado en el wrapper y
no alcanza a las secciones `gi/` vecinas.

**A verificar en implementación:** que `.gi-mkt` no traiga reglas de fondo o tipografía que asuman
página completa. Si las trae, se acotan dentro del wrapper.

**Cifras.** `ImpactBand` expone +12 años · +2,700 clientes · +67,000 decorados diarios · 4.9 de
satisfacción. Las actuales del home (1,847 / 12 años / 420+) son datos distintos, no un reestilizado.
Se adoptan las de la página, que es lo que pide el documento.

## Header

Archivos: `app/components/gi/Header.jsx`, `app/styles/gi-tokens.css:410-497`

| Cambio | Implementación |
|---|---|
| Logo más grande | `160×34` → ~`200×42` |
| Quitar sombreado negro en Inicio | `.appbar-nav a.active`: `background: var(--ink)` → `var(--bg-soft)` + `border-bottom: 2px solid var(--accent)` |
| Redes sociales | Reusar `marketing/SocialIcons.jsx` en `.appbar-actions` |
| Barra blanca al hacer scroll | Fondo opaco en lugar de translúcido |

## Home

Archivo: `app/routes/_index.jsx`

**Eliminar:** badge `v2.0 Catálogo 2026 disponible`, chip `DE 2 CONTENEDORES SOTIRA`, widget de chat,
sección "Lo más cotizado este mes" (Destacado), `AboutTeaser` (Quiénes somos) y Lookbook.

**Sustituir por la página** (dentro del wrapper `.gi-mkt`): cifras → `ImpactBand`, Proceso →
`ProcessSection`, Empieza hoy → `ClosingCTA`.

**Ajustar:**

- Headings: negro → gris oscuro con palabras clave en naranja. Ojo: **no** es el
  `#636569` del manual (ese es el fondo de los paneles de auth); es un carbón más oscuro. El valor
  exacto se fija contra la imagen de referencia del documento, reusando el neutro oscuro que ya
  existe en tokens en vez de introducir un color nuevo.
- CTA "Explorar catálogo": tono gris, y que apunte a la sección de categorías en vez de a todos los productos
- Categorías: orden alfabético, "categoría" en naranja, carrusel o botón *ver más*
- Servicios: eyebrow `// Servicios · Todo lo que hacemos` → `// Servicios`; cuadros en gris claro con texto blanco
- Clientes: adoptar el encabezado de la página — eyebrow `LO QUE DICEN NUESTROS CLIENTES` y
  título "Relaciones que **duran años.**" (últimas dos palabras en naranja) — conservando las
  tarjetas de la API
- En `ClosingCTA`: "Cotizar" lleva a catálogo y se elimina "Ver e-store"

## Catálogo y categorías

- Categoría individual: usar la misma imagen de la portada; quitar las cifras de producto y producción; agregar filtros
- **Bug del sidebar de filtros:** no se visualiza completo al hacer scroll hasta llegar al final.
  Se investiga la causa real antes de tocar el CSS; el síntoma sugiere `sticky`/altura pero no está confirmado.

## Servicios

Ruta `/servicios`: título más pequeño.

## Autenticación

### Paneles laterales

Archivos: `app/routes/login.jsx:130-161`, `app/routes/registro.jsx:255-270`

| Cambio | Detalle |
|---|---|
| Fondo | Negro → gris del manual `#636569` (Cool Gray 10C) |
| Título login | → "Accede a información exclusiva" |
| Título registro | → "Estás a un clic de tus beneficios" |
| Negritas | Naranja `#ff8300` (Pantone 151C) |
| Botón | Naranja con texto blanco |
| Quitar bullets | Login: "Asesor de cuenta dedicado". Registro: "Asesor asignado en 24 hrs" y "Soporte humano por WhatsApp" |

### Testimonio falso

`login.jsx:155-160` muestra una cita atribuida a "MARIANA RUIZ · HR LEAD · BANORTE". Proviene de datos
demo (`app/lib/gi.js:206`, array `REVIEWS`, con avatares de Unsplash y personas inventadas atribuidas
a Banorte, Heineken y una agencia).

El documento pregunta "si el comentario te lo mande yo, se queda; si no es real eliminarlo". **No es
real.** Los testimonios reales son los 13 de `app/lib/site-content.js`, atribuidos solo a empresa.

Se elimina la cita del panel y el array `REVIEWS` completo, que además no se usa en ningún otro lado.
No es un ajuste estético: es un testimonial fabricado y firmado por una persona ficticia en una
institución real, publicado en producción.

### Bug 1 — validación diferida

`registro.jsx:231`:

```jsx
onClick={step === 3 ? undefined : () => setStep(step + 1)}
```

"Continuar" avanza de paso sin validar nada. La validación ocurre solo en el servidor al enviar en el
paso 3, así que un correo ya registrado se reporta hasta el final del wizard.

**Fix:** validar los campos mínimos del paso 1 antes de permitir avanzar, más un chequeo asíncrono de
disponibilidad del correo contra un endpoint nuevo (solo el servidor puede saber si el email existe).

### Bug 2 — "no puedo visualizar que viene después"

No es un defecto independiente: el error bloqueante del paso 3 impidió completar el registro, así que
el flujo posterior nunca se alcanzó. Se resuelve con el fix del bug 1.

**Pendiente de revisión humana:** el tramo posterior al registro (`app/routes/auth.verify.jsx`,
verificación por correo) nunca ha sido validado por el cliente. Debe recorrerse una vez arreglado el
wizard.

### RFC → Razón social

`rfc` es una columna real de la tabla `users` en Turso y atraviesa `createUser`, `updateProfile`,
`SELECT_COLS` y la pantalla de perfil (`app/lib/auth/users.js`).

Renombrar solo la etiqueta guardaría razones sociales en una columna llamada `rfc` y dejaría el perfil
mostrando "RFC". Se hace la **migración limpia**:

1. Migración que renombra la columna `rfc` → `razon_social`
2. Actualizar `createUser`, `updateProfile` y `SELECT_COLS` en `app/lib/auth/users.js`
3. Actualizar el campo y la etiqueta en `registro.jsx` (paso 2) — "Razón social (opcional)"
4. Actualizar la etiqueta y el campo en `app/routes/account.profile.jsx`

### Otros

- Icono de ver/ocultar contraseña en `registro.jsx:107`
- Hipervínculo al aviso de privacidad en el checkbox del paso 3. Destino ya existente:
  `ROUTES.privacy` → `/legal/aviso-de-privacidad-esi-2026.pdf` (`site-content.js:95`)

## Verificación

- `npm run lint` y `npm test` en verde. Hay tests existentes que tocan lo modificado:
  `HomeGiSections.test.jsx` (afirma sobre `TESTIMONIALS`) y `navActive.test.js` (estado activo del nav).
- Recorrer en local el home completo confirmando que las tres secciones importadas renderizan **con
  estilo** — es el modo de falla específico que introduce el wrapper `.gi-mkt`.
- Recorrer el wizard de registro de principio a fin con un correo ya existente, confirmando que el
  error aparece en el paso 1 y no al final.
- Confirmar la migración de `razon_social` contra la base antes de desplegar.

## Riesgos

- **Fugas de CSS del wrapper `.gi-mkt`.** Mitigado por el namespacing existente, pero hay que
  verificar visualmente las secciones vecinas.
- **Migración de base de datos.** Renombrar una columna en producción requiere que el deploy del
  código y la migración vayan coordinados. Los usuarios ya registrados conservan el valor.
- **Variables de entorno en Oxygen.** Independiente de este spec, pero pendiente antes de desplegar:
  las features de auth, base de datos y formulario de contacto dependen de `SESSION_SECRET`,
  `TURSO_*`, `AUTH_PEPPER` y `RESEND_API_KEY`. Deben existir en el entorno de producción de Oxygen.
