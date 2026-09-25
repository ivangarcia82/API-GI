# Landing interna "Campaña de mochilas" (Takayama + Wagner) — diseño

Fecha: 2026-09-25

## Objetivo

El proveedor regalará mochilas a los colaboradores de Generando Ideas, de las
líneas **Takayama** y **Wagner**. Se necesita una landing interna que presente
ambas líneas y sus modelos, permita a cada colaborador elegir **una** mochila
(de cualquiera de las dos líneas, modelo + color) y capture sus datos de
entrega. Cada elección llega por correo a **igarcia@generandoideas.com**.

Éxito: un colaborador con cuenta `@generandoideas.com` entra, ve los modelos
disponibles de ambas líneas, elige uno, llena el formulario y tanto igarcia@
como él reciben el correo con toda la información. Nadie fuera del dominio ve
la página.

## Decisiones tomadas

- Ruta: `/campana-mochilas` (no `/mochilas`, para no chocar con colecciones).
- Líneas y tags en Shopify:
  - Takayama → `mochila-takayama` (hoy 15 productos; Maiko sin inventario).
  - Wagner → `mochila-wagner` (hoy 4 productos).
- Una sola mochila por colaborador, entre ambas líneas.
- Muchos colaboradores no tienen cuenta: se les avisará que deben registrarse
  con el registro normal del sitio.
- El registro de un correo `@generandoideas.com` **no** crea customer en
  Shopify ni avisa a marketing/ejecutiva; la verificación de correo se mantiene.
- Sin base de datos nueva: la elección sólo viaja por correo. Trade-off
  aceptado: un envío doble produce dos correos; igarcia@ decide cuál vale.
- Sin precios en la landing (es un regalo).
- Se ocultan modelos/colores sin inventario (`availableForSale = false`).

## 1. Acceso

`app/lib/auth/collaborator.js` exporta:

- `COLLABORATOR_DOMAIN = 'generandoideas.com'`
- `isCollaboratorEmail(email)`: `true` sólo si el correo normalizado
  (trim + minúsculas) tiene una sola `@` y termina exactamente en
  `@generandoideas.com` (no acepta subdominios ni `generandoideas.com.mx`).

`app/lib/auth/collaborator-guard.js` exporta
`loadCollaborator(context, returnTo)`:

1. Sin sesión → `redirect('/login?redirectTo=<returnTo>')`. No se usa
   `requireUser` tal cual porque redirige a `/login` sin `redirectTo`.
2. Con sesión: llama a `requireUser` (valida `sessionVersion`); si éste lanza
   un redirect, se relanza hacia `/login?redirectTo=<returnTo>`.
3. Carga el usuario con `findById`; si no existe → mismo redirect.
4. Devuelve `{user, allowed: isCollaboratorEmail(user.email)}`.

Loader de `app/routes/campana-mochilas.jsx`:

- `!allowed` → `403` con `{denied: true}`; la UI muestra "Esta página es sólo
  para colaboradores" y un botón para cerrar sesión. No se consultan productos.
- `allowed` → `{denied: false, collaborator: {email, fullName}, lines}`.
- Header `Cache-Control: no-cache, no-store, must-revalidate`.
- Meta `robots: noindex, nofollow`.

Registro (`app/routes/auth.signup.jsx`): si `isCollaboratorEmail(email)`, se
omite `linkSignupCustomer`. En `app/routes/auth.verify.jsx` se omite
`notifyAdvisorOfSignup` para esos correos. `sendVerificationEmail` sigue igual.

## 2. Catálogo

`app/lib/mochilas/catalog.js`:

- `LINES = [{id: 'takayama', name: 'Takayama', tag: 'mochila-takayama'},
  {id: 'wagner', name: 'Wagner', tag: 'mochila-wagner'}]`. Agregar una línea
  es agregar una entrada.
- Consulta Storefront `products(first: 100, query: "tag:mochila-takayama OR
  tag:mochila-wagner")` con `id, handle, title, description, tags,
  featuredImage` y variantes (`id, title, availableForSale, image`).
- Cada producto se asigna a la primera línea de `LINES` cuyo tag trae; los
  que no traen ninguno se descartan (la búsqueda de Storefront no es estricta
  con tags).
- Nombre para mostrar: se quita el prefijo `MOCHILA <LÍNEA>` y el sufijo de
  SKU `MOC-XXX`, en Title Case: "MOCHILA WAGNER ARMOR MAX MOC-ARX" → "Armor Max".
- Color: "NEGRO/GRIS" → "Negro / Gris".
- Descripción: se separan oraciones pegadas por el HTML aplanado
  ("aguaFabricada" → "agua. Fabricada").
- Imagen por variante con fallback a `featuredImage`.
- Se descartan variantes no disponibles y productos sin variantes disponibles.
- Resultado agrupado: `[{id, name, products: [...]}]` en el orden de `LINES`,
  productos ordenados por nombre, líneas vacías omitidas.

