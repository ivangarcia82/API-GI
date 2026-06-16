# Generando Ideas — Auth propia, motor de decorado, cotizaciones persistentes y cantidad desde 1

- **Fecha:** 2026-06-16
- **Estado:** Diseño aprobado · endurecido tras revisión adversarial multi-agente (pendiente revisión final de spec)
- **Autor:** Claude (brainstorming con Ivan)
- **Runtime:** Shopify Hydrogen (React Router 7) sobre **Oxygen** (edge / workerd / V8). Sin Node nativo, sin TCP, sin bcrypt, sin scrypt/argon2 vía WebCrypto.

## 1. Contexto y objetivo

Storefront B2B de productos promocionales sobre Shopify Hydrogen. Hoy:

- Autenticación 100% **Shopify Customer Accounts (OAuth, passwordless)**.
- Wishlist y cotización solo en `localStorage`; "enviar cotización" es un `setTimeout` falso que redirige a `/account/cotizaciones` (inexistente).
- Precios con MOQ y `volumeTiers` heurísticos.
- Theme legacy `scripthhglobal.liquid` con motor de precios de **decorado** (impresión/bordado) basado en una matriz + metafields.

Se requiere: (1) **auth propia email+password** en BD separada ligada a Shopify; (2) **portar el motor de decorado** leyendo metafields; (3) **eliminar rangos/MOQ** (cotizar desde 1); (4) **persistencia real**: wishlist por usuario y cotizaciones como **draft orders asignadas al usuario**.

**Hallazgo que condiciona todo:** Shopify deprecó las "classic/legacy customer accounts" (las únicas con password) el **26-feb-2026**; las nuevas son passwordless. Por tanto email+password **vive en BD propia**; Shopify queda como sistema de clientes/pedidos, unido por el `customer gid`.

## 2. Decisiones tomadas

| Decisión | Elección |
|---|---|
| Base de datos | **Turso / libSQL** (SQLite sobre HTTP, edge-native). Import **obligatorio** `@libsql/client/web`. |
| Hashing de contraseña | **WebCrypto PBKDF2-SHA256, 100 000 iteraciones** (cap duro de workerd) + **pepper** HMAC con secreto de servidor. Salt 16 bytes. |
| Admin API | **Stub ahora**, token real luego (detección por env var, cero refactor). |
| Modelo de compra (v1) | **Todo-cotización → draft order.** Sin carrito/checkout Shopify en v1 (ver §2.1). |
| Precio del decorado | Integrado en `originalUnitPriceWithCurrency` de cada línea custom del draft order. |
| Wishlist | Persistida en **Turso** (una sola fuente de verdad). |
| Matriz de decorado | **Hardcodeada** (fiel al Liquid); metafields solo para técnicas/superficie. |
| Rol buyer/quoter | **Read-only** en v1 (derivado de Turso). Se elimina el switcher en vivo. |

### 2.1 Resolución del modelo de compra (antes ambiguo)

La revisión detectó que un modelo "híbrido" (buyer→carrito Shopify, quoter→cotización) era inconsistente: el `role` pasaba a ser server-derived pero el switcher en vivo seguía existiendo, y quitar `moq` rompía el `quantity` del carrito. **Resolución v1: TODO va por cotización → draft order.** Se desactiva el carrito/checkout de Shopify y el switcher de rol. Consecuencias asumidas:

- Las líneas del draft order son **custom** (título + precio), **no descuentan inventario** ni enlazan a variante para fulfillment — aceptable para promocional made-to-order. `variant_id` se guarda solo como referencia de producción.
- `canBuy`/rol queda como etiqueta informativa; no bifurca el flujo en v1.
- Si más adelante se quiere checkout directo Shopify para items sin decorado, será un follow-up con líneas de variante real + override de precio.

## 3. Objetivos / No-objetivos

**Objetivos (v1):** signup/login/logout email+password sobre Turso; sesión propia firmada con rotación; vínculo a Shopify Customer (`customerCreate`, idempotente); wishlist y cotizaciones persistentes; cotización → `draftOrderCreate` asignada al `customerId`, decorado integrado en el precio de línea; motor de decorado portado + UI en PDP; cantidad desde 1; **throttling de login**; **recuperación de contraseña interina** (ver §11).

