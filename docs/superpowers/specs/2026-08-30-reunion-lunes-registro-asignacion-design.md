# Reunión del lunes — cotizaciones, registro y asignación de leads

Seis bloques acordados en la reunión del lunes, resueltos en un solo diseño
porque comparten dos piezas: el alta (`auth.signup.jsx` + `registro.jsx`) y el
correo saliente (`lib/email/resend.js`).

Sólo uno de los seis es realmente estructural —la asignación de leads deja de
ocurrir en el alta—; el resto son campos, copias y un bug de validación que
apareció al revisar el formulario.

## Alcance

| # | Bloque | Naturaleza |
| --- | --- | --- |
| 1 | CC al manager en cotizaciones con ejecutivo | Correo + módulo nuevo |
| 2 | Campos obligatorios y nuevos en el registro | Formulario + esquema |
| 3 | Aviso de privacidad y términos, ambos obligatorios | Formulario + bug de servidor |
| 4 | Alta al newsletter | Formulario + esquema |
| 5 | Validación de la asignación por marketing | Cambio de comportamiento del alta |
| 6 | Tiempos de entrega en la cotización | Copia, bloqueado externamente |

## Decisiones tomadas

| Pregunta | Decisión |
| --- | --- |
| ¿Dónde trabaja marketing la asignación? | En el admin de Shopify, sobre tags y el metafield existente. No se construye UI interna. |
| ¿De dónde sale el manager de cada ejecutivo? | Matriz hardcoded en el repo, no un campo en Shopify. Se actualiza a mano cuando cambie el organigrama. |
| ¿A qué correo se le añade el CC? | Al interno del ejecutivo. El correo al cliente no cambia. |
| ¿El volumen mensual se queda? | Sí, obligatorio, tal como está hoy. |
| Mientras marketing valida, ¿quién tiene al cliente? | Nadie. El metafield queda vacío y las cotizaciones caen en el buzón de ventas por el fallback que ya existe. |
| ¿Dónde vive el alta al newsletter? | En `users` como fuente de verdad, espejada a Shopify best-effort. |

Se descartaron:

- **Un área interna en la app** (`/interno` con guard por rol) para la bandeja de
  marketing. Es la única forma de imponer "cada manager sólo asigna dentro de su
  equipo", pero obliga a construir login interno, permisos y pantallas desde
  cero — hoy `users.role` existe en el esquema y **ningún código la consulta**.
- **Un campo `manager` en el metaobject `ejecutiva_de_venta`**, que habría dado
  el CC y la estructura de equipos con un solo campo. Se prefirió la matriz
  hardcoded por rapidez.
- **Asignar al asesor desde el alta y que marketing audite después.** No cumple
  el requisito tal como se pidió: la validación tiene que ocurrir *antes*.

---

## Diseño

### 1. CC al manager en cotizaciones

#### 1.1 La matriz

`app/lib/quotes/managers.js`, módulo puro sin I/O:

```js
/** Correo del ejecutivo -> correo de su manager. Actualizar a mano. */
const MANAGERS = {
  'laura@generandoideas.com': 'antonio@generandoideas.com',
  // ...
};

export function managerFor(advisorEmail) { /* normaliza y busca */ }
```

Se indexa **por correo, no por handle**, porque en el momento del envío
`getCustomerAdvisor` (`app/lib/admin/operations.js:144`) sólo devuelve el correo
del metaobject; el handle no llega hasta ahí. La matriz que entregue Iván debe
tener esas dos columnas.

Normaliza a minúsculas y recorta espacios antes de buscar, para que una mayúscula
en el metaobject no rompa el CC en silencio. Un ejecutivo ausente de la matriz
devuelve `null`: se manda el correo sin copia, nunca se falla el envío.

#### 1.2 `sendEmail` aprende `cc`

`app/lib/email/resend.js:19` hoy sólo reenvía `to`, `subject`, `html` y
`reply_to`. Se añade `cc` al destructuring y al cuerpo del POST, con el mismo
patrón condicional que ya usa `replyTo`:

```js
...(cc ? {cc} : {}),
```

El stub también lo registra, para que en desarrollo se vea a quién se habría
copiado.

#### 1.3 `buildAdvisorEmail` devuelve `cc`

`app/lib/quotes/advisorEmail.js` recibe un `managerEmail` opcional y lo incluye
en el payload sólo si viene. Sigue siendo puro.

#### 1.4 El fan-out sólo copia cuando hay ejecutivo real

En `app/lib/quotes/notify.js:65`, `resolveAdvisorRecipient` hoy colapsa dos casos
distintos en un solo string: "hay asesor" y "no hay, usa `ventas@`". El CC
necesita distinguirlos, porque el requisito dice *si una cotización tiene
ejecutivo*: cuando la cotización cayó en el buzón genérico no hay manager a quién
copiar.

