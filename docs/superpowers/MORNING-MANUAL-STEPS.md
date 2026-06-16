# Pasos manuales para Ivan (mañana)

Lista de cosas que requieren tu acción y que no pude hacer autónomo. Se irá
actualizando conforme avanzan las fases. Orden sugerido: 1 → 2 primero (desbloquean
la verificación en vivo), el resto cuando puedas.

## 1. Token de base de datos de Turso (BLOQUEA verificación en vivo)
El token que me pasaste es un **Platform API token** (`org_id`), no un **database
auth token** — la DB lo rechaza (`invalid JWT token`). Los tests corren contra una DB
**en memoria**, pero para verificar contra tu Turso real necesito el token de BD:

```bash
turso db tokens create api-gi
```
Pega el resultado en `.env` reemplazando `TURSO_AUTH_TOKEN=REPLACE_WITH_TURSO_DB_TOKEN`.
(El `TURSO_DATABASE_URL` ya quedó como `https://api-gi-...turso.io`.)

## 2. SEGURIDAD: rota el Platform API token que pegaste en el chat
Pegaste un token de administración de la org en el chat (los logs pueden persistir).
Recomiendo **revocarlo/rotarlo** en el dashboard de Turso por higiene. No quedó
guardado en el repo (lo neutralicé en `.env`).

## 3. `SESSION_SECRET` de producción
El `.env` trae `SESSION_SECRET=algun-string-largo-y-aleatorio` (placeholder débil).
Para producción genera uno fuerte: `openssl rand -base64 48` y ponlo como secreto de
Oxygen. (`AUTH_PEPPER` ya lo generé yo, fuerte.)

## 4. Token de Admin API de Shopify (cuando quieras draft orders reales)
Hoy el cliente Admin corre en **modo stub** (no crea customers ni draft orders
reales). Cuando quieras activarlo:
- Shopify admin → Settings → Apps → Develop apps → crear custom app.
- Scopes: `write_draft_orders`, `read_draft_orders`, `write_customers`, `read_customers`.
- Copia el token `shpat_…` a `.env` como `PRIVATE_ADMIN_API_TOKEN` (y como secreto de Oxygen).

## 5. Proveedor de email (verificación + reset por enlace)
Decisión pendiente (Resend / Postmark / SendGrid). Mientras tanto hay recuperación
**interina por admin** (ruta `/admin/reset-password` con `ADMIN_RESET_SECRET`). Define
`ADMIN_RESET_SECRET` en `.env` si quieres usarla.

## 6. Verificar tipos de metafield en la tienda real
El motor de decorado lee `custom.tecnicas_de_impresion` y `custom.superficie`. Hay que
confirmar contra tu tienda que: (a) el tipo es texto simple separado por `-` o lista
JSON (el código maneja ambos), y (b) las cadenas de técnica coinciden **exactas**
(acentos/mayúsculas) con las claves de `PRICE_MATRIX` (p.ej. "SERIGRAFÍA").

## 7. Secretos en Oxygen (deploy)
Define en el entorno de Oxygen: `SESSION_SECRET`, `AUTH_PEPPER`, `TURSO_DATABASE_URL`,
`TURSO_AUTH_TOKEN`, `PRIVATE_ADMIN_API_TOKEN`, `SHOPIFY_ADMIN_API_VERSION`,
`ENVIRONMENT=production`, `ADMIN_RESET_SECRET`.

---

## Verificaciones en navegador / runtime (workerd) pendientes
(Se acumulan aquí conforme las fases las marcan como manuales.)

### Fase 1 — verificación de runtime (tras poner el DB token real, `npm run dev`)
Todas requieren dev server + Turso real (placeholder ahora). Con `SESSION_SECRET`,
`AUTH_PEPPER`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (y `ADMIN_RESET_SECRET`):
- Signup dos veces con el mismo email (variando mayúsculas/espacios) → segundo falla por UNIQUE (normalización OK).
- `POST /auth/login` válido → 302 con `Set-Cookie` de sesión; request siguiente queda autenticado.
- Visitar `/account/*` deslogueado → redirige a `/login` (requireUser).
- `/account` logueado → muestra nombre+email desde Turso; nav SOLo con secciones válidas (sin Órdenes/Direcciones).
- `/account/profile` → editar y recargar persiste (updateProfile en Turso).
- PUT cross-origin a `/account/profile` (Origin evil) → 403 (assertSameOrigin).
- `/admin/reset-password`: secret incorrecto→403, correcto→200+tempPassword, password viejo falla / temp entra; GET→404.
- Correr `npm run codegen` (genera tipos de rutas nuevas auth.*/admin.*; se difirió por toolchain de red).