**No-objetivos (v1, decididos):** 2FA/MFA; migrar direcciones fuera de Shopify; checkout Shopify; historial de pedidos reales de Shopify (mientras el Admin token sea stub).

**Decisión abierta (única dependencia externa pendiente):** proveedor de email transaccional para verificación de email + reset por enlace. Mientras no se elija, v1 usa **recuperación interina por admin** (sin dependencia de email). Ver §11.

## 4. Arquitectura general

```
Navegador
  │  cookie de sesión propia: HttpOnly + Secure + SameSite=Lax, firmada (SESSION_SECRET)
  ▼
Oxygen worker (loaders/actions React Router) — todo el código auth corre aquí, nunca en cliente
  ├─ app/lib/auth/        → identidad + sesión (Turso + PBKDF2+pepper)
  ├─ app/lib/admin/       → cliente Admin GraphQL (real | stub)
  ├─ app/lib/db/          → cliente libSQL/web HTTP + repos
  ├─ app/lib/decoration/  → motor de precios (puro, testeable)
  ├─ app/lib/http/        → assertSameOrigin (CSRF default-deny)
  └─ context.storefront   → Storefront API (catálogo, metafields)
        ├──HTTPS──▶ Turso (users, quotes, quote_items, wishlist, login_attempts)
        └──HTTPS──▶ Shopify Admin API (customerCreate, draftOrderCreate) [stub→real]
```

**Reglas de aislamiento/seguridad transversales:**
- `db/`, `admin/`, `auth/{password,session,users,guard}` son **server-only**: prohibido importarlos desde componentes cliente. Check de build: el bundle cliente no debe contener `TURSO_AUTH_TOKEN`/`PRIVATE_ADMIN_API_TOKEN`/`AUTH_PEPPER`.
- Todo valor de seguridad usa `crypto.getRandomValues` / `crypto.randomUUID`. **Prohibido `Math.random`** (regla ESLint).
- Las llamadas externas usan URLs `https://` absolutas.

## 5. Subsistema A — Autenticación (Turso + PBKDF2)

### 5.1 Esquema (Turso / SQLite)

```sql
CREATE TABLE users (
  id                   TEXT PRIMARY KEY,           -- crypto.randomUUID()
  email                TEXT NOT NULL,              -- normalizado: trim+toLowerCase+NFKC
  password_hash        TEXT NOT NULL,              -- base64(derivedKey 32 bytes)
  password_salt        TEXT NOT NULL,              -- base64(16 bytes, getRandomValues)
  password_iterations  INTEGER NOT NULL,           -- 100000 (cap workerd); se guarda para upgrades
  session_version      INTEGER NOT NULL DEFAULT 1, -- se incrementa para "cerrar sesión en todos lados"
  first_name           TEXT,
  last_name            TEXT,
  company              TEXT,
  rfc                  TEXT,
  role                 TEXT NOT NULL DEFAULT 'quoter',
  shopify_customer_gid TEXT,                        -- gid real; 'STUB-...' en modo stub; null si falló
  email_verified_at    TEXT,                        -- null hasta verificar (cuando haya proveedor email)
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_users_email ON users(email);   -- fuente de verdad de unicidad
```

### 5.2 Módulos

- `app/lib/db/client.js` — **`import {createClient} from '@libsql/client/web'`** (verbatim; el import bare `@libsql/client` rompe el bundle workerd). `TURSO_DATABASE_URL` debe ser **`https://`** (Hrana-over-HTTP, no `libsql://`+websocket). El cliente se crea **por request** dentro del contexto/loader (nunca en module scope: los objetos I/O de workerd no cruzan requests y los globals se comparten en el isolate). Se pinea una versión de `@libsql/client` con la condición `workerd` resuelta (≥0.15.x). Regla ESLint `no-restricted-imports` que prohíbe `@libsql/client` (solo permite `@libsql/client/web`).
- `app/lib/auth/password.js`
  - `hashPassword(plain)`: `peppered = HMAC-SHA256(plain, AUTH_PEPPER)`; `salt = getRandomValues(16)`; `derived = subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt, iterations:100000}, key(peppered), 256)`. Devuelve `{hash, salt, iterations}` en base64/int.
  - `verifyPassword(plain, rec)`: decodifica `hash`/`salt` a `Uint8Array`, deriva con **las iteraciones almacenadas** (no el default), compara en **tiempo constante** (acumulador XOR sobre longitud fija; el chequeo de longitud forma parte del acumulador, sin early-return). Registros vacíos/corruptos ⇒ fallo de auth, no excepción. Si `iterations < default`, re-hashea y actualiza (upgrade transparente).
