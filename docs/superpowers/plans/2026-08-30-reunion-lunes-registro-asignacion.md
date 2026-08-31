# Reunión del lunes — implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copiar al manager en las cotizaciones con ejecutivo, endurecer y ampliar el registro (campos, aviso de privacidad, términos y newsletter) y sacar la asignación de asesor del alta para que marketing la valide en el admin de Shopify.

**Architecture:** Todo el trabajo cae en cuatro capas ya existentes y se mantiene dentro de sus patrones: módulos puros sin I/O (`managers.js`, `advisorEmail.js`, `advisor-choice.js`, `registro.validation.js`), operaciones del Admin API (`admin/operations.js`), el fan-out best-effort que nunca lanza (`quotes/notify.js`, `auth/signup-notify.js`) y el wizard de tres pasos con espejos ocultos (`routes/registro.jsx` + `auth.signup.jsx`). No se crea infraestructura nueva: no hay UI interna, no hay servicio externo de correo, no hay tablas nuevas — sólo columnas añadidas de forma idempotente.

**Tech Stack:** Hydrogen 2026.4 sobre React Router 7, libSQL/Turso, Shopify Admin GraphQL, Resend, Vitest (`npm test`).

**Spec:** `docs/superpowers/specs/2026-08-30-reunion-lunes-registro-asignacion-design.md`

## Global Constraints

- **Nada de lo que toca correo puede lanzar.** `quotes/notify.js` y `auth/signup-notify.js` se ejecutan después de que la cotización o la cuenta ya se persistieron; todo fallo se registra con `console.error` y se sigue.
- **El alta de Shopify es best-effort.** `linkSignupCustomer` devuelve `null` si Shopify falla y el alta continúa. Ninguna funcionalidad nueva puede convertir eso en un error fatal.
- **El navegador nunca manda gids.** Sólo handles, que el servidor resuelve contra Shopify.
- **Migraciones idempotentes.** Toda columna se añade con `addColumnIfMissing` y es nullable. `migrate()` debe poder correrse dos veces seguidas.
- **Los espejos ocultos son obligatorios.** Cada campo del wizard que no esté en el paso visible necesita su `<input type="hidden">` en `registro.jsx:125-135` o se pierde en silencio.
- **Idioma:** comentarios y textos de usuario en español; se sigue el estilo del archivo que se toca.
- **Pruebas:** Vitest, `npm test`. Archivos `*.test.js` junto al módulo. `// @vitest-environment jsdom` en la primera línea para pruebas de componente.
- **Correr `npm test` completo antes de cada commit.** Varias tareas rompen pruebas existentes a propósito; el plan dice cuáles.

### Nombres de columna (contrato entre tareas)

| Columna SQL | Campo JS | Contenido |
| --- | --- | --- |
| `position` | `position` | Cargo, texto libre |
| `area` | `area` | Área, del catálogo |
| `heard_about` | `heardAbout` | ¿Cómo nos conociste?, del catálogo |
| `location` | `location` | Ubicación, del catálogo |
| `es_cliente` | `esCliente` | `'si'` / `'no'` / `null` |
| `advisor_handle` | `advisorHandle` | Handle del asesor reclamado, o `null` |
| `privacy_accepted_at` | `privacyAcceptedAt` | ISO |
| `terms_accepted_at` | `termsAcceptedAt` | ISO |
| `newsletter_opt_in` | `newsletterOptIn` | `INTEGER` 0/1 |
| `newsletter_opt_in_at` | `newsletterOptInAt` | ISO o `null` |

> **Enmienda al spec:** la sección 2.4 del spec no listaba `es_cliente`, pero la 5.3 pide que el correo a marketing diga "si se declaró cliente". Sin esa columna el dato no existe: un `advisor_handle` nulo no distingue "no soy cliente" de "soy cliente pero no sé quién me atiende". Se añade la columna.

### Pendientes externos (no bloquean ninguna tarea)

| Qué | Efecto mientras no llegue |
| --- | --- |
| Matriz correo de ejecutivo → correo de manager | `MANAGERS` queda vacío; ninguna cotización lleva CC. El módulo y sus pruebas quedan completos. |
| PDF de términos y condiciones | El enlace del footer y del registro dan 404. |
| Número real de tiempo de entrega (Gil) | El bloque 6 del spec no se toca en este plan. |

---

## Estructura de archivos

**Se crean:**

| Archivo | Responsabilidad |
| --- | --- |
| `app/lib/quotes/managers.js` | Matriz ejecutivo→manager y su búsqueda normalizada. Puro. |
| `app/lib/quotes/managers.test.js` | — |
| `app/routes/registro.catalogos.js` | Catálogos de Área, ¿Cómo nos conociste? y Ubicación. Compartidos por el formulario y la validación del servidor. |
| `app/lib/db/migrate.perfilLegal.test.js` | Prueba de las diez columnas nuevas. |

**Se modifican:**

| Archivo | Cambio |
| --- | --- |
| `app/lib/email/resend.js` | Soporte de `cc`. |
| `app/lib/quotes/advisorEmail.js` | Devuelve `cc` cuando hay manager. |
| `app/lib/quotes/notify.js` | Resuelve el manager y sólo copia si hay ejecutivo real. |
| `app/lib/db/migrate.js` | Diez columnas nuevas. |
| `app/lib/auth/users.js` | `createUser`, `rowToUser`, `SELECT_COLS`. |
| `app/lib/auth/advisor-choice.js` | Devuelve el handle reclamado o `null`; deja de asignar. |
| `app/lib/admin/operations.js` | `addCustomerTags`; `createCustomer` acepta consentimiento de marketing. |
| `app/lib/auth/signup-link.js` | Etiqueta `lead-pendiente` en vez de asignar asesor. |
| `app/lib/auth/signup-advisor-email.js` | Muestra el asesor reclamado y si se declaró cliente. |
| `app/lib/auth/signup-notify.js` | Resuelve el nombre del asesor reclamado y lo pasa al builder. |
| `app/routes/registro.validation.js` | Teléfono, cargo, área, ubicación, origen y los dos checks legales. |
| `app/routes/registro.jsx` | Campos nuevos, obligatoriedades, checks legales y newsletter. |
| `app/routes/auth.signup.jsx` | Lee y valida todo lo nuevo; rechaza sin aceptación legal. |
| `app/lib/site-content.js` | `ROUTES.terms`. |
| `app/components/gi/Footer.jsx` | Enlace a términos. |

---

## FASE A — CC al manager en cotizaciones

### Task 1: `sendEmail` acepta `cc`