```js
const advisorEmail = await lookupAdvisorEmail(...);   // null si no hay
const advisorTo = resolveAdvisorRecipient(advisorEmail, env);
const managerEmail = advisorEmail ? managerFor(advisorEmail) : null;
```

`resolveAdvisorRecipient` no cambia. El correo al cliente tampoco: sigue con
`replyTo: advisorTo` y sin copias.

#### 1.5 Pruebas

- `managers.test.js`: correo conocido, desconocido, con mayúsculas, con espacios,
  vacío y `null`.
- `advisorEmail.test.js`: con manager sale `cc`; sin manager la clave no existe
  (no `cc: undefined`, que Resend rechazaría).
- `resend.test.js`: `cc` presente y ausente en el cuerpo del POST.
- `notify.test.js`: un cliente con ejecutivo copia al manager; un cliente sin
  ejecutivo cae en `ventas@` **sin CC**.

### 2. Campos del registro

#### 2.1 Lo que pasa a obligatorio

- **Teléfono** (`app/routes/registro.jsx:234`): hoy es un input sin `required` y
  `validateStep` ni lo mira. Pasa al paso 1 con validación.
- **Razón social** (`:266`): hoy el label dice literal "(opcional)" y el texto de
  ayuda dice *"Si la proporcionas ahora aceleramos la apertura de crédito"*. Al
  volverse obligatoria ese texto deja de tener sentido y se reescribe.

#### 2.2 Campos nuevos

| Campo | Control | Columna | Catálogo |
| --- | --- | --- | --- |
| Cargo | texto | `position` | libre |
| Área | select | `area` | Compras · Marketing · Recursos Humanos · Dirección · Ventas · Operaciones · Otra |
| ¿Cómo nos conociste? | select | `heard_about` | Google o buscador · Redes sociales · Recomendación · Feria o evento · Me contactó un ejecutivo · Otro |
| ¿Dónde te ubicas? | select | `location` | Los 32 estados + "Fuera de México" |

Los catálogos son constantes exportadas desde `app/routes/registro.catalogos.js`,
para que la validación del servidor pueda rechazar un valor que no esté en la
lista sin duplicarla. Todos obligatorios.

#### 2.3 Reparto del wizard

Se mantienen 3 pasos. El paso 3 hoy está casi vacío (una textarea opcional y un
checkbox) y absorbe lo nuevo:

| Paso | Contenido |
| --- | --- |
| 1 | Nombre, apellido, correo, contraseña, **teléfono** |
| 2 | Empresa, razón social, **cargo**, **área**, volumen, ¿ya eres cliente? + asesor |
| 3 | **¿Cómo nos conociste?**, **ubicación**, ¿qué buscas?, privacidad, términos, newsletter |

El paso 2 queda cargado. Se prefiere eso a un cuarto paso: cada paso extra en un
wizard cuesta abandono, y el paso 3 tenía holgura de sobra.

Cada campo nuevo necesita su `<input type="hidden">` espejo (`:125-135`), que es
como este formulario hace viajar los valores de los pasos que no están en
pantalla. **Olvidar un espejo hace que el campo se pierda en silencio** — es
justo el bug de la sección 3.

#### 2.4 Esquema

`app/lib/db/migrate.js` ya trae el patrón idempotente (`:91-101`). Se añaden con
`addColumnIfMissing`, todas nullable para no romper las filas existentes:

```
position, area, heard_about, location,
privacy_accepted_at, terms_accepted_at,
newsletter_opt_in (INTEGER), newsletter_opt_in_at,
advisor_handle
```

`createUser` y `SELECT_COLS` (`app/lib/auth/users.js:38`) se extienden en
consecuencia.

**Los usuarios ya registrados se quedan con estas columnas en `NULL`.** No hay
backfill: nadie los va a obligar a completar el perfil retroactivamente, y ningún
código nuevo asume que estén llenas.

### 3. Aviso de privacidad y términos

#### 3.1 El bug que aparece de paso

El checkbox actual (`app/routes/registro.jsx:400`) **no tiene atributo `name` ni
espejo oculto**, y `auth.signup.jsx` nunca lo lee. Lo único que impide enviar sin
marcarlo es el `required` del navegador. Cualquier POST directo al endpoint crea
la cuenta sin haber aceptado nada — y hoy no queda registro de que nadie aceptara.

Además el texto menciona los Términos de uso pero **sólo enlaza el PDF de
privacidad**: los términos van sin enlace.

#### 3.2 Dos checks, validados en el servidor