- `app/lib/auth/users.js` — repo: `createUser`, `findByEmail` (email normalizado), `findById`, `updateProfile`, `setShopifyGid`, `bumpSessionVersion`.
- `app/lib/auth/session.js` — sobre `AppSession`: `login(session, {userId, role, gid, sessionVersion})`, `getUser(session)`, `clear`. **Garantiza `isPending=true`** al escribir (contrato de AppSession para que `server.js` emita el `Set-Cookie`). Guarda un **snapshot mínimo** (`userId`, `role`, `gid`, `sessionVersion`) en la cookie firmada para evitar un round-trip a Turso en cada navegación protegida.
- `app/lib/auth/guard.js` — `requireUser(context)`: lee snapshot de sesión; valida `session_version` contra Turso solo cuando se necesita frescura (o periódicamente); si no hay sesión ⇒ `throw redirect('/login')`.
- `app/lib/http/csrf.js` — `assertSameOrigin(request)`: **default-deny**. Rechaza todo POST cuyo `Origin` (o `Referer` fallback) no coincida exactamente con el origen del sitio, y rechaza `Origin` ausente en fetch cross-site. Se invoca al inicio de **cada** action. `SameSite=Lax` es defensa en profundidad, no el control primario.

### 5.3 Rutas de auth

- `auth.signup.jsx` (action): `assertSameOrigin`; normaliza email; `hashPassword`; **intenta INSERT y captura violación de UNIQUE** (no read-then-write) → "email ya registrado" (sin fuga de timing); `createCustomer` (idempotente: busca por email, maneja `TAKEN` reutilizando el gid existente); guarda `gid`; **rota sesión** (sesión nueva) y `login(...)`; `throw redirect('/account')` sin `Set-Cookie` manual.
- `auth.login.jsx` (action): `assertSameOrigin`; **throttling** per-email + per-IP con backoff/lockout (`login_attempts`), respuesta y timing genéricos (sin enumeración de usuarios); `verifyPassword`; **rota la sesión** antes de setear identidad (evita fijación); `login(...)`; redirect.
- `auth.logout.jsx` (action): `assertSameOrigin`; `session.destroy()` (no solo unset) para emitir `Set-Cookie` que expira la cookie; redirect. Opcional `bumpSessionVersion` para invalidar otras sesiones.

> **Commit de cookie:** las actions setean estado de sesión y `throw redirect(path)`; `server.js` (isPending) adjunta el `Set-Cookie` al response. Ninguna action adjunta su propio `Set-Cookie` (lo sobrescribiría). Test obligatorio: el 302 de login trae `Set-Cookie` y un request posterior queda autenticado.

### 5.4 Cambios en rutas/archivos existentes

| Archivo | Acción |
|---|---|
| `app/lib/session.js` | **Editar cookie**: añadir `secure: true` (gate `!== 'development'` para http local). Hoy NO lo tiene. |
| `app/routes/login.jsx` | Reescribir: formulario email+password → `/auth/login`. |
| `app/routes/registro.jsx` | Mantener UI multi-paso; añadir campo password; submit → `/auth/signup`. |
| `app/routes/account_.login.jsx`, `account_.authorize.jsx`, `account_.logout.jsx` | **Eliminar** (OAuth Shopify). |
| `app/routes/account.$.jsx` | `handleAuthStatus()` → `requireUser(context)`. |
| `app/routes/account.jsx`, `account._index.jsx` | Perfil desde Turso (`requireUser`); quitar dependencia de `customerAccount`. |
| `app/routes/account.profile.jsx` | `updateProfile` en Turso; quitar `customerAccount.mutate`. |
| `app/routes/account.addresses.jsx` | v1: **quitar del nav** (direcciones dependían de Customer Account). Una sola salida, no "próximamente". |
| `app/routes/account.orders._index.jsx`, `account.orders.$id.jsx` | **Quitar del nav** y dejar de llamar `customerAccount`; historial real se difiere a Admin token real. |
| `app/root.jsx` | `isLoggedIn` ← snapshot de sesión; además inyecta `role`, `quote`, `favs` iniciales del server a `AppProvider`. |
| `app/lib/context.js` | Mantener `createHydrogenContext` (storefront). `customerAccount` deja de ser fuente de auth. |
| `app/lib/AppContext.jsx` | Estado inicial **desde props del loader** (no localStorage cuando hay sesión). `role` read-only. Acciones quote/favs → fetchers al server (optimista). |
| `app/components/gi/RoleBanner.jsx` | **Quitar el switcher de rol** y el grupo "Rol simulado" del TweaksPanel (rol read-only). |