### ACTUALIZACIÓN (durante la noche)
- ✅ Pusiste el DB token real y FUNCIONA. Apliqué las migraciones a tu Turso
  (`users, login_attempts, quotes, quote_items, wishlist`). Registro/login operativos.
- Runner de migraciones: `set -a; . ./.env; set +a; node scripts/migrate.mjs` (idempotente).
  Pendiente formalizar como `npm run migrate` (lo hago al cerrar las fases).
- Nota: en producción/Oxygen, corre las migraciones como paso de deploy (no auto por request).

### DECISIÓN: proveedor de email = Resend (definida por Ivan)
- `RESEND_API_KEY` ya está en `.env`. Dominio autenticado: `notificaciones.generandoideas.com`.
- Agregué `EMAIL_FROM="Generando Ideas <no-reply@notificaciones.generandoideas.com>"` al `.env`
  (ajusta el remitente si prefieres otro buzón del dominio).
- Esto habilita verificación de email + reset por enlace (estaban diferidos). Se construirán
  como **Fase 8** (después de las 7 fases core), con la misma disciplina TDD + revisión:
  módulo `lib/email/` (cliente Resend vía HTTP fetch, edge-safe), tabla de tokens, rutas
  `/auth/verify`, `/auth/forgot`, `/auth/reset`, y envío de verificación en signup.
- Recuerda poner `RESEND_API_KEY` y `EMAIL_FROM` también como secretos de Oxygen para deploy.

### NUEVO: Asesor asignado / ejecutiva de venta (metaobjeto `custom.ejecutiva_de_venta`)
Es un metafield tipo **referencia a metaobjeto**. Se resolverá expandiendo la referencia
en Storefront: `metafield(namespace:"custom",key:"ejecutiva_de_venta"){ reference { ... on Metaobject { type fields { key value } } } }`.

Default que asumí (vetar/ajustar en la mañana):
- Se resuelven TODOS los campos del metaobjeto y se mapean por heurística (nombre, email, teléfono).
- Uso: al **enviar una cotización**, se notifica por email (Resend) a la ejecutiva asignada;
  y se muestra al cliente (PDP/cotización).
- Se construye como pieza dedicada tras P4 (cotizaciones) + P8 (email).

DUDAS PARA IVAN (2):
1. ¿El metafield `custom.ejecutiva_de_venta` vive en el **producto** (como tecnicas_de_impresion/
   superficie) o en el **cliente/cuenta**? Asumí **producto** por consistencia; si es por cuenta,
   el ruteo de notificación es más limpio (un asesor por cliente) y se ajusta fácil.
2. ¿Cuáles son las **llaves de los campos** del metaobjeto (p.ej. `nombre`, `correo`, `telefono`)?
   Puedo traerlas todas y mapear por heurística, pero confírmame las llaves para mapear exacto
   (sobre todo el email al que se notifica).

### RESUELTO (asesor asignado):
- Vive en el **CLIENTE** (Shopify Customer), no en el producto. Un asesor por cuenta.
- Metaobjeto tipo `ejecutiva_de_venta`; **llave de email = `correo`**.
- Implementación: nueva operación Admin `getCustomerAdvisor(env, customerGid)` que lee
  `customer(id).metafield(custom.ejecutiva_de_venta).reference (Metaobject)` y extrae `correo`.
  Al enviar cotización (P4) se notifica a `correo` vía Resend (P8). Se muestra al cliente en cuenta/cotización.
- Scope Admin: requiere `read_customers` (ya listado) y probablemente `read_metaobjects` para
  resolver la referencia del metaobjeto — verificar al activar el token real.
- En modo stub (sin token real) la operación devuelve una ejecutiva de prueba; con token real lee la real.