Dos checkboxes separados, ambos obligatorios, cada uno con su espejo oculto y su
enlace. `auth.signup.jsx` los lee y devuelve `400` si falta cualquiera, con el
mismo estilo de los errores que ya maneja (`:33`). El cliente sigue validando
para dar respuesta inmediata; el servidor es el que manda.

Al crear el usuario se persisten `privacy_accepted_at` y `terms_accepted_at` con
el `ISO` del momento, como evidencia del consentimiento.

#### 3.3 Footer y rutas

`app/lib/site-content.js:87` tiene `ROUTES.privacy`; se añade `ROUTES.terms`
apuntando a `/legal/terminos-y-condiciones.pdf`.

`app/components/gi/Footer.jsx:80` lista hoy "Aviso de privacidad" en la columna
Recursos; se añade "Términos y condiciones" al lado, con el mismo `target="_blank"`.

**El archivo no existe todavía.** `public/legal/` sólo contiene
`aviso-de-privacidad-esi-2026.pdf`. El código queda apuntando a la ruta y el PDF
se sube después; hasta entonces el enlace da 404.

#### 3.4 Pruebas

- El `action` rechaza con 400 si falta privacidad, si faltan términos, y si faltan
  ambos.
- El `action` acepta y persiste las dos fechas cuando vienen los dos.
- `validateStep(3, …)` marca error por cada check sin marcar.

### 4. Newsletter

Checkbox **no obligatorio**, en el paso 3, visualmente separado de los dos
obligatorios para que nadie lo confunda con un requisito.

La fuente de verdad es `users.newsletter_opt_in` + `newsletter_opt_in_at`, junto
al resto de la evidencia de consentimiento. Se espeja a Shopify pasando
`emailMarketingConsent` en el `CustomerInput` de `createCustomer`
(`app/lib/admin/operations.js:50`) sólo cuando el usuario aceptó:

```js
emailMarketingConsent: {
  marketingState: 'SUBSCRIBED',
  marketingOptInLevel: 'SINGLE_OPT_IN',
  consentUpdatedAt: <ISO>,
}
```

El espejo es best-effort dentro de un alta que ya es best-effort
(`linkSignupCustomer` devuelve `null` si Shopify falla). Si Shopify no responde,
el consentimiento **no se pierde**: sigue en la base. En la rama de correo ya
existente (`isTakenError`, `:39` y `:59`) el consentimiento no se aplica; es aceptable
porque ese camino sólo ocurre con clientes que Shopify ya conocía.

### 5. Asignación de leads

#### 5.1 Cómo funciona hoy

La asignación es inmediata y sin revisión. `advisorHandleFromForm`
(`app/lib/auth/advisor-choice.js:18`) traduce la respuesta del formulario a un
handle —cayendo en `marketing` cuando no hay elección— y `linkSignupCustomer`
(`app/lib/auth/signup-link.js:45`) lo escribe en `custom.ejecutiva_de_venta` en
el mismo instante del alta. Nadie valida nada.

#### 5.2 El alta deja de asignar

- `advisorHandleFromForm` deja de devolver `MARKETING_HANDLE` como respaldo:
  devuelve **el handle que el usuario reclamó, o `null`**. Un "no soy cliente",
  un select vacío o el centinela `UNKNOWN_ADVISOR` dan `null`.
- `linkSignupCustomer` ya no llama a `setCustomerAdvisor`. En su lugar etiqueta al
  customer con `lead-pendiente` mediante una operación nueva,
  `addCustomerTags(env, gid, tags)`, sobre la mutación `tagsAdd`. Requiere
  `write_customers`, que el app ya tiene (lo usa `setCustomerAdvisor`).
- El handle reclamado se guarda en `users.advisor_handle` desde `createUser`, no
  desde el enlace con Shopify. Así sobrevive aunque Shopify falle — que es el
  hueco #3 anotado en `docs/superpowers/notes/2026-08-24-siguientes-pasos-asesor.md`.

`setCustomerAdvisor` y `resolveAdvisorGid` **se conservan sin cambios**: siguen
siendo la operación que marketing replica a mano en el admin, y el día que exista
una bandeja interna se reutilizan tal cual.

#### 5.3 El correo del alta

`resolveRecipient` (`app/lib/auth/signup-notify.js:20`) ya cae en el entry
`marketing` cuando el customer no tiene metafield. Con el metafield ahora siempre
vacío, **todos los avisos de alta llegan a marketing sin tocar esa función** —
que es exactamente el comportamiento pedido.

Lo que sí cambia es el cuerpo (`signup-advisor-email.js`): se añaden el asesor que
el usuario dijo tener y si se declaró cliente, que es la información sobre la que
marketing va a decidir. Sin eso el correo no le sirve para validar nada.

#### 5.3-bis Copia al líder del asesor reclamado