## 6. Subsistema B — Vínculo Shopify + Admin API (stub → real)

- `app/lib/admin/client.js`: `adminFetch(query, variables)` → `POST https://{PUBLIC_STORE_DOMAIN}/admin/api/{SHOPIFY_ADMIN_API_VERSION}/graphql.json`, header `X-Shopify-Access-Token`.
  - **Detección de modo:** si `PRIVATE_ADMIN_API_TOKEN` presente ⇒ real; si no ⇒ **stub** (loguea, devuelve gids `STUB-<uuid>`). El stub es **ruidoso y no-producción**: si `ENVIRONMENT==='production'` y falta el token ⇒ lanza al iniciar. Nunca se muestra un `invoiceUrl` de stub al usuario.
- `app/lib/admin/operations.js`:
  - `createCustomer({email, firstName, lastName})` — `CustomerInput` admite email/firstName/lastName (opcionales); **debe** incluir al menos uno (siempre mandamos email). Maneja `userErrors`: email duplicado (`TAKEN`) ⇒ `customers(query:"email:…")` y reutiliza el gid.
  - `createDraftOrder(input)` — ver §7.2.
- **Scopes:** requeridos para las mutations: **`write_draft_orders`, `write_customers`**. Añadir `read_draft_orders`, `read_customers` solo cuando se lea de vuelta (historial diferido). (Los `write_*` suelen implicar lectura.)
- **API version:** `2026-04` (último estable al 2026-06-16; **pinear**, no usar alias móvil; revisar cada trimestre).
- **Env:** `PRIVATE_ADMIN_API_TOKEN` (ausente ⇒ stub), `PUBLIC_STORE_DOMAIN` (existe), `SHOPIFY_ADMIN_API_VERSION` (default `2026-04`).

## 7. Subsistema C — Cotizaciones persistentes → draft orders

### 7.1 Esquema (Turso)

```sql
CREATE TABLE quotes (
  id                      TEXT PRIMARY KEY,
  user_id                 TEXT NOT NULL REFERENCES users(id),
  status                  TEXT NOT NULL DEFAULT 'draft',  -- 'draft'|'submitted'|'converted'|'cancelled'
  notes                   TEXT,
  deadline                TEXT,
  shopify_draft_order_gid TEXT,
  shopify_invoice_url     TEXT,
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_one_draft_per_user ON quotes(user_id) WHERE status='draft'; -- invariante real
CREATE TABLE quote_items (
  id                   TEXT PRIMARY KEY,
  quote_id             TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  variant_id           TEXT NOT NULL,        -- gid del variant (referencia producción)
  product_handle       TEXT,
  title                TEXT,
  qty                  INTEGER NOT NULL CHECK (qty >= 1),
  base_unit_price      REAL NOT NULL,        -- autoritativo: leído del Storefront en server
  technique            TEXT,
  surface              TEXT,
  size                 TEXT,
  decoration_total     REAL NOT NULL DEFAULT 0,  -- número crudo (no string localizado)
  effective_unit_price REAL NOT NULL,            -- round2(base + decoration_total/qty)
  created_at           TEXT NOT NULL
);
CREATE INDEX idx_quotes_user ON quotes(user_id);
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);
```

Invariante "una quote `draft` por usuario" **enforzado por índice parcial único**; el add es get-or-create atómico que captura la violación y selecciona la draft existente.

### 7.2 Flujo