**Files:**
- Modify: `app/lib/email/resend.js:19-45`
- Test: `app/lib/email/resend.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `sendEmail(env, {to, subject, html, replyTo, cc})`. Cuando `cc` es falsy la clave **no aparece** en el cuerpo del POST (Resend rechaza `cc: undefined`).

- [ ] **Step 1: Write the failing tests**

En `app/lib/email/resend.test.js`, dentro del `describe('email/resend', …)`:

```js
  it('incluye cc en el cuerpo cuando se proporciona', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({id: 'msg_1'}),
    });
    await sendEmail(
      {RESEND_API_KEY: 'sk', EMAIL_FROM: 'GI <no-reply@x.com>'},
      {to: 'a@b.com', subject: 's', html: 'h', cc: 'jefe@generandoideas.com'},
    );
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.cc).toBe('jefe@generandoideas.com');
  });

  it('omite la clave cc por completo cuando no hay copia', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({id: 'msg_2'}),
    });
    await sendEmail(
      {RESEND_API_KEY: 'sk', EMAIL_FROM: 'GI <no-reply@x.com>'},
      {to: 'a@b.com', subject: 's', html: 'h'},
    );
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect('cc' in body).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/lib/email/resend.test.js`
Expected: FAIL — el primero con `expected undefined to be 'jefe@generandoideas.com'`.

- [ ] **Step 3: Implement**

En `app/lib/email/resend.js`, añadir `cc` al destructuring de la firma y al cuerpo:

```js
export async function sendEmail(env, {to, subject, html, replyTo, cc}) {
```

En el `console.warn` del stub, añadir la copia para que en desarrollo se vea:

```js
        `to=${to}${cc ? ` cc=${cc}` : ''} subject=${JSON.stringify(subject)} — email NOT sent.`,
```

Y en el `JSON.stringify` del POST, junto a `reply_to`:

```js
      ...(replyTo ? {reply_to: replyTo} : {}),
      ...(cc ? {cc} : {}),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/lib/email/resend.test.js`
Expected: PASS, incluida la prueba existente que compara el cuerpo completo con `toEqual` (sigue pasando porque `cc` no se añade cuando falta).

- [ ] **Step 5: Commit**

```bash
git add app/lib/email/resend.js app/lib/email/resend.test.js
git commit -m "feat(email): sendEmail acepta cc"
```

---

### Task 2: Matriz de managers

**Files:**
- Create: `app/lib/quotes/managers.js`
- Test: `app/lib/quotes/managers.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `managerFor(advisorEmail, tabla = MANAGERS) -> string|null` y `export const MANAGERS`. Normaliza recortando espacios y bajando a minúsculas.

**Por qué el segundo parámetro:** la matriz real todavía no existe, y aun cuando exista no debe ser lo que fije el comportamiento de las pruebas. `tabla` permite probar la lógica con datos fijos, y una prueba aparte vigila que la matriz real esté bien formada.

- [ ] **Step 1: Write the failing test**

Crear `app/lib/quotes/managers.test.js`:

```js
import {describe, it, expect} from 'vitest';
import {MANAGERS, managerFor} from './managers.js';

const TABLA = {
  'laura@generandoideas.com': 'antonio@generandoideas.com',
  'pedro@generandoideas.com': 'jesus@generandoideas.com',
};

describe('managerFor', () => {
  it('devuelve el manager de un ejecutivo conocido', () => {
    expect(managerFor('laura@generandoideas.com', TABLA)).toBe('antonio@generandoideas.com');
  });

  it('ignora mayúsculas y espacios sobrantes', () => {
    expect(managerFor('  LAURA@Generandoideas.com  ', TABLA)).toBe(
      'antonio@generandoideas.com',
    );
  });

  it('devuelve null para un ejecutivo que no está en la matriz', () => {
    expect(managerFor('ajena@generandoideas.com', TABLA)).toBeNull();
  });

  it('devuelve null para entradas vacías', () => {
    expect(managerFor('', TABLA)).toBeNull();
    expect(managerFor('   ', TABLA)).toBeNull();
    expect(managerFor(null, TABLA)).toBeNull();
    expect(managerFor(undefined, TABLA)).toBeNull();
  });

  it('no hereda claves del prototipo de Object', () => {
    // Un correo llamado "constructor" no debe resolver a una función.
    expect(managerFor('constructor', TABLA)).toBeNull();
  });

  it('funciona contra la matriz real sin explotar cuando está vacía', () => {
    expect(managerFor('quien-sea@generandoideas.com')).toBeNull();
  });
});

describe('MANAGERS', () => {
  it('tiene todas sus llaves normalizadas', () => {
    // Si alguien pega la matriz con mayúsculas o espacios, el CC fallaría en
    // silencio. Esta prueba lo convierte en un fallo ruidoso.
    for (const clave of Object.keys(MANAGERS)) {
      expect(clave).toBe(clave.trim().toLowerCase());
    }
  });

  it('no apunta a nadie con un correo vacío', () => {
    for (const valor of Object.values(MANAGERS)) {
      expect(String(valor).trim()).not.toBe('');
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/lib/quotes/managers.test.js`
Expected: FAIL — `Failed to resolve import "./managers.js"`.

- [ ] **Step 3: Implement**

Crear `app/lib/quotes/managers.js`:

```js
// Puro y sin dependencias: quién es el manager de cada ejecutivo de venta.
//
// La relación no vive en Shopify — el metaobject `ejecutiva_de_venta` sólo
// guarda nombre, correo, teléfono y puesto. Se decidió mantenerla aquí como
// matriz a mano y actualizarla cuando cambie el organigrama.
//
// Se indexa por CORREO, no por handle, porque en el momento del envío
// `getCustomerAdvisor` sólo devuelve el correo del metaobject. Las llaves van
// en minúsculas y sin espacios; `managers.test.js` lo vigila.

/** @type {Record<string, string>} correo del ejecutivo -> correo de su manager */
export const MANAGERS = {
  // Pendiente: vaciar aquí la matriz que entregue Iván.
  // 'laura@generandoideas.com': 'antonio@generandoideas.com',
};

/**
 * Manager de un ejecutivo, o null si no está en la matriz. Nunca lanza: un
 * ejecutivo sin manager simplemente manda su correo sin copia.
 * @param {string|null|undefined} advisorEmail
 * @param {Record<string, string>} [tabla] inyectable para pruebas
 * @returns {string|null}
 */
export function managerFor(advisorEmail, tabla = MANAGERS) {
  const clave = String(advisorEmail ?? '').trim().toLowerCase();
  if (!clave) return null;
  // hasOwnProperty evita que un correo como "constructor" resuelva al
  // prototipo de Object.
  if (!Object.prototype.hasOwnProperty.call(tabla, clave)) return null;
  const manager = String(tabla[clave] ?? '').trim();
  return manager || null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/lib/quotes/managers.test.js`
Expected: PASS (12 aserciones).

- [ ] **Step 5: Commit**

```bash
git add app/lib/quotes/managers.js app/lib/quotes/managers.test.js
git commit -m "feat(quotes): matriz ejecutivo-manager"
```

---

### Task 3: `buildAdvisorEmail` devuelve `cc`

**Files:**
- Modify: `app/lib/quotes/advisorEmail.js`
- Test: `app/lib/quotes/advisorEmail.test.js`

**Interfaces:**
- Consumes: nada (sigue siendo puro).
- Produces: `buildAdvisorEmail({advisorEmail, managerEmail, quote, user, items, invoiceUrl}) -> {to, subject, html, cc?}`. La clave `cc` sólo existe cuando `managerEmail` es truthy.

- [ ] **Step 1: Write the failing tests**

Añadir a `app/lib/quotes/advisorEmail.test.js`:

```js
  it('incluye cc cuando el ejecutivo tiene manager', () => {
    const msg = buildAdvisorEmail({
      advisorEmail: 'laura@generandoideas.com',
      managerEmail: 'antonio@generandoideas.com',
      quote: {id: 'q-1'},
      user: {email: 'cliente@empresa.mx'},
      items: [],
      invoiceUrl: null,
    });
    expect(msg.cc).toBe('antonio@generandoideas.com');
  });

  it('omite la clave cc cuando no hay manager', () => {
    const msg = buildAdvisorEmail({
      advisorEmail: 'laura@generandoideas.com',
      managerEmail: null,
      quote: {id: 'q-1'},
      user: {email: 'cliente@empresa.mx'},
      items: [],
      invoiceUrl: null,
    });
    expect('cc' in msg).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/lib/quotes/advisorEmail.test.js`
Expected: FAIL — `expected undefined to be 'antonio@generandoideas.com'`.

- [ ] **Step 3: Implement**

En `app/lib/quotes/advisorEmail.js`, añadir `managerEmail` al destructuring y a la doc, y cambiar el `return`:

```js
export function buildAdvisorEmail({advisorEmail, managerEmail, quote, user, items, invoiceUrl}) {
```

```js
  return {
    to: advisorEmail,
    // Sólo se copia al manager cuando lo hay: Resend rechaza cc: undefined.
    ...(managerEmail ? {cc: managerEmail} : {}),
    subject: `Nueva cotización ${quote.id} — ${fullName || user.email}`,
    html,
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/lib/quotes/advisorEmail.test.js`
Expected: PASS. Las pruebas existentes siguen pasando: llamar sin `managerEmail` no añade la clave.

- [ ] **Step 5: Commit**

```bash
git add app/lib/quotes/advisorEmail.js app/lib/quotes/advisorEmail.test.js
git commit -m "feat(quotes): copia al manager en el correo del ejecutivo"
```

---

### Task 4: El fan-out sólo copia cuando hay ejecutivo real

**Files:**
- Modify: `app/lib/quotes/notify.js:65-95`
- Test: `app/lib/quotes/notify.test.js`

**Interfaces:**
- Consumes: `managerFor` (Task 2), `buildAdvisorEmail` con `managerEmail` (Task 3).
- Produces: `notifyQuoteSubmitted(env, params, deps)` acepta `deps.managerFor` para inyección. El valor de retorno no cambia.

**Regla clave:** el manager se busca con `advisorEmail` (el que devolvió Shopify, `null` si no hay), **nunca** con `advisorTo` (que ya trae el fallback a `ventas@`). Si la cotización cayó en el buzón genérico no hay ejecutivo y por tanto no hay a quién copiar.

- [ ] **Step 1: Write the failing tests**

Añadir a `app/lib/quotes/notify.test.js` un `describe` nuevo:

```js
describe('notifyQuoteSubmitted · copia al manager', () => {
  it('copia al manager cuando el cliente tiene ejecutivo asignado', async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    await notifyQuoteSubmitted(
      {},
      args(),
      {
        getCustomerAdvisor: async () => ({email: 'laura@generandoideas.com', fields: {}}),
        managerFor: () => 'antonio@generandoideas.com',
        sendEmail,
      },
    );
    const interno = sendEmail.mock.calls.find(
      ([, msg]) => msg.to === 'laura@generandoideas.com',
    );
    expect(interno[1].cc).toBe('antonio@generandoideas.com');
  });

  it('no copia a nadie cuando el ejecutivo no está en la matriz', async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    await notifyQuoteSubmitted(
      {},
      args(),
      {
        getCustomerAdvisor: async () => ({email: 'laura@generandoideas.com', fields: {}}),
        managerFor: () => null,
        sendEmail,
      },
    );
    const interno = sendEmail.mock.calls.find(
      ([, msg]) => msg.to === 'laura@generandoideas.com',
    );
    expect('cc' in interno[1]).toBe(false);
  });

  it('no busca manager cuando la cotización cae en el buzón de ventas', async () => {
    // Sin ejecutivo no hay a quién copiar, aunque ventas@ estuviera en la
    // matriz: el requisito es "si la cotización TIENE ejecutivo".
    const sendEmail = vi.fn().mockResolvedValue({});
    const managerFor = vi.fn().mockReturnValue('nadie@generandoideas.com');
    await notifyQuoteSubmitted(
      {},
      args(),
      {
        getCustomerAdvisor: async () => ({email: null, fields: {}}),
        managerFor,
        sendEmail,
      },
    );
    expect(managerFor).not.toHaveBeenCalled();
    const interno = sendEmail.mock.calls.find(
      ([, msg]) => msg.to === 'ventas@generandoideas.com',
    );
    expect('cc' in interno[1]).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/lib/quotes/notify.test.js`
Expected: FAIL — las dos primeras porque `cc` es `undefined`.

- [ ] **Step 3: Implement**

En `app/lib/quotes/notify.js`, añadir el import:

```js
import {managerFor as realManagerFor} from './managers.js';
```

Dentro de `notifyQuoteSubmitted`, junto a las otras `deps`:

```js
  const managerFor = deps.managerFor ?? realManagerFor;
```

Y después de resolver el destinatario:

```js
  const advisorEmail = await lookupAdvisorEmail(env, customerGid, getCustomerAdvisor);
  const advisorTo = resolveAdvisorRecipient(advisorEmail, env);
  // Sobre advisorEmail, no sobre advisorTo: advisorTo ya trae el fallback a
  // ventas@, y ese buzón no tiene manager que copiar.
  const managerEmail = advisorEmail ? managerFor(advisorEmail) : null;
```

En la llamada a `buildAdvisorEmail`, pasar `managerEmail`:

```js
    buildAdvisorEmail({advisorEmail: advisorTo, managerEmail, quote, user, items, invoiceUrl}),
```

Actualizar el JSDoc de `deps` para incluir `managerFor`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/lib/quotes/notify.test.js`
Expected: PASS, incluidas las pruebas existentes.

- [ ] **Step 5: Run the full suite and commit**

```bash
npm test
git add app/lib/quotes/notify.js app/lib/quotes/notify.test.js
git commit -m "feat(quotes): CC al manager sólo cuando hay ejecutivo asignado"
```

---

## FASE B — Esquema

### Task 5: Diez columnas nuevas en `users`

**Files:**
- Modify: `app/lib/db/migrate.js:88-100`
- Modify: `app/lib/auth/users.js:17-95`
- Test: `app/lib/db/migrate.perfilLegal.test.js` (crear)

**Interfaces:**
- Consumes: nada.
- Produces: `createUser(db, env, {…, position, area, heardAbout, location, esCliente, advisorHandle, privacyAcceptedAt, termsAcceptedAt, newsletterOptIn, newsletterOptInAt})`. `newsletterOptIn` es booleano en JS y se persiste como `0`/`1`. El objeto devuelto y `rowToUser` exponen los mismos campos en camelCase. Todos opcionales; ausentes se guardan como `NULL` (y `newsletter_opt_in` como `0`).

- [ ] **Step 1: Write the failing test**

Crear `app/lib/db/migrate.perfilLegal.test.js`:

```js
import {describe, it, expect} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from './migrate.js';

const NUEVAS = [
  'position',
  'area',
  'heard_about',
  'location',
  'es_cliente',
  'advisor_handle',
  'privacy_accepted_at',
  'terms_accepted_at',
  'newsletter_opt_in',
  'newsletter_opt_in_at',
];

async function columnas(db, tabla) {
  const res = await db.execute(`PRAGMA table_info(${tabla})`);
  return res.rows.map((r) => r.name);
}

describe('migración perfil + legal', () => {
  it('crea las diez columnas en una base nueva y es idempotente', async () => {
    const db = createClient({url: ':memory:'});
    await migrate(db);
    await migrate(db);

    const cols = await columnas(db, 'users');
    for (const c of NUEVAS) expect(cols).toContain(c);
  });

  it('las añade a una base preexistente sin perder datos', async () => {
    const db = createClient({url: ':memory:'});
    await db.execute(`CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL,
      password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL, session_version INTEGER NOT NULL DEFAULT 1,
      role TEXT NOT NULL DEFAULT 'quoter',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    await db.execute({
      sql: `INSERT INTO users (id,email,password_hash,password_salt,password_iterations,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?)`,
      args: ['u1', 'a@b.mx', 'h', 's', 1, '2026-01-01', '2026-01-01'],
    });

    await migrate(db);

    const cols = await columnas(db, 'users');
    for (const c of NUEVAS) expect(cols).toContain(c);

    // El usuario viejo sigue ahí, con las columnas nuevas vacías.
    const res = await db.execute(`SELECT email, position, newsletter_opt_in FROM users WHERE id='u1'`);
    expect(res.rows[0].email).toBe('a@b.mx');
    expect(res.rows[0].position).toBeNull();
    expect(res.rows[0].newsletter_opt_in).toBeNull();
  });
});
```

> `newsletter_opt_in` queda `NULL` en filas preexistentes (SQLite no rellena al añadir columna sin default). El código debe tratar `NULL` como "no suscrito"; por eso `rowToUser` normaliza con `Boolean(row.newsletter_opt_in)`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/lib/db/migrate.perfilLegal.test.js`
Expected: FAIL — `expected [ … ] to contain 'position'`.

- [ ] **Step 3: Implement the migration**

En `app/lib/db/migrate.js`, añadir el bloque de columnas en el `CREATE TABLE users` (para bases nuevas) — después de `needs TEXT,`:

```
    position             TEXT,
    area                 TEXT,
    heard_about          TEXT,
    location             TEXT,
    es_cliente           TEXT,
    advisor_handle       TEXT,
    privacy_accepted_at  TEXT,
    terms_accepted_at    TEXT,
    newsletter_opt_in    INTEGER,
    newsletter_opt_in_at TEXT,
```

Y en `migrate()`, junto a las llamadas existentes (para bases ya creadas):

```js
  for (const [col, tipo] of [
    ['position', 'TEXT'],
    ['area', 'TEXT'],
    ['heard_about', 'TEXT'],
    ['location', 'TEXT'],
    ['es_cliente', 'TEXT'],
    ['advisor_handle', 'TEXT'],
    ['privacy_accepted_at', 'TEXT'],
    ['terms_accepted_at', 'TEXT'],
    ['newsletter_opt_in', 'INTEGER'],
    ['newsletter_opt_in_at', 'TEXT'],
  ]) {
    await addColumnIfMissing(db, 'users', col, tipo);
  }
```

- [ ] **Step 4: Run the migration test to verify it passes**

Run: `npx vitest run app/lib/db/migrate.perfilLegal.test.js`
Expected: PASS.

- [ ] **Step 5: Extend the repository**

En `app/lib/auth/users.js`:

`rowToUser`, después de `needs`:

```js
    position: row.position ?? null,
    area: row.area ?? null,
    heardAbout: row.heard_about ?? null,
    location: row.location ?? null,
    esCliente: row.es_cliente ?? null,
    advisorHandle: row.advisor_handle ?? null,
    privacyAcceptedAt: row.privacy_accepted_at ?? null,
    termsAcceptedAt: row.terms_accepted_at ?? null,
    // NULL en filas anteriores a la columna: se lee como "no suscrito".
    newsletterOptIn: Boolean(row.newsletter_opt_in),
    newsletterOptInAt: row.newsletter_opt_in_at ?? null,
```

`SELECT_COLS`:

```js
const SELECT_COLS = `id, email, first_name, last_name, company, razon_social, phone, volume, needs, role,
  position, area, heard_about, location, es_cliente, advisor_handle,
  privacy_accepted_at, terms_accepted_at, newsletter_opt_in, newsletter_opt_in_at,
  shopify_customer_gid, session_version, email_verified_at, created_at, updated_at`;
```

`createUser`: añadir los diez al destructuring, al `INSERT` (columnas, diez `?` más) y al objeto devuelto. Para el booleano:

```js
        newsletterOptIn ? 1 : 0,
        newsletterOptInAt ?? null,
```

y en el retorno `newsletterOptIn: Boolean(newsletterOptIn)`.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS. `users.passwordRecord.test.js` y `quotes/repo.test.js` insertan filas a mano con columnas explícitas, así que no se ven afectadas.

- [ ] **Step 7: Commit**

```bash
git add app/lib/db/migrate.js app/lib/db/migrate.perfilLegal.test.js app/lib/auth/users.js
git commit -m "feat(db): columnas de perfil, consentimiento legal y newsletter"
```

---

## FASE C — La asignación sale del alta

### Task 6: `advisor-choice` devuelve el handle reclamado o `null`

**Files:**
- Modify: `app/lib/auth/advisor-choice.js`
- Test: `app/lib/auth/advisor-choice.test.js` (se reescribe)

**Interfaces:**
- Consumes: nada.
- Produces: `claimedAdvisorHandle({esCliente, advisor}) -> string|null`. `MARKETING_HANDLE` y `UNKNOWN_ADVISOR` siguen exportándose sin cambio (los usan `registro.jsx` y `signup-notify.js`).

**Por qué el rename:** la función deja de responder "a quién asigno" para responder "a quién dijo que conoce". `advisorHandleFromForm` describía lo primero; mantener el nombre haría que quien lo lea asuma que sigue asignando.

- [ ] **Step 1: Rewrite the test**

Reemplazar el contenido de `app/lib/auth/advisor-choice.test.js`:

```js
import {describe, it, expect} from 'vitest';
import {MARKETING_HANDLE, UNKNOWN_ADVISOR, claimedAdvisorHandle} from './advisor-choice.js';

describe('claimedAdvisorHandle', () => {
  it('devuelve el handle cuando un cliente existente señala a alguien', () => {
    expect(claimedAdvisorHandle({esCliente: 'si', advisor: 'ailine-gamboa'})).toBe(
      'ailine-gamboa',
    );
  });

  it('devuelve null cuando el cliente no conoce a su asesor', () => {
    expect(claimedAdvisorHandle({esCliente: 'si', advisor: UNKNOWN_ADVISOR})).toBeNull();
  });

  it('devuelve null cuando el cliente deja el select vacío', () => {
    expect(claimedAdvisorHandle({esCliente: 'si', advisor: ''})).toBeNull();
  });

  it('devuelve null cuando la persona todavía no es cliente', () => {
    expect(claimedAdvisorHandle({esCliente: 'no', advisor: 'ailine-gamboa'})).toBeNull();
  });

  it('devuelve null cuando la pregunta nunca se respondió', () => {
    expect(claimedAdvisorHandle({})).toBeNull();
  });

  it('nunca devuelve marketing como un reclamo del usuario', () => {
    // marketing es el entry de respaldo y jamás se ofrece en el select; que
    // llegue en el POST significa formulario manipulado, no una elección.
    expect(claimedAdvisorHandle({esCliente: 'si', advisor: MARKETING_HANDLE})).toBeNull();
  });

  it('recorta espacios del handle recibido', () => {
    expect(claimedAdvisorHandle({esCliente: 'si', advisor: '  laura-vega  '})).toBe(
      'laura-vega',
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/lib/auth/advisor-choice.test.js`
Expected: FAIL — `claimedAdvisorHandle is not a function`.

- [ ] **Step 3: Implement**

Reemplazar la función y su comentario de cabecera en `app/lib/auth/advisor-choice.js`:

```js
// Pura y sin dependencias: qué ejecutiva de venta dijo el usuario que le
// atiende. NO asigna nada — desde la reunión del lunes el alta deja al cliente
// sin asesor y marketing valida la asignación en el admin de Shopify.

/** Handle del entry de respaldo. Nunca se ofrece como opción en el select. */
export const MARKETING_HANDLE = 'marketing';

/** Valor centinela de la opción "No conozco a mi asesor asignado". */
export const UNKNOWN_ADVISOR = '__desconocido__';

/**
 * @param {{esCliente?: string, advisor?: string}} form
 * @returns {string|null} handle reclamado, o null si no reclamó a nadie
 */
export function claimedAdvisorHandle({esCliente, advisor} = {}) {
  if (esCliente !== 'si') return null;
  const handle = String(advisor ?? '').trim();
  if (!handle || handle === UNKNOWN_ADVISOR || handle === MARKETING_HANDLE) return null;
  return handle;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/lib/auth/advisor-choice.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`auth.signup.jsx` todavía importa el nombre viejo y romperá; se arregla en la Task 12. Commitear igual para mantener el paso atómico y anotarlo:

```bash
git add app/lib/auth/advisor-choice.js app/lib/auth/advisor-choice.test.js
git commit -m "refactor(auth): advisor-choice reporta el reclamo, ya no asigna"
```

---

### Task 7: `addCustomerTags` en el Admin API

**Files:**
- Modify: `app/lib/admin/operations.js` (al final, junto a `setCustomerAdvisor`)
- Test: `app/lib/admin/operations.test.js`

**Interfaces:**
- Consumes: `adminFetch`, `isStubMode` (ya importados en el archivo).
- Produces: `addCustomerTags(env, customerGid, tags) -> Promise<void>`. No-op cuando falta el gid, cuando `tags` está vacío o en modo stub. Lanza si Shopify devuelve `userErrors`, igual que `setCustomerAdvisor`.

- [ ] **Step 1: Write the failing tests**

Añadir a `app/lib/admin/operations.test.js`. Revisar primero cómo mockea `adminFetch` el archivo y seguir ese patrón; si mockea el módulo `./client.js`, usar la misma forma:

```js
describe('addCustomerTags', () => {
  it('etiqueta al customer con la mutación tagsAdd', async () => {
    adminFetch.mockResolvedValueOnce({tagsAdd: {userErrors: []}});
    await addCustomerTags({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://shopify/Customer/7', [
      'lead-pendiente',
    ]);
    const [, query, vars] = adminFetch.mock.calls[0];
    expect(query).toMatch(/tagsAdd/);
    expect(vars).toEqual({id: 'gid://shopify/Customer/7', tags: ['lead-pendiente']});
  });

  it('no llama al Admin API sin gid o sin etiquetas', async () => {
    await addCustomerTags({PRIVATE_ADMIN_API_TOKEN: 't'}, null, ['x']);
    await addCustomerTags({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://shopify/Customer/7', []);
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('lanza cuando Shopify devuelve userErrors', async () => {
    adminFetch.mockResolvedValueOnce({
      tagsAdd: {userErrors: [{field: 'tags', message: 'inválido'}]},
    });
    await expect(
      addCustomerTags({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://shopify/Customer/7', ['x']),
    ).rejects.toThrow(/addCustomerTags userErrors/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/lib/admin/operations.test.js`
Expected: FAIL — `addCustomerTags is not a function`.

- [ ] **Step 3: Implement**

Al final de `app/lib/admin/operations.js`:

```js
const CUSTOMER_TAGS_ADD = `
  mutation tagsAdd($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors { field message }
    }
  }
`;

/**
 * Añadir etiquetas a un customer. Es la forma en que el alta marca un lead como
 * pendiente de que marketing le asigne ejecutivo: marketing filtra por el tag
 * en el admin de Shopify. No-op sin gid, sin etiquetas o en modo stub.
 * Requiere write_customers.
 * @param {Record<string, any>} env
 * @param {string|null|undefined} customerGid
 * @param {string[]} tags
 * @returns {Promise<void>}
 */
export async function addCustomerTags(env, customerGid, tags) {
  if (!customerGid || !Array.isArray(tags) || tags.length === 0) return;
  if (isStubMode(env)) return;

  const data = await adminFetch(env, CUSTOMER_TAGS_ADD, {id: customerGid, tags});
  const result = data ? data.tagsAdd : null;
  if (result && result.userErrors && result.userErrors.length) {
    throw new Error(
      `addCustomerTags userErrors: ${result.userErrors.map((e) => e.message).join('; ')}`,
    );
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/lib/admin/operations.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/admin/operations.js app/lib/admin/operations.test.js
git commit -m "feat(admin): addCustomerTags para marcar leads pendientes"
```

---

### Task 8: `createCustomer` acepta el consentimiento de marketing

**Files:**
- Modify: `app/lib/admin/operations.js:50-90`
- Test: `app/lib/admin/operations.test.js`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `createCustomer(env, {email, firstName, lastName, newsletterOptIn})`. Cuando `newsletterOptIn` es truthy el `CustomerInput` lleva `emailMarketingConsent`. La rama de correo ya tomado (`isTakenError`) no lo aplica: ese customer ya existía y su consentimiento no es nuestro que sobrescribir.

- [ ] **Step 1: Write the failing tests**

```js
describe('createCustomer · consentimiento de marketing', () => {
  it('manda emailMarketingConsent cuando el usuario se suscribió', async () => {
    adminFetch.mockResolvedValueOnce({
      customerCreate: {customer: {id: 'gid://shopify/Customer/7'}, userErrors: []},
    });
    await createCustomer(
      {PRIVATE_ADMIN_API_TOKEN: 't'},
      {email: 'a@b.mx', newsletterOptIn: true},
    );
    const consent = adminFetch.mock.calls[0][2].input.emailMarketingConsent;
    expect(consent.marketingState).toBe('SUBSCRIBED');
    expect(consent.marketingOptInLevel).toBe('SINGLE_OPT_IN');
    expect(typeof consent.consentUpdatedAt).toBe('string');
  });

  it('omite emailMarketingConsent cuando no se suscribió', async () => {
    adminFetch.mockResolvedValueOnce({
      customerCreate: {customer: {id: 'gid://shopify/Customer/7'}, userErrors: []},
    });
    await createCustomer({PRIVATE_ADMIN_API_TOKEN: 't'}, {email: 'a@b.mx'});
    expect('emailMarketingConsent' in adminFetch.mock.calls[0][2].input).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/lib/admin/operations.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'marketingState')`.

- [ ] **Step 3: Implement**

```js
export async function createCustomer(env, {email, firstName, lastName, newsletterOptIn}) {
  const input = {email};
  if (firstName != null) input.firstName = firstName;
  if (lastName != null) input.lastName = lastName;
  if (newsletterOptIn) {
    // Espejo del alta al newsletter. La verdad vive en users.newsletter_opt_in;
    // esto es para que marketing pueda segmentar desde Shopify.
    input.emailMarketingConsent = {
      marketingState: 'SUBSCRIBED',
      marketingOptInLevel: 'SINGLE_OPT_IN',
      consentUpdatedAt: new Date().toISOString(),
    };
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/lib/admin/operations.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/admin/operations.js app/lib/admin/operations.test.js
git commit -m "feat(admin): espeja el alta al newsletter en el customer de Shopify"
```

---

### Task 9: El alta etiqueta en vez de asignar

**Files:**
- Modify: `app/lib/auth/signup-link.js`
- Test: `app/lib/auth/signup-link.test.js`

**Interfaces:**
- Consumes: `addCustomerTags` (Task 7), `createCustomer` con `newsletterOptIn` (Task 8).
- Produces: `linkSignupCustomer(db, env, user, {newsletterOptIn = false} = {}) -> Promise<string|null>` y `export const LEAD_PENDING_TAG = 'lead-pendiente'`. **Ya no recibe `advisorHandle`** y ya no llama a `setCustomerAdvisor`.

**Nota:** `setCustomerAdvisor` y `resolveAdvisorGid` se conservan intactas en `operations.js`. Siguen siendo la operación que marketing replica a mano, y se reutilizan si algún día hay bandeja interna.

- [ ] **Step 1: Rewrite the test**

Reemplazar `app/lib/auth/signup-link.test.js`:

```js
import {describe, it, expect, vi, beforeEach} from 'vitest';

const createCustomer = vi.fn();
const setShopifyGid = vi.fn();
const addCustomerTags = vi.fn();
const setCustomerAdvisor = vi.fn();

vi.mock('../admin/operations.js', () => ({
  createCustomer: (...a) => createCustomer(...a),
  addCustomerTags: (...a) => addCustomerTags(...a),
  // Se mockea sólo para poder afirmar que NADIE la llama desde el alta.
  setCustomerAdvisor: (...a) => setCustomerAdvisor(...a),
}));
vi.mock('./users.js', () => ({
  setShopifyGid: (...a) => setShopifyGid(...a),
}));

import {linkSignupCustomer, LEAD_PENDING_TAG} from './signup-link.js';

const db = {__db: true};
const env = {PRIVATE_ADMIN_API_TOKEN: 't'};
const user = {id: 'u1', email: 'a@b.com', firstName: 'A', lastName: 'B'};

beforeEach(() => {
  createCustomer.mockReset();
  setShopifyGid.mockReset();
  addCustomerTags.mockReset();
  setCustomerAdvisor.mockReset();
  createCustomer.mockResolvedValue({gid: 'gid://shopify/Customer/7'});
  addCustomerTags.mockResolvedValue(undefined);
});

describe('linkSignupCustomer', () => {
  it('crea el customer, guarda el gid y lo devuelve', async () => {
    const gid = await linkSignupCustomer(db, env, user);
    expect(gid).toBe('gid://shopify/Customer/7');
    expect(setShopifyGid).toHaveBeenCalledWith(db, 'u1', 'gid://shopify/Customer/7');
  });

  it('etiqueta al customer como lead pendiente de asignación', async () => {
    await linkSignupCustomer(db, env, user);
    expect(addCustomerTags).toHaveBeenCalledWith(env, 'gid://shopify/Customer/7', [
      LEAD_PENDING_TAG,
    ]);
  });

  it('nunca asigna ejecutiva de venta en el alta', async () => {
    // La asignación la valida marketing en el admin. Si esta prueba falla es
    // que alguien volvió a cablear setCustomerAdvisor aquí.
    await linkSignupCustomer(db, env, user);
    expect(setCustomerAdvisor).not.toHaveBeenCalled();
  });

  it('propaga el alta al newsletter a createCustomer', async () => {
    await linkSignupCustomer(db, env, user, {newsletterOptIn: true});
    expect(createCustomer).toHaveBeenCalledWith(env, {
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      newsletterOptIn: true,
    });
  });

  it('no se suscribe por omisión', async () => {
    await linkSignupCustomer(db, env, user);
    expect(createCustomer.mock.calls[0][1].newsletterOptIn).toBe(false);
  });

  it('nunca lanza si Shopify falla (el alta debe sobrevivir)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createCustomer.mockRejectedValueOnce(new Error('admin down'));
    await expect(linkSignupCustomer(db, env, user)).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('devuelve el gid aunque el etiquetado falle', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    addCustomerTags.mockRejectedValueOnce(new Error('tags down'));
    await expect(linkSignupCustomer(db, env, user)).resolves.toBe(
      'gid://shopify/Customer/7',
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/lib/auth/signup-link.test.js`
Expected: FAIL — `LEAD_PENDING_TAG` no existe.

- [ ] **Step 3: Implement**

Reemplazar `app/lib/auth/signup-link.js`:

```js
import {addCustomerTags, createCustomer} from '../admin/operations.js';
import {setShopifyGid} from './users.js';

/**
 * Etiqueta con la que marketing filtra en el admin los registros que todavía
 * no tienen ejecutivo asignado.
 */
export const LEAD_PENDING_TAG = 'lead-pendiente';

/**
 * Crear el customer de Shopify para un alta recién hecha y guardar su gid.
 * Best-effort: un fallo de Shopify NO puede tumbar el alta; devuelve null y el
 * gid se reconcilia después (`reconcileShopifyCustomer`).
 *
 * **No asigna ejecutiva de venta.** Desde la reunión del lunes el customer
 * queda sin `custom.ejecutiva_de_venta` y con la etiqueta `lead-pendiente`;
 * marketing valida y asigna en el admin. Mientras tanto sus cotizaciones caen
 * en el buzón de ventas por el fallback de `quotes/notify.js`.
 *
 * @param {import('@libsql/client/web').Client} db
 * @param {Record<string, any>} env
 * @param {{id: string, email: string, firstName?: string, lastName?: string}} user
 * @param {{newsletterOptIn?: boolean}} [opciones]
 * @returns {Promise<string|null>}
 */
export async function linkSignupCustomer(db, env, user, {newsletterOptIn = false} = {}) {
  let gid;
  try {
    ({gid} = await createCustomer(env, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      newsletterOptIn,
    }));
    await setShopifyGid(db, user.id, gid);
  } catch (err) {
    console.warn(
      `[signup] Shopify customer link failed for user ${user.id}: ${
        err && err.message
      } — will reconcile later.`,
    );
    return null;
  }

  // El etiquetado es best-effort dentro del best-effort: un customer enlazado
  // sin etiqueta sigue siendo mejor que perder el enlace.
  try {
    await addCustomerTags(env, gid, [LEAD_PENDING_TAG]);
  } catch (err) {
    console.warn(
      `[signup] lead tag failed for user ${user.id}: ${
        err && err.message
      } — customer linked, tag manually in admin.`,
    );
  }

  return gid;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/lib/auth/signup-link.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/auth/signup-link.js app/lib/auth/signup-link.test.js
git commit -m "feat(auth): el alta etiqueta el lead en vez de asignar ejecutivo"
```

---

### Task 10: El correo a marketing muestra el reclamo

**Files:**
- Modify: `app/lib/auth/signup-advisor-email.js`
- Modify: `app/lib/auth/signup-notify.js`
- Test: `app/lib/auth/signup-advisor-email.test.js`, `app/lib/auth/signup-notify.test.js`

**Interfaces:**
- Consumes: `getAdvisorByHandle` (ya importado en `signup-notify.js`).
- Produces: `buildSignupAdvisorEmail({advisorTo, advisorName, user, customerAdminUrl, claimedAdvisor, esCliente})`. `claimedAdvisor` es el **nombre** del asesor reclamado (string) o `null`; `esCliente` es `'si'`, `'no'` o `null`. `notifyAdvisorOfSignup(env, {user}, deps)` lee `user.advisorHandle` y `user.esCliente`.

**Por qué resolver el nombre:** `users.advisor_handle` guarda `laura-vega`; marketing decide mejor leyendo "Laura Vega". `signup-notify.js` ya importa `getAdvisorByHandle`, así que no hay dependencia nueva. Si la consulta falla se cae al handle crudo — nunca al vacío.

- [ ] **Step 1: Write the failing tests**

En `app/lib/auth/signup-advisor-email.test.js`:

```js
describe('buildSignupAdvisorEmail · reclamo de asesor', () => {
  const base = {
    advisorTo: 'marketing@generandoideas.com',
    user: {email: 'ana@acme.mx', firstName: 'Ana', lastName: 'Pérez', company: 'Acme'},
    customerAdminUrl: null,
  };

  it('muestra el asesor que el usuario dijo tener', () => {
    const msg = buildSignupAdvisorEmail({...base, claimedAdvisor: 'Laura Vega', esCliente: 'si'});
    expect(msg.html).toContain('Laura Vega');
  });

  it('dice que ya es cliente cuando lo declaró', () => {
    const msg = buildSignupAdvisorEmail({...base, claimedAdvisor: null, esCliente: 'si'});
    expect(msg.html).toMatch(/Ya es cliente[\s\S]*Sí/);
  });

  it('dice que es nuevo cuando no se declaró cliente', () => {
    const msg = buildSignupAdvisorEmail({...base, claimedAdvisor: null, esCliente: 'no'});
    expect(msg.html).toMatch(/Ya es cliente[\s\S]*No/);
  });

  it('escapa el nombre del asesor reclamado', () => {
    const msg = buildSignupAdvisorEmail({
      ...base,
      claimedAdvisor: '<script>alert(1)</script>',
      esCliente: 'si',
    });
    expect(msg.html).not.toContain('<script>');
  });

  it('se sostiene sin reclamo ni respuesta', () => {
    const msg = buildSignupAdvisorEmail({...base, claimedAdvisor: null, esCliente: null});
    expect(msg.to).toBe('marketing@generandoideas.com');
    expect(msg.html).toContain('—');
  });
});
```

En `app/lib/auth/signup-notify.test.js`:

```js
describe('notifyAdvisorOfSignup · reclamo', () => {
  it('resuelve el handle reclamado a un nombre para el correo', async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    await notifyAdvisorOfSignup(
      {},
      {user: {email: 'ana@acme.mx', shopifyCustomerGid: null, advisorHandle: 'laura-vega', esCliente: 'si'}},
      {
        getCustomerAdvisor: async () => ({email: null, fields: {}}),
        getAdvisorByHandle: async (_env, handle) =>
          handle === 'laura-vega'
            ? {correo: 'laura@gi.com', nombre: 'Laura Vega'}
            : {correo: 'marketing@gi.com', nombre: 'Marketing'},
        sendEmail,
      },
    );
    expect(sendEmail.mock.calls[0][1].html).toContain('Laura Vega');
  });

  it('cae al handle crudo si no se puede resolver el nombre', async () => {
    const sendEmail = vi.fn().mockResolvedValue({});
    await notifyAdvisorOfSignup(
      {},
      {user: {email: 'ana@acme.mx', shopifyCustomerGid: null, advisorHandle: 'laura-vega', esCliente: 'si'}},
      {
        getCustomerAdvisor: async () => ({email: null, fields: {}}),
        getAdvisorByHandle: async (_env, handle) =>
          handle === 'laura-vega' ? null : {correo: 'marketing@gi.com', nombre: 'Marketing'},
        sendEmail,
      },
    );
    expect(sendEmail.mock.calls[0][1].html).toContain('laura-vega');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/lib/auth/signup-advisor-email.test.js app/lib/auth/signup-notify.test.js`
Expected: FAIL — el html no contiene "Laura Vega".

- [ ] **Step 3: Implement the builder**

En `app/lib/auth/signup-advisor-email.js`, añadir `claimedAdvisor` y `esCliente` al destructuring y al JSDoc, y añadir dos filas a la tabla:

```js
  const yaCliente = esCliente === 'si' ? 'Sí' : esCliente === 'no' ? 'No' : DASH;
```

```js
        <tbody>${row('Correo', user.email)}${row('Teléfono', user.phone)}${row('Empresa', user.company)}${row('Ya es cliente', yaCliente)}${row('Asesor que indicó', claimedAdvisor)}</tbody>
```

`row()` ya llama a `escapeHtml` y ya sustituye por `—` cuando el valor es vacío, así que las pruebas de escape y de ausencia pasan sin código extra.

Cambiar también la frase de apertura, que hoy afirma algo que ya no es cierto — el usuario no asignó a nadie:

```js
      <p><strong>${escapeHtml(quien)}</strong> creó una cuenta y está pendiente de que le asignen ejecutivo de venta.</p>
```

- [ ] **Step 4: Implement the resolution in signup-notify**

En `app/lib/auth/signup-notify.js`, dentro de `notifyAdvisorOfSignup`, antes de construir el mensaje:

```js
  // El handle sirve para filtrar, pero marketing decide mejor leyendo el
  // nombre. Best-effort: si no se resuelve, se manda el handle tal cual.
  let claimedAdvisor = null;
  if (user.advisorHandle) {
    claimedAdvisor = user.advisorHandle;
    try {
      const reclamado = await getAdvisorByHandle(env, user.advisorHandle);
      if (reclamado && reclamado.nombre) claimedAdvisor = reclamado.nombre;
    } catch (err) {
      console.error('[signup.notify] claimed advisor lookup failed:', err);
    }
  }
```

Y pasarlo al builder junto a `esCliente: user.esCliente ?? null`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run app/lib/auth/signup-advisor-email.test.js app/lib/auth/signup-notify.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/lib/auth/signup-advisor-email.js app/lib/auth/signup-advisor-email.test.js app/lib/auth/signup-notify.js app/lib/auth/signup-notify.test.js
git commit -m "feat(auth): el aviso a marketing muestra el asesor reclamado"
```

---

## FASE D — El registro

### Task 11: Catálogos y validación por paso

**Files:**
- Create: `app/routes/registro.catalogos.js`
- Modify: `app/routes/registro.validation.js`
- Test: `app/routes/registro.validation.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `AREAS`, `COMO_NOS_CONOCISTE`, `UBICACIONES` (arrays de string) y `esOpcionValida(valor, catalogo)`. `validateStep(step, form)` cubre ahora los pasos 1, 2 y **3**, y devuelve un objeto de errores con las claves: `name`, `lastName`, `email`, `password`, `phone`, `company`, `razonSocial`, `position`, `area`, `volume`, `esCliente`, `advisor`, `heardAbout`, `location`, `privacy`, `terms`.

**Reparto de pasos (contrato con la Task 12):**

| Paso | Campos validados |
| --- | --- |
| 1 | `name`, `lastName`, `email`, `password`, `phone` |
| 2 | `company`, `razonSocial`, `position`, `area`, `volume`, `esCliente`, `advisor` |
| 3 | `heardAbout`, `location`, `privacy`, `terms` |

- [ ] **Step 1: Write the failing tests**

Añadir a `app/routes/registro.validation.test.js`:

```js
import {AREAS, COMO_NOS_CONOCISTE, UBICACIONES} from './registro.catalogos.js';

const PASO1_OK = {
  name: 'Ana',
  lastName: 'Pérez',
  email: 'ana@acme.mx',
  password: 'secreto123',
  phone: '55 1234 5678',
};

const PASO2_OK = {
  company: 'Acme',
  razonSocial: 'Acme S.A. de C.V.',
  position: 'Compradora',
  area: AREAS[0],
  volume: 'Menos de $50,000 MXN',
  esCliente: 'no',
};

const PASO3_OK = {
  heardAbout: COMO_NOS_CONOCISTE[0],
  location: UBICACIONES[0],
  privacy: true,
  terms: true,
};

describe('validateStep · paso 1 con teléfono obligatorio', () => {
  it('acepta el paso completo', () => {
    expect(validateStep(1, PASO1_OK)).toEqual({});
  });

  it('exige teléfono', () => {
    expect(validateStep(1, {...PASO1_OK, phone: ''}).phone).toBeTruthy();
    expect(validateStep(1, {...PASO1_OK, phone: '   '}).phone).toBeTruthy();
  });
});

describe('validateStep · paso 2 con razón social, cargo y área', () => {
  it('acepta el paso completo', () => {
    expect(validateStep(2, PASO2_OK)).toEqual({});
  });

  it('exige razón social', () => {
    expect(validateStep(2, {...PASO2_OK, razonSocial: ''}).razonSocial).toBeTruthy();
  });

  it('exige cargo', () => {
    expect(validateStep(2, {...PASO2_OK, position: ''}).position).toBeTruthy();
  });

  it('exige un área del catálogo', () => {
    expect(validateStep(2, {...PASO2_OK, area: ''}).area).toBeTruthy();
    expect(validateStep(2, {...PASO2_OK, area: 'Inventada'}).area).toBeTruthy();
  });
});

describe('validateStep · paso 3', () => {
  it('acepta el paso completo', () => {
    expect(validateStep(3, PASO3_OK)).toEqual({});
  });

  it('exige saber cómo nos conoció, del catálogo', () => {
    expect(validateStep(3, {...PASO3_OK, heardAbout: ''}).heardAbout).toBeTruthy();
    expect(validateStep(3, {...PASO3_OK, heardAbout: 'Inventado'}).heardAbout).toBeTruthy();
  });

  it('exige ubicación, del catálogo', () => {
    expect(validateStep(3, {...PASO3_OK, location: ''}).location).toBeTruthy();
    expect(validateStep(3, {...PASO3_OK, location: 'Narnia'}).location).toBeTruthy();
  });

  it('exige aceptar el aviso de privacidad', () => {
    expect(validateStep(3, {...PASO3_OK, privacy: false}).privacy).toBeTruthy();
  });

  it('exige aceptar los términos', () => {
    expect(validateStep(3, {...PASO3_OK, terms: false}).terms).toBeTruthy();
  });

  it('no exige newsletter', () => {
    expect(validateStep(3, {...PASO3_OK, newsletter: false})).toEqual({});
  });
});

describe('catálogos', () => {
  it('ubicaciones trae los 32 estados más la opción de fuera de México', () => {
    expect(UBICACIONES).toHaveLength(33);
    expect(UBICACIONES).toContain('Fuera de México');
  });

  it('no hay opciones duplicadas ni vacías', () => {
    for (const cat of [AREAS, COMO_NOS_CONOCISTE, UBICACIONES]) {
      expect(new Set(cat).size).toBe(cat.length);
      for (const opcion of cat) expect(opcion.trim()).not.toBe('');
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/routes/registro.validation.test.js`
Expected: FAIL — no se resuelve `./registro.catalogos.js`.

- [ ] **Step 3: Create the catalogues**

Crear `app/routes/registro.catalogos.js`:

```js
// Catálogos del registro. Viven aparte porque los consumen dos lados: el
// formulario (para pintar los <option>) y la validación, que corre también en
// el servidor — así el servidor rechaza un valor fuera de catálogo sin tener
// que duplicar la lista.

export const AREAS = [
  'Compras',
  'Marketing',
  'Recursos Humanos',
  'Dirección',
  'Ventas',
  'Operaciones',
  'Otra',
];

export const COMO_NOS_CONOCISTE = [
  'Google o buscador',
  'Redes sociales',
  'Recomendación',
  'Feria o evento',
  'Me contactó un ejecutivo',
  'Otro',
];

export const UBICACIONES = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
  'Fuera de México',
];

/**
 * @param {string|null|undefined} valor
 * @param {string[]} catalogo
 * @returns {boolean}
 */
export function esOpcionValida(valor, catalogo) {
  return catalogo.includes(String(valor ?? '').trim());
}
```

- [ ] **Step 4: Extend the validation**

En `app/routes/registro.validation.js`, importar los catálogos y añadir las reglas:

```js
import {AREAS, COMO_NOS_CONOCISTE, UBICACIONES, esOpcionValida} from './registro.catalogos.js';
```

Al paso 1, después de la contraseña:

```js
    if (!String(form.phone ?? '').trim()) errores.phone = 'Ingresa tu teléfono.';
```

Al paso 2, después de `company`:

```js
    if (!String(form.razonSocial ?? '').trim()) {
      errores.razonSocial = 'Ingresa la razón social.';
    }
    if (!String(form.position ?? '').trim()) errores.position = 'Ingresa tu cargo.';
    if (!esOpcionValida(form.area, AREAS)) errores.area = 'Selecciona tu área.';
```

Y un bloque nuevo para el paso 3:

```js
  if (step === 3) {
    if (!esOpcionValida(form.heardAbout, COMO_NOS_CONOCISTE)) {
      errores.heardAbout = 'Cuéntanos cómo nos conociste.';
    }
    if (!esOpcionValida(form.location, UBICACIONES)) {
      errores.location = 'Selecciona dónde te encuentras.';
    }
    if (!form.privacy) errores.privacy = 'Debes aceptar el aviso de privacidad.';
    if (!form.terms) errores.terms = 'Debes aceptar los términos y condiciones.';
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run app/routes/registro.validation.test.js`
Expected: PASS. **Las pruebas existentes del paso 1 y 2 van a fallar** porque sus objetos no traen `phone`, `razonSocial`, `position` ni `area`. Actualizarlas añadiendo esos campos: es el cambio de contrato que pidió la reunión, no una regresión.

- [ ] **Step 6: Commit**

```bash
git add app/routes/registro.catalogos.js app/routes/registro.validation.js app/routes/registro.validation.test.js
git commit -m "feat(registro): catálogos y validación de los campos nuevos"
```

---

### Task 12: El formulario

**Files:**
- Modify: `app/routes/registro.jsx`
- Test: `app/routes/registro.campos.test.jsx` (crear)

**Interfaces:**
- Consumes: catálogos y `validateStep` (Task 11).
- Produces: el POST del formulario incluye ahora los campos `position`, `area`, `heardAbout`, `location`, `privacy`, `terms` y `newsletter`. Los tres últimos viajan como `'1'` o `''`.

**Estado inicial de `form`:** añadir `position: ''`, `area: ''`, `heardAbout: ''`, `location: ''`, `privacy: false`, `terms: false`, `newsletter: false`. **Quitar la clave `terms` vieja del checkbox único** (se reemplaza por `privacy` + `terms` reales).

- [ ] **Step 1: Write the failing test**

Crear `app/routes/registro.campos.test.jsx`. Reutilizar los helpers de `registro.asesor.test.jsx` (leerlo primero para copiar `renderRegistro` e `irAPaso2` y extenderlos con los campos nuevos):

```jsx
// @vitest-environment jsdom
import {describe, it, expect, afterEach} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {render, screen, fireEvent, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import Registro from './registro.jsx';
import {AREAS, COMO_NOS_CONOCISTE, UBICACIONES} from './registro.catalogos.js';

afterEach(cleanup);

function renderRegistro() {
  const Stub = createRoutesStub([
    {path: '/registro', Component: Registro, loader: () => ({advisors: []})},
  ]);
  return render(<Stub initialEntries={['/registro']} />);
}

async function llenarPaso1() {
  renderRegistro();
  fireEvent.change(await screen.findByLabelText('Nombre'), {target: {value: 'Ana'}});
  fireEvent.change(screen.getByLabelText('Apellido'), {target: {value: 'Pérez'}});
  fireEvent.change(screen.getByLabelText('Correo corporativo'), {
    target: {value: 'ana@acme.mx'},
  });
  fireEvent.change(screen.getByLabelText('Contraseña'), {target: {value: 'secreto123'}});
}

describe('registro · campos obligatorios nuevos', () => {
  it('no avanza del paso 1 sin teléfono', async () => {
    await llenarPaso1();
    fireEvent.click(screen.getByRole('button', {name: /continuar/i}));
    expect(await screen.findByText('Ingresa tu teléfono.')).toBeInTheDocument();
    expect(screen.getByText(/paso 1\/3/)).toBeInTheDocument();
  });

  it('la razón social ya no se anuncia como opcional', async () => {
    await llenarPaso1();
    fireEvent.change(screen.getByLabelText('Teléfono'), {target: {value: '5512345678'}});
    fireEvent.click(screen.getByRole('button', {name: /continuar/i}));
    await screen.findByText(/paso 2\/3/);
    expect(screen.queryByLabelText(/Razón social \(opcional\)/)).toBeNull();
    expect(screen.getByLabelText('Razón social')).toBeInTheDocument();
  });

  it('el paso 2 pide cargo y área', async () => {
    await llenarPaso1();
    fireEvent.change(screen.getByLabelText('Teléfono'), {target: {value: '5512345678'}});
    fireEvent.click(screen.getByRole('button', {name: /continuar/i}));
    await screen.findByText(/paso 2\/3/);
    expect(screen.getByLabelText('Cargo')).toBeInTheDocument();
    const area = screen.getByLabelText('Área');
    for (const op of AREAS) expect(area).toHaveTextContent(op);
  });
});

describe('registro · paso 3', () => {
  async function irAPaso3() {
    await llenarPaso1();
    fireEvent.change(screen.getByLabelText('Teléfono'), {target: {value: '5512345678'}});
    fireEvent.click(screen.getByRole('button', {name: /continuar/i}));
    await screen.findByText(/paso 2\/3/);
    fireEvent.change(screen.getByLabelText('Empresa'), {target: {value: 'Acme'}});
    fireEvent.change(screen.getByLabelText('Razón social'), {
      target: {value: 'Acme S.A. de C.V.'},
    });
    fireEvent.change(screen.getByLabelText('Cargo'), {target: {value: 'Compradora'}});
    fireEvent.change(screen.getByLabelText('Área'), {target: {value: AREAS[0]}});
    fireEvent.change(screen.getByLabelText('Volumen mensual estimado'), {
      target: {value: 'Menos de $50,000 MXN'},
    });
    fireEvent.click(screen.getByLabelText('No, es mi primera vez'));
    fireEvent.click(screen.getByRole('button', {name: /continuar/i}));
    await screen.findByText(/paso 3\/3/);
  }

  it('ofrece los catálogos de origen y ubicación', async () => {
    await irAPaso3();
    const origen = screen.getByLabelText('¿Cómo nos conociste?');
    for (const op of COMO_NOS_CONOCISTE) expect(origen).toHaveTextContent(op);
    expect(screen.getByLabelText('¿Dónde te encuentras ubicado?')).toHaveTextContent(
      UBICACIONES[0],
    );
  });

  it('tiene dos aceptaciones legales separadas y un newsletter opcional', async () => {
    await irAPaso3();
    expect(screen.getByRole('checkbox', {name: /aviso de privacidad/i})).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: /términos y condiciones/i})).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: /novedades|newsletter/i})).not.toBeRequired();
  });

  it('bloquea el envío mientras falte una aceptación legal', async () => {
    await irAPaso3();
    fireEvent.change(screen.getByLabelText('¿Cómo nos conociste?'), {
      target: {value: COMO_NOS_CONOCISTE[0]},
    });
    fireEvent.change(screen.getByLabelText('¿Dónde te encuentras ubicado?'), {
      target: {value: UBICACIONES[0]},
    });
    fireEvent.click(screen.getByRole('checkbox', {name: /aviso de privacidad/i}));
    fireEvent.click(screen.getByRole('button', {name: /crear cuenta/i}));
    expect(
      await screen.findByText('Debes aceptar los términos y condiciones.'),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/routes/registro.campos.test.jsx`
Expected: FAIL — "Ingresa tu teléfono." no aparece.

- [ ] **Step 3: Implement the form**

En `app/routes/registro.jsx`:

1. Importar los catálogos y `ROUTES` (ya está importado).
2. Ampliar el estado inicial de `form` con las siete claves nuevas y quitar la vieja.
3. Añadir los espejos ocultos, junto a los existentes:

```jsx
          <input type="hidden" name="position" value={form.position} />
          <input type="hidden" name="area" value={form.area} />
          <input type="hidden" name="heardAbout" value={form.heardAbout} />
          <input type="hidden" name="location" value={form.location} />
          <input type="hidden" name="privacy" value={form.privacy ? '1' : ''} />
          <input type="hidden" name="terms" value={form.terms ? '1' : ''} />
          <input type="hidden" name="newsletter" value={form.newsletter ? '1' : ''} />
```

4. Paso 1: añadir `required` al input de teléfono y su `{errores.phone && …}` con el mismo patrón de `<span className="help-msg" role="alert">` que usan los demás.
5. Paso 2: cambiar el label a `Razón social` (sin "(opcional)"), sustituir el texto de ayuda por `Como aparece en tu constancia de situación fiscal.`, añadir `required`, y añadir dos campos nuevos antes del volumen — `Cargo` (input de texto) y `Área` (select sobre `AREAS`), cada uno con su bloque de error.
6. Paso 3: añadir los selects de `¿Cómo nos conociste?` (sobre `COMO_NOS_CONOCISTE`) y `¿Dónde te encuentras ubicado?` (sobre `UBICACIONES`) antes de la textarea, cada uno con su error.
7. Sustituir el checkbox único por los dos legales más el de newsletter (ver Task 13 para el detalle del bloque).
8. Validar el paso 3 al enviar. El botón de `step === 3` es `type="submit"`; añadir al `<Form>`:

```jsx
        <Form
          className="auth-form"
          method="post"
          onSubmit={(e) => {
            const errs = validateStep(3, form);
            if (Object.keys(errs).length > 0) {
              e.preventDefault();
              setErrores(errs);
            }
          }}
        >
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/routes/registro.campos.test.jsx`
Expected: PASS.

- [ ] **Step 5: Run the existing registro tests**

Run: `npx vitest run app/routes/registro.asesor.test.jsx app/routes/registro.continuar.test.jsx app/routes/registro.password-toggle.test.jsx`
Expected: `registro.asesor` y `registro.continuar` **fallan**: sus helpers avanzan de paso sin llenar teléfono, razón social, cargo ni área. Actualizar esos helpers añadiendo los campos nuevos. No cambiar lo que afirman — sólo lo que llenan para llegar ahí.

- [ ] **Step 6: Commit**

```bash
git add app/routes/registro.jsx app/routes/registro.campos.test.jsx app/routes/registro.asesor.test.jsx app/routes/registro.continuar.test.jsx
git commit -m "feat(registro): campos de perfil, aceptaciones legales y newsletter"
```

---

### Task 13: El bloque legal y el `action`

**Files:**
- Modify: `app/routes/registro.jsx` (bloque legal del paso 3)
- Modify: `app/routes/auth.signup.jsx`
- Test: `app/routes/auth.signup.action.test.js`

**Interfaces:**
- Consumes: `claimedAdvisorHandle` (Task 6), `createUser` ampliado (Task 5), `linkSignupCustomer` con opciones (Task 9).
- Produces: el `action` responde `400` con `{error}` si falta cualquiera de las dos aceptaciones, y persiste todo lo nuevo.

**El bloque legal en el paso 3** — tres checkboxes, los dos primeros obligatorios y el tercero separado por una línea para que no se lea como requisito:

```jsx
              <div style={{height: 1, background: 'var(--line)', margin: '16px 0 4px'}} />

              <label className="check-legal">
                <input
                  type="checkbox"
                  checked={form.privacy}
                  onChange={(e) => setField('privacy', e.target.checked)}
                />
                <span>
                  Acepto el{' '}
                  <a href={ROUTES.privacy} target="_blank" rel="noreferrer">
                    Aviso de privacidad
                  </a>
                  .
                </span>
              </label>
              {errores.privacy && (
                <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                  {errores.privacy}
                </span>
              )}

              <label className="check-legal">
                <input
                  type="checkbox"
                  checked={form.terms}
                  onChange={(e) => setField('terms', e.target.checked)}
                />
                <span>
                  Acepto los{' '}
                  <a href={ROUTES.terms} target="_blank" rel="noreferrer">
                    Términos y condiciones
                  </a>
                  .
                </span>
              </label>
              {errores.terms && (
                <span className="help-msg" role="alert" style={{color: 'var(--err)'}}>
                  {errores.terms}
                </span>
              )}

              <div style={{height: 1, background: 'var(--line)', margin: '12px 0 4px'}} />

              <label className="check-legal">
                <input
                  type="checkbox"
                  checked={form.newsletter}
                  onChange={(e) => setField('newsletter', e.target.checked)}
                />
                <span>Quiero recibir novedades y promociones de Generando Ideas.</span>
              </label>
```

Reutilizar los estilos en línea del checkbox actual (`display:flex`, `alignItems:'start'`, `gap:10`, `fontSize:13`, `color:'var(--ink-3)'`, `lineHeight:1.5`) definiéndolos una sola vez como constante local en vez de repetirlos tres veces.

**Nota sobre `required`:** los tres van SIN `required`. La validación es `validateStep(3, …)` en el `onSubmit` (Task 12) más el servidor; el atributo nativo daría un mensaje del navegador en inglés y sin control de estilo.

- [ ] **Step 1: Write the failing tests**

Reemplazar el contenido de `app/routes/auth.signup.action.test.js` conservando su andamiaje de mocks, y ajustando `signupRequest` para que por omisión mande las dos aceptaciones:

```js
function signupRequest(fields) {
  const body = new FormData();
  body.set('email', 'ana@empresa.mx');
  body.set('password', 'secreto123');
  body.set('privacy', '1');
  body.set('terms', '1');
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request('https://gi.test/registro', {method: 'POST', body});
}

/** Las opciones con que se llamó a linkSignupCustomer. */
function linkOptions() {
  return linkSignupCustomer.mock.calls[0][3];
}

/** El objeto que recibió createUser. */
function created() {
  return createUser.mock.calls[0][2];
}

describe('signup action · aceptaciones legales', () => {
  it('rechaza sin aviso de privacidad', async () => {
    const body = new FormData();
    body.set('email', 'ana@empresa.mx');
    body.set('password', 'secreto123');
    body.set('terms', '1');
    const res = await action({
      request: new Request('https://gi.test/registro', {method: 'POST', body}),
      context,
    });
    expect((await read(res)).status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rechaza sin términos', async () => {
    const body = new FormData();
    body.set('email', 'ana@empresa.mx');
    body.set('password', 'secreto123');
    body.set('privacy', '1');
    const res = await action({
      request: new Request('https://gi.test/registro', {method: 'POST', body}),
      context,
    });
    expect((await read(res)).status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('guarda la fecha de ambas aceptaciones', async () => {
    await action({request: signupRequest({}), context});
    expect(created().privacyAcceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(created().termsAcceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('signup action · perfil', () => {
  it('persiste los campos nuevos', async () => {
    await action({
      request: signupRequest({
        position: 'Compradora',
        area: 'Compras',
        heardAbout: 'Google o buscador',
        location: 'Jalisco',
        esCliente: 'no',
      }),
      context,
    });
    expect(created()).toMatchObject({
      position: 'Compradora',
      area: 'Compras',
      heardAbout: 'Google o buscador',
      location: 'Jalisco',
      esCliente: 'no',
    });
  });
});

describe('signup action · newsletter', () => {
  it('propaga la suscripción al enlace con Shopify', async () => {
    await action({request: signupRequest({newsletter: '1'}), context});
    expect(created().newsletterOptIn).toBe(true);
    expect(linkOptions()).toEqual({newsletterOptIn: true});
  });

  it('no suscribe cuando el check viene vacío', async () => {
    await action({request: signupRequest({}), context});
    expect(created().newsletterOptIn).toBe(false);
    expect(created().newsletterOptInAt).toBeNull();
  });
});

describe('signup action · reclamo de asesor', () => {
  it('guarda el handle reclamado sin asignarlo', async () => {
    await action({request: signupRequest({esCliente: 'si', advisor: 'laura-vega'}), context});
    expect(created().advisorHandle).toBe('laura-vega');
    // linkSignupCustomer ya no recibe handle alguno.
    expect(linkOptions()).toEqual({newsletterOptIn: false});
  });

  it('guarda null cuando el usuario no conoce a su asesor', async () => {
    await action({
      request: signupRequest({esCliente: 'si', advisor: '__desconocido__'}),
      context,
    });
    expect(created().advisorHandle).toBeNull();
    expect(created().esCliente).toBe('si');
  });

  it('guarda null cuando la persona no es cliente todavía', async () => {
    await action({request: signupRequest({esCliente: 'no'}), context});
    expect(created().advisorHandle).toBeNull();
  });
});
```

> **Cómo se lee el status.** `data()` devuelve un `DataWithResponseInit`, no un
> `Response`, porque el action se invoca directo y no pasa por el router. El
> repo ya resuelve esto en `app/routes/account.profile.password.test.js:65-69`;
> copiar ese helper al inicio del archivo y usar `(await read(res)).status` en
> vez de `res.init.status`:
>
> ```js
> async function read(res) {
>   if (res instanceof Response) return {status: res.status, body: await res.json()};
>   if (res?.init) return {status: res.init.status ?? 200, body: res.data};
>   return {status: 200, body: res};
> }
> ```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run app/routes/auth.signup.action.test.js`
Expected: FAIL — el action todavía importa `advisorHandleFromForm`, que ya no existe (Task 6).

- [ ] **Step 3: Implement the action**

En `app/routes/auth.signup.jsx`:

```js
import {claimedAdvisorHandle} from '~/lib/auth/advisor-choice';
```

```js
  const position = String(form.get('position') ?? '') || null;
  const area = String(form.get('area') ?? '') || null;
  const heardAbout = String(form.get('heardAbout') ?? '') || null;
  const location = String(form.get('location') ?? '') || null;
  const esCliente = String(form.get('esCliente') ?? '') || null;
  const newsletterOptIn = String(form.get('newsletter') ?? '') === '1';
  const privacyOk = String(form.get('privacy') ?? '') === '1';
  const termsOk = String(form.get('terms') ?? '') === '1';

  // El asesor viaja como handle y ya NO se asigna: marketing valida la
  // asignación en el admin. Aquí sólo se guarda lo que el usuario reclamó.
  const advisorHandle = claimedAdvisorHandle({
    esCliente: String(form.get('esCliente') ?? ''),
    advisor: String(form.get('advisor') ?? ''),
  });

  if (!email || password.length < 8) {
    return data({error: 'Correo y contraseña (mínimo 8 caracteres) son obligatorios.'}, {status: 400});
  }

  // El navegador ya lo valida, pero el action es la única puerta que cuenta:
  // hasta hoy el checkbox ni siquiera llegaba al servidor.
  if (!privacyOk || !termsOk) {
    return data(
      {error: 'Debes aceptar el aviso de privacidad y los términos y condiciones.'},
      {status: 400},
    );
  }

  const now = new Date().toISOString();
```

Pasar a `createUser` los diez campos nuevos (`privacyAcceptedAt: now`, `termsAcceptedAt: now`, `newsletterOptInAt: newsletterOptIn ? now : null`, y el resto tal cual), y cambiar la llamada al enlace:

```js
  const shopifyGid = await linkSignupCustomer(db, context.env, user, {newsletterOptIn});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run app/routes/auth.signup.action.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suite and commit**

```bash
npm test
git add app/routes/auth.signup.jsx app/routes/auth.signup.action.test.js app/routes/registro.jsx
git commit -m "feat(registro): valida aceptaciones en el servidor y guarda el reclamo"
```

---

## FASE E — Footer

### Task 14: Enlace a términos y condiciones

**Files:**
- Modify: `app/lib/site-content.js:87-96`
- Modify: `app/components/gi/Footer.jsx:70-85`
- Test: `app/components/gi/Footer.legal.test.jsx` (crear)

**Interfaces:**
- Consumes: nada.
- Produces: `ROUTES.terms === '/legal/terminos-y-condiciones.pdf'`.

**El PDF no existe todavía.** El enlace apunta a la ruta acordada y da 404 hasta que se suba a `public/legal/`. Es deliberado: el código no debe esperar al documento.

- [ ] **Step 1: Write the failing test**

Crear `app/components/gi/Footer.legal.test.jsx`:

```jsx
// @vitest-environment jsdom
import {describe, it, expect, afterEach} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {render, screen, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {GiFooter} from './Footer.jsx';
import {ROUTES} from '~/lib/site-content';

afterEach(cleanup);

function renderFooter() {
  const Stub = createRoutesStub([{path: '/', Component: GiFooter}]);
  return render(<Stub initialEntries={['/']} />);
}

describe('footer legal', () => {
  it('enlaza el aviso de privacidad', () => {
    renderFooter();
    expect(screen.getByRole('link', {name: 'Aviso de privacidad'})).toHaveAttribute(
      'href',
      ROUTES.privacy,
    );
  });

  it('enlaza los términos y condiciones', () => {
    renderFooter();
    expect(screen.getByRole('link', {name: 'Términos y condiciones'})).toHaveAttribute(
      'href',
      ROUTES.terms,
    );
  });

  it('ROUTES.terms apunta al PDF acordado', () => {
    expect(ROUTES.terms).toBe('/legal/terminos-y-condiciones.pdf');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/components/gi/Footer.legal.test.jsx`
Expected: FAIL — no hay link "Términos y condiciones".

- [ ] **Step 3: Implement**

En `app/lib/site-content.js`, junto a `privacy`:

```js
  terms: '/legal/terminos-y-condiciones.pdf',
```

En `app/components/gi/Footer.jsx`, después del `<li>` del aviso de privacidad:

```jsx
                <li>
                  <a href={ROUTES.terms} target="_blank" rel="noopener noreferrer">
                    Términos y condiciones
                  </a>
                </li>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/components/gi/Footer.legal.test.jsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite, lint and commit**

```bash
npm test
npm run lint
git add app/lib/site-content.js app/components/gi/Footer.jsx app/components/gi/Footer.legal.test.jsx
git commit -m "feat(footer): enlace a términos y condiciones"
```

---

## Verificación final

- [ ] `npm test` en verde.
- [ ] `npm run lint` sin errores nuevos.
- [ ] Revisar a mano que ningún módulo siga importando `advisorHandleFromForm`:
      `grep -rn "advisorHandleFromForm" app/` debe salir vacío.
- [ ] Revisar que `setCustomerAdvisor` sólo aparezca en `operations.js` y sus pruebas:
      `grep -rn "setCustomerAdvisor" app/`
- [ ] Confirmar que `MANAGERS` sigue vacío y anotarlo al entregar, para que nadie
      crea que el CC ya está activo.
