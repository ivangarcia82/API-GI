# Landing interna "Mochilas Takayama" — diseño

Fecha: 2026-09-25

## Objetivo

El proveedor regalará mochilas Takayama a los colaboradores de Generando Ideas.
Se necesita una landing interna que presente la línea y sus modelos, permita a
cada colaborador elegir **una** mochila (modelo + color) y capture sus datos de
entrega. Cada elección llega por correo a **igarcia@generandoideas.com**.

Éxito: un colaborador con cuenta `@generandoideas.com` entra, ve los modelos
disponibles, elige uno, llena el formulario y tanto igarcia@ como él reciben el
correo con toda la información. Nadie fuera del dominio ve la página.

## Decisiones tomadas

- Ruta: `/mochilas-takayama`.
- Productos: los que tienen el tag `mochila-takayama` en Shopify (hoy 15).
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
  (trim + minúsculas) termina exactamente en `@generandoideas.com`
  (no acepta subdominios ni `generandoideas.com.mx`).

Loader de `app/routes/mochilas-takayama.jsx`:

1. Sin sesión (`getSessionUser` vacío) → `redirect('/login?redirectTo=/mochilas-takayama')`.
   No se usa `requireUser` tal cual porque redirige a `/login` sin `redirectTo`.
2. Con sesión: valida `sessionVersion` igual que `requireUser` (se reutiliza
   `requireUser` después del chequeo de sesión vacía, para no duplicar la
   lógica de invalidación) y carga el usuario con `findById`.
3. Si `!isCollaboratorEmail(user.email)` → responde `403` con
   `{denied: true}`; la UI muestra "Esta página es sólo para colaboradores de
   Generando Ideas". No se consultan productos.
4. Si pasa: consulta productos y devuelve `{collaborator: {email, firstName,
   lastName}, products}`.
5. Header `Cache-Control: no-cache, no-store` (página por usuario).

Registro (`app/routes/auth.signup.jsx`): si `isCollaboratorEmail(email)`, se
omite `linkSignupCustomer`. En `app/routes/auth.verify.jsx` se omite
`notifyAdvisorOfSignup` para esos correos. `sendVerificationEmail` sigue igual.

## 2. Productos

Consulta de Storefront en la ruta: `products(first: 50, query: "tag:mochila-takayama")`
con, por producto: `id, handle, title, description, availableForSale,
featuredImage` y variantes (`id, title, availableForSale, image,
selectedOptions`).

Normalización en `app/lib/takayama.js` (`normalizeTakayamaProducts`):

- Descarta productos sin variantes disponibles y variantes no disponibles.
- Limpia el título para mostrar: "MOCHILA TAKAYAMA ZEN MOC-ZEN" → "Zen"
  (quita el prefijo "MOCHILA TAKAYAMA" y el sufijo de SKU `MOC-XXX`,
  y pasa a Title Case).
- Imagen por variante con fallback a `featuredImage`.

Verificación durante implementación: confirmar que la consulta devuelve los
15 productos del tag y nada más. Si Storefront no filtra el tag de forma
confiable (el repo lo advierte para `search`), se crea la colección
"Mochilas Takayama" (automática, condición tag = `mochila-takayama`) y se lee
por handle con `collection(handle:)`.

## 3. Landing (UI)

Envuelta en `MarketingLayout`, estilos en CSS propio de la ruta usando los
tokens de `gi-tokens.css`; animaciones con `~/lib/motion` (import dinámico en
`useEffect`, respetando `prefersReducedMotion`).

Secciones:

1. **Hero** — "Línea Takayama", mensaje de regalo para el equipo, CTA
   "Elige tu mochila" que baja a los modelos.
2. **La línea** — 3–4 atributos: repelente al agua, telas balísticas,
   diseños anti-robo, espacio para laptop.
3. **Modelos** — grid de tarjetas (imagen, nombre, chips de color). Cambiar de
   color cambia la imagen. Al abrir una tarjeta: detalle con descripción
   completa y botón "Elegir esta". La tarjeta elegida queda marcada.
4. **Formulario** — muestra la mochila elegida (o un select para elegirla /
   cambiarla), campos del colaborador y toggle "¿Eres foráneo?" que despliega
   los campos de envío.
5. **Confirmación** — tras enviar: "¡Listo! Tu elección fue enviada" con el
   resumen; el formulario desaparece.

Estado denegado: bloque simple con el mensaje de sólo colaboradores y un
enlace a cerrar sesión / volver al inicio.

## 4. Formulario

Siempre:

| Campo | Nombre | Obligatorio |
|---|---|---|
| Nombre completo | `fullName` | sí (prellenado con el nombre de la cuenta) |
| Correo | — | viene de la sesión, no editable ni enviado por el form |
| Área / puesto | `position` | sí |
| Teléfono (WhatsApp) | `phone` | sí, 10 dígitos |
| Mochila | `variantId` | sí |
| ¿Eres foráneo? | `foraneo` (`si`/`no`) | sí |

Si `foraneo = si`, además (todos obligatorios salvo indicación):
`street` (calle y número), `neighborhood` (colonia), `zip` (5 dígitos),
`city`, `state`, `references` (opcional), `recipient` (quién recibe,
opcional; por defecto el colaborador).

Si `foraneo = no`: se entrega en oficina, no se pide nada más.

## 5. Envío (action de la misma ruta)

1. `assertSameOrigin(request)`.
2. Re-valida sesión + dominio (misma función que el loader).
3. `validateTakayamaRequest(form)` en `app/lib/takayama.js`: campos
   obligatorios, formatos (teléfono, CP) y rama foránea. Devuelve
   `{ok, values}` o `{ok: false, errors}` por campo → `400` con errores.
4. Vuelve a consultar los productos del tag y confirma que `variantId`
   pertenece a uno de ellos y está disponible (no se confía en el cliente).
5. `buildTakayamaEmail({collaborator, values, product, variant})` →
   `{subject, html}`; todo valor de usuario pasa por `escapeHtml`.
   Asunto: `Mochila Takayama – {Nombre} – {Modelo} / {Color}`.
6. `sendEmail(env, {to: 'igarcia@generandoideas.com', cc: collaborator.email,
   replyTo: collaborator.email, subject, html})`. El destinatario vive en
   `env.TAKAYAMA_EMAIL` con fallback a `igarcia@generandoideas.com`.
7. Éxito → `{ok: true, summary}`; fallo de Resend → `502` con mensaje
   "No pudimos enviar tu elección, intenta de nuevo".

## 6. Pruebas (vitest)

- `isCollaboratorEmail`: mayúsculas/espacios, otros dominios, subdominios,
  `generandoideas.com.mx`, vacío/null.
- `validateTakayamaRequest`: campos faltantes, teléfono y CP inválidos, rama
  foránea exige dirección, rama no foránea no la exige.
- `normalizeTakayamaProducts`: limpieza de títulos, descarte de sin
  inventario, fallback de imagen.
- `buildTakayamaEmail`: asunto, escape de HTML, incluye/omite bloque de envío.
- Registro: con correo `@generandoideas.com` no se llama `linkSignupCustomer`;
  con otro dominio sí.

## Fuera de alcance

- Guardar elecciones en base de datos, evitar duplicados o panel de
  seguimiento.
- Control de inventario/reserva de piezas.
- Un registro distinto para colaboradores.
- El aviso a los colaboradores para que creen su cuenta (lo hace el equipo).