1. **add/update** (`api.quote.add/update.jsx`): `assertSameOrigin`; `requireUser`. El cliente envía **solo `{variantId, technique, surface, size, qty}`** — el server **recalcula** `base_unit_price` (Storefront), `decoration_total` y `effective_unit_price` con el motor (§9). **Nunca** persiste precios enviados por el cliente. Upsert de la quote draft + item.
2. **remove/clear**: análogas; recalculan totales.
3. **submit** (`api.quote.submit.jsx`):
   - Si `shopify_customer_gid` es null o `STUB-*` y hay token real ⇒ `createCustomer` perezoso (idempotente) y persiste antes de continuar; **nunca** se construye `purchasingEntity` con customerId null.
   - `createDraftOrder`:
     ```graphql
     mutation { draftOrderCreate(input: {
       purchasingEntity: { customerId: $customerGid }   # DraftOrderInput.customerId fue REMOVIDO en 2026-04
       email: $email
       presentmentCurrencyCode: MXN                      # debe coincidir con la moneda de las líneas
       note: $notes
       lineItems: [{
         title: "<title> — <TECNICA> <MEDIDA>",          # custom line (sin variantId)
         quantity: <qty>,
         originalUnitPriceWithCurrency: { amount: "<effective_unit_price 2dp>", currencyCode: MXN },
         customAttributes: [{ key: "Decorado", value: "<TECNICA> - <MEDIDA>" },
                            { key: "VariantRef", value: "<variant_id>" }]
       }]
     }) { draftOrder { id invoiceUrl } userErrors { field message } } }
     ```
     > El precio del decorado va **integrado** en `originalUnitPriceWithCurrency` (MoneyInput `{amount, currencyCode}`); jamás como atributo. Líneas custom ⇒ sin descuento de inventario (tradeoff aceptado, §2.1).
   - Guarda `shopify_draft_order_gid` + `invoice_url`; marca `submitted`. Maneja `userErrors`.
4. Rutas nuevas `account.cotizaciones._index.jsx` + `account.cotizaciones.$id.jsx`: lista/historial desde Turso.

**Presupuesto de subrequests:** cada query libSQL y cada llamada Admin/Storefront es un subrequest externo (objetivo <50/request). `submit` usa `batch()`/transacción libSQL para colapsar lecturas/escrituras en un round-trip; evitar N+1 en loaders.

### 7.3 Cambios

- `cotizacion.jsx`: el submit falso (`setTimeout`) → POST real a `/api/quote/submit`; éxito muestra folio (`quote.id`) y, si existe y es real, enlace a `invoice_url`. Decremento/incremento por 1, mínimo 1.
- `AppContext`: `addToQuote/updateQuoteQty/removeFromQuote/clearQuote` usan fetchers (optimista); estado inicial desde props del loader.

## 8. Subsistema D — Wishlist persistente

```sql
CREATE TABLE wishlist (
  user_id    TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, product_id)
);
```

- `api.wishlist.jsx` (action toggle, loader list). `assertSameOrigin` + `requireUser`.
- `toggleFav` postea al server (optimista). **Migración one-shot**: tras el **primer load autenticado**, si hay `localStorage.gi_favs`, se mergea al server y se limpia local. `localStorage` solo se usa cuando NO hay sesión.
- `account.favoritos.jsx` lee del server y resuelve productos vía Storefront `nodes(ids:)`.

## 9. Subsistema E — Motor de precios de decorado

### 9.1 Módulo puro `app/lib/decoration/engine.js`

Porta fiel del Liquid. Funciones puras (sin I/O), testeables.