**Añadido el 2026-08-31.** El aviso de registro sigue yendo a marketing y
disparándose al verificar el correo, no al registrarse — eso se decidió dejar
como estaba, asumiendo que quien nunca confirma no le llega a nadie (hueco #1 de
la nota del 24 de agosto).

Lo que sí cambia: cuando la persona dice ser cliente de un ejecutivo concreto, se
copia al líder de ese ejecutivo, para que pueda corregir a marketing si el
reclamo no cuadra con su cartera. El CC sale de la misma matriz de
`quotes/managers.js`.

No cuesta ninguna consulta extra: `getAdvisorByHandle`, que ya se llamaba para
resolver el nombre, devuelve también el `correo`, que es justo la llave de la
matriz. Si el asesor no está en la matriz, o el líder resulta ser el propio
destinatario, no se copia a nadie.

#### 5.4 Las cotizaciones no cambian

Un lead pendiente no tiene ejecutivo, así que `notifyQuoteSubmitted` cae en el
fallback a `ventas@generandoideas.com` que ya existe (`notify.js:19-22`). No hace
falta tocar nada, y por la sección 1.4 esas cotizaciones tampoco llevan CC.

#### 5.4-bis La nota del registro en la ficha del cliente

**Añadido el 2026-08-31**, al detectar el hueco: a Shopify sólo llegaban correo
y nombre, así que marketing abría un cliente con tag `lead-pendiente` sin ver la
empresa, el teléfono ni a quién dijo conocer — justo lo que necesita para
decidir. El dato existía sólo en Turso y en el correo del alta.

`linkSignupCustomer` escribe ahora un resumen en el campo `note` del customer
(`app/lib/auth/signup-note.js`, puro). Se eligió `note` sobre metafields porque
no requiere crear definiciones en la administración de Shopify: funciona desde
el primer alta. El costo aceptado es que no se puede filtrar ni segmentar por
esos valores; si algún día hace falta, los metafields se añaden encima sin
quitar la nota.

El nombre del asesor reclamado se resuelve con `getAdvisorByHandle` y cae al
handle si falla. Sólo se consulta cuando la persona señaló a alguien concreto,
así que la mayoría de las altas no paga esa llamada.

#### 5.5 Lo que el sistema no impone

**Que Antonio y Jesús sólo asignen dentro de su propio equipo queda como acuerdo
de proceso, no como candado.** Shopify sólo distingue "puede editar clientes" de
"no puede"; no sabe qué entries del metaobject pertenecen a qué equipo. Cualquiera
con acceso al admin puede asignar a cualquier ejecutivo, y no queda bitácora de
quién asignó a quién más allá del historial de Shopify.

Es la consecuencia directa de resolver la bandeja en el admin en vez de en la app,
y está aceptada. Si algún día molesta, el camino es el área interna descartada
arriba.

#### 5.6 Pruebas

- `advisor-choice.test.js`: se reescriben las expectativas — donde antes salía
  `marketing` ahora sale `null`; un cliente que señala a alguien devuelve su handle.
- `signup-link.test.js`: el alta etiqueta y **no** llama a `setCustomerAdvisor`.
- El `action` guarda `advisor_handle` con lo reclamado.
- `signup-advisor-email.test.js`: el cuerpo incluye el asesor reclamado, y se
  sostiene cuando no hay ninguno.

### 6. Tiempos de entrega

Bloqueado: Gil tiene que confirmar el número antes de tocar nada. Cuando lo dé,
son cinco cadenas:

| Archivo | Línea |
| --- | --- |
| `app/components/gi/QuoteDrawer.jsx` | 133 |
| `app/routes/login.jsx` | 125 |
| `app/routes/registro.jsx` | 106 |
| `app/routes/print.cotizacion.$id.jsx` | 138 |
| `app/routes/servicios.$id.jsx` | 226 |

Conviene centralizarlas en una constante de `app/lib/site-content.js` al hacer el
cambio, para que la próxima revisión sea de un solo lugar.

---

## Dependencias externas

Ninguna bloquea escribir el plan ni empezar a implementar.

| Qué | Quién | Bloquea |
| --- | --- | --- |
| Matriz correo de ejecutivo → correo de manager | Iván | Poblar `managers.js` (el módulo y sus pruebas se escriben con datos de ejemplo) |
| PDF de términos y condiciones | — | Que el enlace del footer no dé 404 |
| Número real de tiempo de entrega | Gil | El bloque 6 completo |

## Fuera de alcance

- Bandeja interna, roles y permisos por equipo (sección 5.5).
- Recordatorio a quien se registra y nunca verifica: sigue siendo el hueco #1 de
  la nota del 24 de agosto.
- Backfill de los campos nuevos para usuarios existentes.
- Cachear `listAdvisors` en el loader de `/registro` (hueco #4 de esa misma nota).