### DATOS: precios de técnicas de decorado (la PRICE_MATRIX viene del theme VIEJO)
Tu producto ofrece (metafield comma-separated): **Tampografía, Serigrafía, Grabado en láser,
Impresión Digital, DTF UV**. La `PRICE_MATRIX` portada del liquid tiene 9 técnicas con OTROS
nombres/precios. Estado tras el fix:
- ✅ "Serigrafía" → SERIGRAFÍA (match por mayúsculas) — funciona.
- ✅ "Grabado en láser" → GRABADO LÁSER (alias) — funciona.
- ❓ "DTF UV" → ¿mapea a "VINIL IMPRIMIBLE Y DTF" o a "IMPRESIÓN UV PLANA FULL COLOR"? (dime cuál)
- ❌ "Tampografía" — no existe en la matriz. Necesito su tabla de precios (medida, precioMinimo,
     precioMaximo, cantidadMinima por superficie).
- ❌ "Impresión Digital" — igual, no existe en la matriz.
ACCIÓN: confírmame (1) si los precios de la matriz vieja siguen vigentes, (2) el mapeo de DTF UV,
y (3) la tabla de precios de Tampografía e Impresión Digital. Lo agrego a PRICE_MATRIX/aliases.
También verifica que el metafield `custom.superficie` del producto tenga un valor que exista en la
matriz (p.ej. "TEXTIL"); si no, dará "Superficie no encontrada".

### ACTUALIZACIÓN decorado (durante la noche, commits 41f5e66 / 36f133e)
- ✅ Superficie ahora se lee de `custom.material` (no `custom.superficie`). Resuelto "Superficie no encontrada".
- ✅ Técnicas: split por comas + resolución por nombre. Selector solo ofrece técnicas de la matriz.
- ✅ Decisión tuya aplicada: NO mapear técnicas fuera de la matriz; se documentan en
  `docs/decoration-nonstandard-techniques.md` (+ `scripts/audit-techniques.mjs` para auditar toda la tienda).
- PENDIENTE datos: valor de `custom.material` debe existir en los grupos de la matriz; si no, dará "no encontrada".
  ¿Extiendo el audit para listar materiales no estándar también? (dímelo)

### ACTUALIZACIÓN (P7/P8 hechas)
- ✅ P7 (AppContext/UI wiring) y P8 (email Resend) completas. Base B2B + email funcional.
- ⚠️ RE-MIGRAR: P8 agregó la tabla `email_tokens`. Corre de nuevo:
  `set -a; . ./.env; set +a; node scripts/migrate.mjs` (idempotente; crea email_tokens).
- Rutas nuevas de email: `/auth/forgot`, `/auth/reset?token=`, `/auth/verify?token=`. Verificación se
  envía en signup (best-effort). Pon `RESEND_API_KEY`/`EMAIL_FROM` como secretos de Oxygen para deploy.

### ESTADO FINAL: las 9 fases completas ✅ (suite 143/143 tests, build OK)
P1 auth · P2 shopify(stub) · P5 decorado · P4 cotizaciones/draft orders · P3 wishlist ·
P6 quitar MOQ · P7 AppContext/UI · P8 email(Resend) · P9 asesor. Todo en `feat/auth-decoration-quotes`.

### Pendiente conocido: `npm run lint` truena (config, no del código)
La config de ESLint aplica `eslint-plugin-jest` a `*.test.{js,jsx}` pero el proyecto usa Vitest
(jest no está instalado), así que ESLint crashea ("Unable to detect Jest version") en cualquier
archivo de test. Los archivos fuente lintan limpio individualmente. FIX (mañana): en `eslint.config.js`
quitar/!reemplazar `eslint-plugin-jest` por `eslint-plugin-vitest`, o excluir `**/*.test.*` de ese bloque.

### Para probar TODO en vivo (mañana)
1. `set -a; . ./.env; set +a; node scripts/migrate.mjs`  (crea email_tokens también).
2. `npm run dev` → registro/login, agrega a cotización (precio con decorado), envía (draft order stub),
   wishlist, /auth/forgot/reset/verify, bloque "Tu asesor" en la cotización.
3. Cuando tengas el token Admin real de Shopify → draft orders + customer + asesor reales.