```js
export const PRICE_MATRIX = { /* matrizPrecios EXACTO del Liquid, claves con acentos/mayúsculas idénticas */ };

// rutina de match de superficie compartida por getMeasures Y calcDecoration:
function matchSurfaceKey(technique, surface) {
  const sf = String(surface).toUpperCase();
  return Object.keys(PRICE_MATRIX[technique] || {})
    .find(k => k.split(' / ').includes(sf));   // membresía EXACTA, no substring
}

export function getTechniques(metafieldValue) {
  const raw = String(metafieldValue ?? '').trim();
  if (raw.startsWith('[')) {                    // list.single_line_text_field ⇒ JSON array string
    try { return JSON.parse(raw).map(s => String(s).trim()).filter(Boolean); } catch { /* fallthrough */ }
  }
  return raw.split('-').map(s => s.trim()).filter(Boolean);  // single_line_text_field dash-delimited
}

export function getMeasures(technique, surface) {
  const key = matchSurfaceKey(technique, surface);
  return key ? PRICE_MATRIX[technique][key].map(op => op.medida) : [];
}

export function calcDecoration(technique, surface, qty, size) {
  if (technique === 'Sin decorado')             // short-circuit ANTES del lookup (no es clave de la matriz)
    return { error: null, totalPrice: 0, unitPrice: 0, neededQtyForMin: 0, isMinPriceUsed: false };
  if (!PRICE_MATRIX[technique]) return { error: `Tipo de decorado no encontrado: ${technique}`, totalPrice: 0, unitPrice: 0 };
  const key = matchSurfaceKey(technique, surface);
  if (!key) return { error: `Superficie no encontrada: ${surface}`, totalPrice: 0, unitPrice: 0 };
  const op = PRICE_MATRIX[technique][key].find(o => o.medida.toLowerCase() === String(size).toLowerCase()); // case-insensitive (la matriz mezcla '10 X 10'/'10 x 10')
  if (!op) return { error: `Medida no encontrada: ${size}`, totalPrice: 0, unitPrice: 0 };
  const min = op.cantidadMinima;
  const total = qty >= min ? (qty * op.precioMinimo) / 0.67   // markup ~+49% (artefacto de costo del negocio, se conserva)
                           : op.precioMaximo;                 // cargo FIJO (cliché/setup) cuando qty < min
  return { error: null, totalPrice: total, unitPrice: qty > 0 ? total / qty : 0,
           neededQtyForMin: min, isMinPriceUsed: qty >= min };
}

export function effectiveUnitPrice(basePrice, decorationTotal, qty) {
  return basePrice + (qty > 0 ? decorationTotal / qty : 0);   // ≡ (base*qty + decoTotal)/qty del Liquid
}
```

- **Regla de redondeo única:** `effective_unit_price = round2(effectiveUnitPrice(...))` se usa idéntico para mostrar, persistir y para `originalUnitPriceWithCurrency.amount`. Los números se guardan **crudos** (no strings localizados); se formatean solo al render.
- **Tests de paridad obligatorios** (valores crudos, antes de formato): SERIGRAFÍA/TEXTIL/"4 x 4"/qty=300 ⇒ total=(300·3.33)/0.67=1491.0447…, unit=4.9701…; SERIGRAFÍA/ACERO…/"10 X 10" (X mayúscula) match OK; qty=1 bajo mínimo ⇒ total=precioMaximo, unit=precioMaximo; "Sin decorado" ⇒ total 0 sin error; superficie/medida/técnica inexistentes ⇒ error estructurado.

### 9.2 UI `app/components/gi/DecorationSelector.jsx`

- Inputs: `product` (metafields), `basePrice`, `qty`, `onChange(detail)` donde `detail = {technique, surface, size, qty}` (**solo inputs**, los números son display).
- Flujo: select **técnica** (`getTechniques` + "Sin decorado") → select **medida** (`getMeasures`) → muestra **un solo precio unitario** = `round2(effectiveUnitPrice)` + línea secundaria "incluye decorado $X/pz".
- **Cargo fijo bajo mínimo:** cuando `qty < cantidadMinima`, el decorado es un **total fijo** (`precioMaximo`) amortizado entre `qty`, así que el unitario es alto para pocas piezas (intencional: costo de setup/cliché). Mensaje: "Cargo fijo de decorado $X; alcanza N piezas para precio por unidad".
- **Errores:** si `calcDecoration` devuelve `error`, se muestra el mensaje y se **deshabilita** agregar a cotización (no se transmite nada).
- Si el producto no tiene `tecnicas_de_impresion` ⇒ no se renderiza el selector (degradación elegante).

### 9.3 Metafields y fragments

- Añadir a `giFragments.js` (card) y al fragment de producto en `products.$handle.jsx`:
  ```graphql
  metafields(identifiers: [
    {namespace: "custom", key: "tecnicas_de_impresion"},
    {namespace: "custom", key: "superficie"}
  ]) { key namespace value }
  ```