Verificación durante implementación: confirmar que la consulta devuelve los
productos de ambos tags. Si Storefront omite alguno, se crea una colección
automática por línea y se lee por handle.

## 3. Landing (UI)

Envuelta en `MarketingLayout`, estilos en `app/styles/gi-mochilas.css` usando
los tokens de `gi-tokens.css`; animaciones con `~/lib/motion` (import dinámico
en `useEffect`, respetando `prefersReducedMotion`).

1. **Hero** — "Elige tu mochila", mensaje de regalo para el equipo, accesos
   directos a cada línea (anclas `#takayama`, `#wagner`).
2. **Una sección por línea** — nombre de la línea, texto breve y 3–4
   atributos; debajo, el grid de sus modelos.
   - Takayama: repelente al agua, telas balísticas, diseños anti-robo,
     espacio para laptop.
   - Wagner: estructura resistente, curpiel texturizado, repelente al agua,
     bolsas laterales con malla.
3. **Tarjetas** — imagen, nombre, chips de color; cambiar color cambia la
   imagen. Abrir la tarjeta muestra el detalle (descripción completa, colores,
   botón "Elegir esta"). La tarjeta elegida queda marcada.
4. **Formulario** — select con todas las mochilas agrupadas por línea (la
   elegida preseleccionada), campos del colaborador y toggle "¿Eres foráneo?".
5. **Confirmación** — "¡Tu elección fue enviada!" con el resumen.

## 4. Formulario

Siempre:

| Campo | Nombre | Obligatorio |
|---|---|---|
| Nombre completo | `fullName` | sí (prellenado con el nombre de la cuenta) |
| Correo | — | viene de la sesión, no editable ni enviado por el form |
| Área / puesto | `position` | sí |
| Teléfono (WhatsApp) | `phone` | sí, 10 dígitos (acepta espacios, guiones y `+52`) |
| Mochila | `variantId` | sí |
| ¿Eres foráneo? | `foraneo` (`si`/`no`) | sí |

Si `foraneo = si`, además (obligatorios salvo indicación):
`street` (calle y número), `neighborhood` (colonia), `zip` (5 dígitos),
`city`, `state`, `references` (opcional), `recipient` (quién recibe,
opcional; por defecto el colaborador).

Si `foraneo = no`: se entrega en oficina, no se pide nada más.

## 5. Envío (action de la misma ruta)

1. `assertSameOrigin(request)`.
2. `loadCollaborator`; `!allowed` → `403`.
3. `validateMochilaRequest(form)` → `{ok, values}` o `{ok: false, errors}`
   por campo → `400`.
4. Vuelve a consultar el catálogo y confirma que `variantId` pertenece a una
   línea y está disponible (no se confía en el cliente) → si no, `400`
   "Esa mochila ya no está disponible. Elige otra.".
5. `buildMochilaEmail({email, values, line, product, variant})` →
   `{subject, html}`; todo valor de usuario pasa por `escapeHtml`; el asunto
   queda en una línea.
   Asunto: `Mochila – {Nombre} – {Línea} {Modelo} / {Color}`
   (ej. "Mochila – Ana López – Takayama Zen / Negro").
6. `sendEmail(env, {to, cc: colaborador, replyTo: colaborador, subject,
   html})`, con `to = env.MOCHILAS_EMAIL` o `igarcia@generandoideas.com`.
7. Éxito → `{ok: true, summary: {line, model, color, foraneo}}`; fallo de
   Resend → `502` "No pudimos enviar tu elección, intenta de nuevo".

## 6. Pruebas (vitest)

- `isCollaboratorEmail`: mayúsculas/espacios, otros dominios, subdominios,
  `generandoideas.com.mx`, doble arroba, vacío/null.
- `loadCollaborator`: sin sesión, sesión caducada, usuario borrado, error no
  redirect, permitido/denegado.
- Registro/verificación: colaborador sin Shopify ni aviso; otro dominio igual
  que antes.
- Catálogo: nombres de ambas líneas, colores, descripción, agotados, sin tag,
  agrupación y orden, query con ambos tags.
- `validateMochilaRequest`: faltantes, teléfono, CP, rama foránea.
- `buildMochilaEmail`: asunto con línea, escape, bloque de envío.
- Ruta: 403, redirect, correo con cc/replyTo, variante manipulada o agotada,
  fallo de Resend, `MOCHILAS_EMAIL`.
- Formulario (jsdom): prellenado, opciones agrupadas por línea, rama foránea.

## Fuera de alcance

- Guardar elecciones en base de datos, evitar duplicados o panel de
  seguimiento.
- Control de inventario/reserva de piezas.
- Un registro distinto para colaboradores.
- El aviso a los colaboradores para que creen su cuenta (lo hace el equipo).