- `normalizeProduct` (`gi.js`) expone `techniques` (via `getTechniques`) y `surface` (string crudo; el motor lo uppercasea).
- **Verificar contra la tienda real** el tipo de cada metafield: si es `list.single_line_text_field`, `value` llega como **string JSON-array** (manejado por `getTechniques`); `custom.superficie` debe ser single-line. Las **cadenas de técnica deben coincidir byte-a-byte** con las claves de `PRICE_MATRIX` (acentos/mayúsculas incl. "SERIGRAFÍA", "IMPRESIÓN UV PLANA FULL COLOR"); test que asegura que cada opción mapea a una clave.

## 10. Subsistema F — Quitar rangos/MOQ (cantidad desde 1)

`moq` se **conserva en el modelo de datos** (parseMoq sigue) pero **deja de forzar mínimos y se quita de TODA la UI**. "Informativo" = disponible a código/analytics, no mostrado.

| Archivo | Cambio |
|---|---|
| `app/lib/gi.js` | No usar `volumeTiers` para precio; `moq` ya no fuerza mínimos. |
| `app/routes/products.$handle.jsx` | `setQty(1)`; quitar botones de tiers y `Math.max(moq,…)`; input `min={1}`, incremento ±1; quitar textos "mínimo N pz"/"MOQ" (heading, grid, specs). |
| `app/components/gi/ProductCard.jsx` | `qty` inicial = 1; quitar "MOQ {moq} pz". |
| `app/routes/cotizacion.jsx` | Incremento/decremento por 1; mínimo 1. |
| `app/components/gi/HomeSections.jsx` | Quitar "Mínimo {moq} piezas". |
| `app/routes/collections.$handle.jsx` | Quitar ticker "MOQ promedio 50". |

## 11. Seguridad

- **Hashing:** PBKDF2-SHA256, **100 000 iteraciones** (cap duro de workerd; >100k lanza `NotSupportedError`), salt 16 bytes (`getRandomValues`), derived 256-bit, **+ pepper** `HMAC-SHA256(password, AUTH_PEPPER)` antes de PBKDF2 (sube el costo del atacante sin tocar iteraciones). Se guarda `iterations` para upgrades. Compare en tiempo constante.
- **Sesión:** cookie `HttpOnly` + **`Secure`** (editar `session.js`, hoy falta) + `SameSite=Lax`, firmada con `SESSION_SECRET`. **Rotación** en login/signup (sesión nueva, evita fijación). **Revocación** vía `session_version` en cookie + Turso ("cerrar sesión en todos lados" al cambiar password). Logout = `destroy()`.
- **Throttling de login (en v1, no diferido):** per-email + per-IP con backoff/lockout (`login_attempts`), respuesta/timing genéricos (sin enumeración).
- **CSRF:** `assertSameOrigin` default-deny en cada action (no solo SameSite).
- **Recuperación de contraseña (v1 interina):** acción admin server-only (ruta protegida/CLI) que fija password temporal y fuerza rotación — **sin dependencia de email**. Verificación de email + reset por enlace quedan como **add-on** en cuanto se elija proveedor (decisión abierta, §3); hasta entonces, **el signup no se considera verificado** (`email_verified_at` null) y, si se requiere, se puede gatear `submit` de cotización a email verificado.
- **Secretos:** `PRIVATE_ADMIN_API_TOKEN`, `TURSO_AUTH_TOKEN`, `AUTH_PEPPER`, `SESSION_SECRET` son server-only; check de build que verifica que no aparezcan en el bundle cliente.

## 12. Variables de entorno

| Var | Uso | Secreta |
|---|---|---|
| `SESSION_SECRET` | firma de cookie (existe) | sí |
| `AUTH_PEPPER` | HMAC del password pre-PBKDF2 (nuevo) | sí |
| `TURSO_DATABASE_URL` | conexión libSQL **https://** | sí |
| `TURSO_AUTH_TOKEN` | token libSQL | sí |
| `PRIVATE_ADMIN_API_TOKEN` | Admin API (ausente ⇒ stub) | sí |
| `SHOPIFY_ADMIN_API_VERSION` | versión Admin (default `2026-04`, pinear) | no |
| `PUBLIC_STORE_DOMAIN` | dominio myshopify (existe) | no |
| `ENVIRONMENT` | si `production` y falta Admin token ⇒ error al iniciar | no |

## 13. Inventario de archivos

**Nuevos:** `app/lib/db/{client,migrate}.js`, `app/lib/auth/{password,users,session,guard}.js`, `app/lib/http/csrf.js`, `app/lib/admin/{client,operations}.js`, `app/lib/decoration/engine.js`, `app/components/gi/DecorationSelector.jsx`, rutas `auth.{signup,login,logout}.jsx`, `api.quote.{add,update,remove,submit}.jsx`, `api.wishlist.jsx`, `account.cotizaciones._index.jsx`, `account.cotizaciones.$id.jsx`. Tests: `decoration/engine.test.*`, `auth/password.test.*`. Config: regla ESLint `no-restricted-imports` (`@libsql/client`, `Math.random`).

**Modificados:** `session.js` (cookie `secure`), `login.jsx`, `registro.jsx`, `account.$.jsx`, `account.jsx`, `account._index.jsx`, `account.profile.jsx`, `account.favoritos.jsx`, `account.orders._index.jsx`, `account.orders.$id.jsx`, `cotizacion.jsx`, `products.$handle.jsx`, `root.jsx`, `context.js`, `AppContext.jsx`, `gi.js`, `giFragments.js`, `ProductCard.jsx`, `HomeSections.jsx`, `RoleBanner.jsx`, `collections.$handle.jsx`, `package.json` (pin `@libsql/client`), `eslint.config.js`.

**Eliminados:** `account_.login.jsx`, `account_.authorize.jsx`, `account_.logout.jsx`.

## 14. Orden de implementación (fases)

1. **Infra datos + auth:** cliente Turso `/web` + migraciones; `password`(+pepper)/`session`(+rotación/version)/`users`/`guard`; `csrf`; rutas signup/login/logout (+throttling); `session.js` `secure`; reescribir `login.jsx`/`registro.jsx`; swap de guards y `root.isLoggedIn`; quitar switcher de rol; eliminar rutas OAuth. *(Entregable: registro/login real seguro.)*
2. **Vínculo Shopify (stub):** `admin/client` (+modo ruidoso) + `createCustomer` idempotente; guardar `gid`; reconciliación perezosa de gid null/STUB.
3. **Wishlist persistente:** esquema + `api.wishlist` + migración one-shot + `account.favoritos`.
4. **Cotizaciones + draft orders:** esquema (+índice parcial único); actions add/update/remove/submit (recálculo server-side, batch); `createDraftOrder` (`originalUnitPriceWithCurrency`); `cotizacion.jsx` real; rutas `account.cotizaciones`.
5. **Motor de decorado:** `decoration/engine` + tests de paridad; metafields en fragments; `DecorationSelector` en PDP; precio integrado + redondeo único.
6. **Quitar rangos/MOQ:** ediciones de §10.

Cada fase verificable de forma aislada (TDD en motor de decorado y hashing).

## 15. Estrategia de pruebas

- **Unitarias puras:** `decoration/engine` (paridad numérica cruda con el Liquid: SERIGRAFÍA/TEXTIL/300; "10 X 10"; qty<min; "Sin decorado"; errores; ambas formas de metafield); `password` (round-trip, rechazo, upgrade de iteraciones, compare de longitud).
- **Integración (mini-oxygen):** login 302 trae `Set-Cookie` y request posterior autenticado; logout limpia cookie; addToQuote→submit produce draft (stub) y persiste `gid`; índice parcial único impide doble draft; toggle wishlist persiste; check de bundle sin secretos.
- **Manual navegador:** PDP con decorado muestra precio integrado y mensaje de cargo fijo; cantidad desde 1; cotización con folio.

## 16. Decisiones tomadas en esta revisión (vetar aquí si no estás de acuerdo)

1. **Modelo de compra v1 = todo-cotización → draft order.** Sin carrito/checkout Shopify ni switcher de rol en v1 (§2.1). *Veta si quieres conservar checkout Shopify directo para items sin decorado.*
2. **Líneas custom (sin variante) en el draft order:** no descuentan inventario; `variant_id` solo referencia. Aceptado para promocional made-to-order.
3. **Recuperación de contraseña interina por admin** (sin email) en v1; verificación de email + reset por enlace al elegir proveedor de email (**única dependencia externa pendiente** — dime cuál usar: Resend, Postmark, SendGrid…).
4. **Historial de pedidos reales y direcciones**: diferidos en v1 (se quitan del nav).
5. **`moq`**: se conserva como dato, se elimina de toda la UI y de cualquier forzado de cantidad.
