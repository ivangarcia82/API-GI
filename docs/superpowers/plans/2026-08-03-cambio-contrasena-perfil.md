# Cambio de contraseña en "Mi perfil" — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un usuario autenticado cambie su contraseña desde `/account/profile` sin pasar por el flujo de recuperación por correo.

**Architecture:** La ruta `/account/profile` gana un segundo formulario que apunta a la misma `action`, ramificado por método HTTP (`PUT` = perfil, `POST` = contraseña). El formulario de contraseña usa `useFetcher` para tener estado propio, porque `useActionData()` es uno solo por ruta. Tras escribir la contraseña nueva se re-emite la cookie con el `session_version` actualizado, de modo que el navegador actual siga dentro y los demás queden desconectados.

**Tech Stack:** Shopify Hydrogen 2026.4.2, React Router 7.14 (framework mode), libSQL/Turso, WebCrypto (PBKDF2-SHA256), Vitest 4.

## Global Constraints

- Mínimo de contraseña: **8 caracteres**, sin reglas adicionales. Igual que `/registro` y `/auth/reset`.
- Todos los mensajes de UI en español, con las cadenas exactas de la tabla de la Task 1.
- Toda acción que muta estado llama `assertSameOrigin(request)` primero.
- Ningún módulo bajo `app/lib/auth/` puede importarse desde componentes de cliente (son server-only).
- Los tests corren con `npm test` (Vitest, entorno `node`). Los archivos `*.test.js` junto a rutas NO se registran como rutas (ya está resuelto en `app/routes.js`).
- No se envía correo de aviso al cambiar la contraseña (fuera de alcance, decidido en el spec).

**Referencia:** `docs/superpowers/specs/2026-08-03-cambio-contrasena-perfil-design.md`

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `app/lib/auth/password-policy.js` (nuevo) | Reglas de contraseña que se resuelven comparando strings. Puro, sin DB. |
| `app/lib/auth/password-policy.test.js` (nuevo) | Un caso por regla. |
| `app/lib/auth/attempts.js` (nuevo) | `clientIp`, `recentFailures`, `recordAttempt`. Extraídos de `auth.login.jsx`. |
| `app/lib/auth/attempts.test.js` (nuevo) | Ventana de 15 min y conteo por email/IP contra SQLite en memoria. |
| `app/lib/auth/users.js` (modificar) | Agregar `getPasswordRecord(db, id)`. |
| `app/lib/auth/users.passwordRecord.test.js` (nuevo) | Verifica que el registro devuelto sirve para `verifyPassword`. |
| `app/routes/auth.login.jsx` (modificar) | Importar de `attempts.js` y `getPasswordRecord`. Sin cambio de comportamiento. |
| `app/routes/account.profile.jsx` (modificar) | Rama `POST` en la acción + sección "Seguridad" en la UI. |
| `app/routes/account.profile.password.test.js` (nuevo) | Prueba la rama `POST` de la acción con DB en memoria. |

**Nota de diseño respecto al spec:** el spec dibujó la sección "Seguridad" separada por un borde dentro de la misma tarjeta. En la implementación es una **segunda tarjeta `.acct-form`**. Razón: `.acct-content` ya es `flex-direction: column; gap: 24px` y `.acct-form` ya es una tarjeta con borde y padding, así que dos tarjetas se apilan correctamente sin CSS nuevo. La decisión aprobada —que el cambio de contraseña viva dentro de `/account/profile` y no en otra ruta— se respeta igual.

---

### Task 1: Reglas de contraseña (función pura)

**Files:**
- Create: `app/lib/auth/password-policy.js`
- Test: `app/lib/auth/password-policy.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `validatePasswordChange({current, next, confirm}) -> string | null`. Devuelve el mensaje de error en español, o `null` si las tres reglas pasan.

Reglas, en este orden exacto (el primer fallo gana):

| Condición | Mensaje devuelto |
|---|---|
| `next.length < 8` | `La contraseña debe tener al menos 8 caracteres.` |
| `next !== confirm` | `Las contraseñas no coinciden.` |
| `next === current` | `La nueva contraseña debe ser distinta a la actual.` |
| ninguna | `null` |

No valida que `current` sea correcta ni que esté vacía — eso lo decide `verifyPassword` en la Task 4.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/lib/auth/password-policy.test.js`:

```js
import {describe, it, expect} from 'vitest';
import {validatePasswordChange} from './password-policy.js';

describe('validatePasswordChange', () => {
  it('acepta una contraseña nueva válida', () => {
    expect(
      validatePasswordChange({
        current: 'viejaSegura1',
        next: 'nuevaSegura1',
        confirm: 'nuevaSegura1',
      }),
    ).toBeNull();
  });

  it('rechaza menos de 8 caracteres', () => {
    expect(
      validatePasswordChange({current: 'viejaSegura1', next: 'corta', confirm: 'corta'}),
    ).toBe('La contraseña debe tener al menos 8 caracteres.');
  });

  it('acepta exactamente 8 caracteres', () => {
    expect(
      validatePasswordChange({current: 'viejaSegura1', next: '12345678', confirm: '12345678'}),
    ).toBeNull();
  });

  it('rechaza cuando la confirmación no coincide', () => {
    expect(
      validatePasswordChange({
        current: 'viejaSegura1',
        next: 'nuevaSegura1',
        confirm: 'nuevaSegura2',
      }),
    ).toBe('Las contraseñas no coinciden.');
  });

  it('rechaza cuando la nueva es igual a la actual', () => {
    expect(
      validatePasswordChange({
        current: 'mismaClave1',
        next: 'mismaClave1',
        confirm: 'mismaClave1',
      }),
    ).toBe('La nueva contraseña debe ser distinta a la actual.');
  });

  it('reporta la longitud antes que la falta de coincidencia', () => {
    expect(
      validatePasswordChange({current: 'viejaSegura1', next: 'abc', confirm: 'xyz'}),
    ).toBe('La contraseña debe tener al menos 8 caracteres.');
  });

  it('trata entradas ausentes como cadena vacía y falla por longitud', () => {
    expect(validatePasswordChange({})).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/lib/auth/password-policy.test.js`
Expected: FAIL — `Failed to resolve import "./password-policy.js"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `app/lib/auth/password-policy.js`:

```js
// Reglas de contraseña que se resuelven comparando cadenas en memoria.
// Puro y sin dependencias para poder probarlo sin DOM ni base de datos.
// La corrección de la contraseña actual NO se decide aquí: eso lo resuelve
// verifyPassword contra el hash almacenado.

export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordChange({current, next, confirm} = {}) {
  const actual = String(current ?? '');
  const nueva = String(next ?? '');
  const confirmacion = String(confirm ?? '');

  if (nueva.length < MIN_PASSWORD_LENGTH) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (nueva !== confirmacion) {
    return 'Las contraseñas no coinciden.';
  }
  if (nueva === actual) {
    return 'La nueva contraseña debe ser distinta a la actual.';
  }
  return null;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run app/lib/auth/password-policy.test.js`
Expected: PASS — 7 passed.

- [ ] **Step 5: Commit**

```bash
git add app/lib/auth/password-policy.js app/lib/auth/password-policy.test.js
git commit -m "feat(auth): reglas puras para el cambio de contraseña"
```

---

### Task 2: Extraer el contador de intentos a un módulo propio

**Files:**
- Create: `app/lib/auth/attempts.js`
- Test: `app/lib/auth/attempts.test.js`
- Modify: `app/routes/auth.login.jsx:9-36` (borrar las constantes y las tres funciones locales), `app/routes/auth.login.jsx:1-7` (imports), `app/routes/auth.login.jsx:57` y `:89` y `:93` (usar los imports).

**Interfaces:**
- Consumes: nada.
- Produces:
  - `MAX_ATTEMPTS` → `8`
  - `WINDOW_MS` → `900000` (15 min)
  - `clientIp(request) -> string`
  - `recentFailures(db, email, ip) -> Promise<number>`
  - `recordAttempt(db, email, ip, success) -> Promise<void>`

Estas funciones se mueven **sin cambiar su comportamiento**. `auth.login.jsx` debe seguir haciendo exactamente lo mismo.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/lib/auth/attempts.test.js`:

```js
import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {clientIp, recentFailures, recordAttempt, MAX_ATTEMPTS, WINDOW_MS} from './attempts.js';

async function makeDb() {
  const db = createClient({url: ':memory:'});
  await migrate(db);
  return db;
}

describe('auth/attempts: clientIp', () => {
  it('prefiere CF-Connecting-IP', () => {
    const req = new Request('http://x/', {
      headers: {'CF-Connecting-IP': '1.1.1.1', 'X-Forwarded-For': '2.2.2.2'},
    });
    expect(clientIp(req)).toBe('1.1.1.1');
  });

  it('usa el primer valor de X-Forwarded-For cuando no hay CF-Connecting-IP', () => {
    const req = new Request('http://x/', {
      headers: {'X-Forwarded-For': '2.2.2.2, 3.3.3.3'},
    });
    expect(clientIp(req)).toBe('2.2.2.2');
  });

  it('cae a "unknown" sin encabezados', () => {
    expect(clientIp(new Request('http://x/'))).toBe('unknown');
  });
});

describe('auth/attempts: conteo', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('cuenta sólo los fallos', async () => {
    await recordAttempt(db, 'a@b.com', '1.1.1.1', false);
    await recordAttempt(db, 'a@b.com', '1.1.1.1', false);
    await recordAttempt(db, 'a@b.com', '1.1.1.1', true);
    expect(await recentFailures(db, 'a@b.com', '1.1.1.1')).toBe(2);
  });

  it('cuenta por email O por IP', async () => {
    await recordAttempt(db, 'otro@b.com', '1.1.1.1', false);
    await recordAttempt(db, 'a@b.com', '9.9.9.9', false);
    // Coincide por IP el primero, por email el segundo.
    expect(await recentFailures(db, 'a@b.com', '1.1.1.1')).toBe(2);
  });

  it('ignora fallos fuera de la ventana de 15 minutos', async () => {
    const viejo = new Date(Date.now() - WINDOW_MS - 60000).toISOString();
    await db.execute({
      sql: `INSERT INTO login_attempts (id, email, ip, success, created_at) VALUES (?, ?, ?, 0, ?)`,
      args: [crypto.randomUUID(), 'a@b.com', '1.1.1.1', viejo],
    });
    expect(await recentFailures(db, 'a@b.com', '1.1.1.1')).toBe(0);
  });

  it('expone el umbral usado por las rutas', () => {
    expect(MAX_ATTEMPTS).toBe(8);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/lib/auth/attempts.test.js`
Expected: FAIL — `Failed to resolve import "./attempts.js"`.

- [ ] **Step 3: Crear el módulo**

Crear `app/lib/auth/attempts.js` (el cuerpo se copia tal cual de `auth.login.jsx:9-36`):

```js
// Server-only. Contador de intentos fallidos, compartido por /auth/login y por
// el cambio de contraseña en /account/profile. El filtro es `email OR ip`: es la
// misma credencial en ambos flujos, así que fallar en uno también frena el otro.

export const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
export const MAX_ATTEMPTS = 8; // por email O por IP dentro de la ventana

export function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
    'unknown'
  );
}

export async function recentFailures(db, email, ip) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const res = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM login_attempts
          WHERE success = 0 AND created_at >= ? AND (email = ? OR ip = ?)`,
    args: [since, email, ip],
  });
  return Number(res.rows[0]?.n ?? 0);
}

export async function recordAttempt(db, email, ip, success) {
  await db.execute({
    sql: `INSERT INTO login_attempts (id, email, ip, success, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), email, ip, success ? 1 : 0, new Date().toISOString()],
  });
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run app/lib/auth/attempts.test.js`
Expected: PASS — 7 passed.

- [ ] **Step 5: Hacer que `auth.login.jsx` use el módulo**

En `app/routes/auth.login.jsx`, **borrar** las líneas 9 a 36 (las constantes `WINDOW_MS`/`MAX_ATTEMPTS` y las funciones `clientIp`, `recentFailures`, `recordAttempt`) y agregar este import junto a los demás, después de `import {loginSession} ...`:

```js
import {clientIp, recentFailures, recordAttempt, MAX_ATTEMPTS} from '~/lib/auth/attempts';
```

El resto del archivo no cambia: `recentFailures(db, email, ip) >= MAX_ATTEMPTS`, `recordAttempt(db, email, ip, false)` y `recordAttempt(db, email, ip, true)` siguen llamándose igual.

- [ ] **Step 6: Correr la suite completa para verificar que no se rompió el login**

Run: `npm test`
Expected: PASS — todos los archivos verdes, ninguno menos que antes.

- [ ] **Step 7: Verificar el lint**

Run: `npx eslint app/lib/auth/attempts.js app/lib/auth/attempts.test.js app/routes/auth.login.jsx`
Expected: sin salida (código 0).

- [ ] **Step 8: Commit**

```bash
git add app/lib/auth/attempts.js app/lib/auth/attempts.test.js app/routes/auth.login.jsx
git commit -m "refactor(auth): extraer el contador de intentos a attempts.js"
```

---

### Task 3: `getPasswordRecord` en el repositorio de usuarios

**Files:**
- Modify: `app/lib/auth/users.js` (agregar la función al final)
- Modify: `app/routes/auth.login.jsx:69-79` (usar la función en vez del SELECT inline)
- Test: `app/lib/auth/users.passwordRecord.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `getPasswordRecord(db, id) -> Promise<{hash: string, salt: string, iterations: number} | null>`. Devuelve `null` si el usuario no existe. El objeto tiene exactamente la forma que `verifyPassword(plain, rec, env)` espera.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/lib/auth/users.passwordRecord.test.js`:

```js
import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {createUser, getPasswordRecord} from './users.js';
import {verifyPassword} from './password.js';

const ENV = {AUTH_PEPPER: 'test-pepper'};

async function makeDb() {
  const db = createClient({url: ':memory:'});
  await migrate(db);
  return db;
}

describe('users: getPasswordRecord', () => {
  let db;
  beforeEach(async () => {
    db = await makeDb();
  });

  it('devuelve un registro que verifica la contraseña correcta', async () => {
    const u = await createUser(db, ENV, {
      email: 'a@b.com',
      password: 'clavesegura1',
      role: 'quoter',
    });
    const rec = await getPasswordRecord(db, u.id);

    expect(typeof rec.hash).toBe('string');
    expect(typeof rec.salt).toBe('string');
    expect(Number.isInteger(rec.iterations)).toBe(true);
    expect(await verifyPassword('clavesegura1', rec, ENV)).toBe(true);
    expect(await verifyPassword('otraclave999', rec, ENV)).toBe(false);
  });

  it('devuelve null cuando el usuario no existe', async () => {
    expect(await getPasswordRecord(db, 'no-existe')).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/lib/auth/users.passwordRecord.test.js`
Expected: FAIL — `getPasswordRecord is not a function`.

- [ ] **Step 3: Implementar la función**

Agregar al final de `app/lib/auth/users.js`:

```js
// Lee las columnas secretas de la contraseña. Devuelve exactamente la forma que
// verifyPassword espera, o null si el usuario no existe. Vive aquí y no en las
// rutas para que todo el SQL de `users` quede en un solo lugar.
export async function getPasswordRecord(db, id) {
  const res = await db.execute({
    sql: `SELECT password_hash, password_salt, password_iterations FROM users WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0];
  if (!row) return null;
  return {
    hash: row.password_hash,
    salt: row.password_salt,
    iterations: Number(row.password_iterations),
  };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run app/lib/auth/users.passwordRecord.test.js`
Expected: PASS — 2 passed.

- [ ] **Step 5: Usar la función en `auth.login.jsx`**

En `app/routes/auth.login.jsx`, reemplazar el bloque que hoy hace el SELECT inline:

```js
    const secret = await db.execute({
      sql: `SELECT password_hash, password_salt, password_iterations FROM users WHERE id = ?`,
      args: [user.id],
    });
    const row = secret.rows[0];
    ok = await verifyPassword(password, {
      hash: row?.password_hash ?? '',
      salt: row?.password_salt ?? '',
      iterations: Number(row?.password_iterations ?? 100000),
    }, context.env);
```

por:

```js
    const rec = await getPasswordRecord(db, user.id);
    ok = await verifyPassword(
      password,
      rec ?? {hash: '', salt: '', iterations: 100000},
      context.env,
    );
```

Y agregar `getPasswordRecord` al import existente de `~/lib/auth/users`, que queda así:

```js
import {findByEmail, normalizeEmail, getPasswordRecord} from '~/lib/auth/users';
```

- [ ] **Step 6: Correr la suite completa**

Run: `npm test`
Expected: PASS — todo verde.

- [ ] **Step 7: Commit**

```bash
git add app/lib/auth/users.js app/lib/auth/users.passwordRecord.test.js app/routes/auth.login.jsx
git commit -m "refactor(auth): mover la lectura del hash a getPasswordRecord"
```

---

### Task 4: Rama `POST` en la acción de `/account/profile`

**Files:**
- Modify: `app/routes/account.profile.jsx:1-54` (imports y la función `action`)
- Test: `app/routes/account.profile.password.test.js`

**Interfaces:**
- Consumes: `validatePasswordChange` (Task 1), `clientIp`/`recentFailures`/`recordAttempt`/`MAX_ATTEMPTS` (Task 2), `getPasswordRecord` (Task 3).
- Produces: la acción responde a `POST` con `{error: string | null, passwordChanged: boolean}`. La rama `PUT` sigue devolviendo `{error, user}` sin cambios.

Orden obligatorio dentro de la rama `POST` (las validaciones puras van antes de `verifyPassword` para no gastar un PBKDF2 de 100 000 iteraciones en una petición ya inválida):

1. `requireUser(context)` → `userId`
2. `findById(db, userId)` → hace falta para el email (clave del contador) y para `role`/`gid` del re-login
3. `recentFailures(...) >= MAX_ATTEMPTS` → 429
4. `validatePasswordChange(...)` → 400
5. `getPasswordRecord` + `verifyPassword` → si falla: `recordAttempt(..., false)` + 401
6. `updatePassword(...)` → devuelve el `session_version` nuevo
7. `loginSession(...)` con ese `session_version`

**El paso 7 no es opcional.** `updatePassword` sube `session_version`, lo que invalida toda sesión cuya cookie tenga la versión vieja — incluida la del navegador que acaba de cambiarla. Sin ese re-login, `requireUser` expulsa al usuario a `/login` en la siguiente navegación.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/routes/account.profile.password.test.js`:

```js
import {describe, it, expect, beforeEach, vi} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '~/lib/db/migrate.js';
import {createUser, getPasswordRecord, findById} from '~/lib/auth/users.js';
import {verifyPassword} from '~/lib/auth/password.js';

// getDb crea un cliente HTTP contra Turso y exige una URL https://, así que no
// sirve en pruebas. Se sustituye por el cliente SQLite en memoria que arma cada
// caso. El mock se declara antes de importar la ruta (vi.mock se iza igual, pero
// el orden deja claro por qué el import de la acción va después).
let dbActual = null;
vi.mock('~/lib/db/client', () => ({
  getDb: () => dbActual,
}));

const {action} = await import('./account.profile.jsx');

const ENV = {AUTH_PEPPER: 'test-pepper'};

// Sesión mínima con la misma superficie que usa la ruta (get/set/unset).
function fakeSession(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    isPending: false,
    get: (k) => store.get(k),
    set: (k, v) => store.set(k, v),
    unset: (k) => store.delete(k),
  };
}

async function setup() {
  const db = createClient({url: ':memory:'});
  await migrate(db);
  dbActual = db; // lo que devolverá el getDb mockeado
  const user = await createUser(db, ENV, {
    email: 'a@b.com',
    password: 'claveactual1',
    role: 'quoter',
  });
  const session = fakeSession({
    gi_user: {userId: user.id, role: 'quoter', gid: null, sessionVersion: 1},
  });
  const context = {env: ENV, session};
  return {db, user, session, context};
}

function postRequest(fields) {
  const body = new URLSearchParams(fields);
  return new Request('http://localhost/account/profile', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
}

describe('account.profile action: cambio de contraseña', () => {
  let ctx;
  beforeEach(async () => {
    ctx = await setup();
  });

  it('cambia la contraseña y re-emite la sesión con el session_version nuevo', async () => {
    const res = await action({
      request: postRequest({
        currentPassword: 'claveactual1',
        newPassword: 'clavenueva22',
        confirmPassword: 'clavenueva22',
      }),
      context: ctx.context,
    });
    const payload = res.passwordChanged !== undefined ? res : await res.json();

    expect(payload.error).toBeNull();
    expect(payload.passwordChanged).toBe(true);

    // La contraseña nueva verifica y la vieja ya no.
    const rec = await getPasswordRecord(ctx.db, ctx.user.id);
    expect(await verifyPassword('clavenueva22', rec, ENV)).toBe(true);
    expect(await verifyPassword('claveactual1', rec, ENV)).toBe(false);

    // La cookie quedó sincronizada con la versión nueva de la base.
    const enBase = (await findById(ctx.db, ctx.user.id)).sessionVersion;
    expect(enBase).toBe(2);
    expect(ctx.session.get('gi_user').sessionVersion).toBe(enBase);
  });

  it('rechaza una contraseña actual incorrecta y no cambia nada', async () => {
    const res = await action({
      request: postRequest({
        currentPassword: 'equivocada99',
        newPassword: 'clavenueva22',
        confirmPassword: 'clavenueva22',
      }),
      context: ctx.context,
    });
    expect(res.status).toBe(401);
    const payload = await res.json();
    expect(payload.error).toBe('La contraseña actual es incorrecta.');

    const rec = await getPasswordRecord(ctx.db, ctx.user.id);
    expect(await verifyPassword('claveactual1', rec, ENV)).toBe(true);
    expect((await findById(ctx.db, ctx.user.id)).sessionVersion).toBe(1);
  });

  it('rechaza cuando la confirmación no coincide', async () => {
    const res = await action({
      request: postRequest({
        currentPassword: 'claveactual1',
        newPassword: 'clavenueva22',
        confirmPassword: 'clavedistinta9',
      }),
      context: ctx.context,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Las contraseñas no coinciden.');
  });

  it('bloquea con 429 tras superar el umbral de intentos', async () => {
    for (let i = 0; i < 8; i++) {
      await ctx.db.execute({
        sql: `INSERT INTO login_attempts (id, email, ip, success, created_at)
              VALUES (?, ?, ?, 0, ?)`,
        args: [crypto.randomUUID(), 'a@b.com', 'unknown', new Date().toISOString()],
      });
    }
    const res = await action({
      request: postRequest({
        currentPassword: 'claveactual1',
        newPassword: 'clavenueva22',
        confirmPassword: 'clavenueva22',
      }),
      context: ctx.context,
    });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe(
      'Demasiados intentos. Intenta de nuevo en unos minutos.',
    );
  });
});
```

> **Por qué `vi.mock` y no inyección por `env`:** `app/lib/db/client.js` valida que `TURSO_DATABASE_URL` empiece con `https://` y crea un cliente HTTP nuevo en cada llamada. Hacer que acepte una instancia inyectada obligaría a añadir una puerta trasera en código de producción sólo para las pruebas. El mock deja `client.js` intacto.

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/routes/account.profile.password.test.js`
Expected: FAIL — la acción responde 405 porque todavía rechaza todo lo que no es `PUT`.

- [ ] **Step 3: Reescribir la acción**

En `app/routes/account.profile.jsx`, reemplazar el bloque de imports (líneas 1-11) por:

```js
import {
  data,
  Form,
  useActionData,
  useFetcher,
  useNavigation,
  useOutletContext,
} from 'react-router';
import {useState} from 'react';
import {Icon} from '~/components/gi/Icon';
import {assertSameOrigin} from '~/lib/http/csrf';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {
  updateProfile,
  findById,
  getPasswordRecord,
  updatePassword,
} from '~/lib/auth/users';
import {verifyPassword} from '~/lib/auth/password';
import {validatePasswordChange} from '~/lib/auth/password-policy';
import {loginSession} from '~/lib/auth/session';
import {
  clientIp,
  recentFailures,
  recordAttempt,
  MAX_ATTEMPTS,
} from '~/lib/auth/attempts';
```

Y reemplazar la función `action` completa (líneas 31-54) por:

```js
/**
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  assertSameOrigin(request);

  const {userId} = await requireUser(context);
  const db = getDb(context.env);

  if (request.method === 'PUT') {
    return updateProfileAction({request, db, userId});
  }
  if (request.method === 'POST') {
    return changePasswordAction({request, context, db, userId});
  }
  return data({error: 'Method not allowed'}, {status: 405});
}

async function updateProfileAction({request, db, userId}) {
  const form = await request.formData();

  const firstName = String(form.get('firstName') ?? '') || null;
  const lastName = String(form.get('lastName') ?? '') || null;
  const company = String(form.get('company') ?? '') || null;
  const razonSocial = String(form.get('razonSocial') ?? '') || null;

  try {
    await updateProfile(db, userId, {firstName, lastName, company, razonSocial});
    const user = await findById(db, userId);
    return {error: null, user};
  } catch (error) {
    return data({error: error.message, user: null}, {status: 400});
  }
}

async function changePasswordAction({request, context, db, userId}) {
  const form = await request.formData();
  const current = String(form.get('currentPassword') ?? '');
  const next = String(form.get('newPassword') ?? '');
  const confirm = String(form.get('confirmPassword') ?? '');

  // La sesión sólo guarda el snapshot de la cookie; el correo (clave del
  // contador de intentos) y role/gid (para el re-login) vienen de la base.
  const user = await findById(db, userId);
  if (!user) {
    return data({error: 'Tu sesión ya no es válida.', passwordChanged: false}, {status: 401});
  }

  const ip = clientIp(request);
  if ((await recentFailures(db, user.email, ip)) >= MAX_ATTEMPTS) {
    return data(
      {error: 'Demasiados intentos. Intenta de nuevo en unos minutos.', passwordChanged: false},
      {status: 429},
    );
  }

  // Las reglas puras van primero: evitan un PBKDF2 de 100k iteraciones cuando
  // la petición ya es inválida por longitud, confirmación o repetición.
  const invalido = validatePasswordChange({current, next, confirm});
  if (invalido) {
    return data({error: invalido, passwordChanged: false}, {status: 400});
  }

  const rec = await getPasswordRecord(db, userId);
  const ok = rec ? await verifyPassword(current, rec, context.env) : false;
  if (!ok) {
    await recordAttempt(db, user.email, ip, false);
    return data(
      {error: 'La contraseña actual es incorrecta.', passwordChanged: false},
      {status: 401},
    );
  }

  // updatePassword sube session_version, lo que invalida TODA sesión con la
  // versión vieja — incluida esta. Re-emitir la cookie con la versión nueva es
  // lo que mantiene dentro a este navegador y deja fuera a los demás.
  const nuevaVersion = await updatePassword(db, context.env, userId, next);
  loginSession(context.session, {
    userId,
    role: user.role,
    gid: user.shopifyCustomerGid,
    sessionVersion: nuevaVersion,
  });

  return {error: null, passwordChanged: true};
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run app/routes/account.profile.password.test.js`
Expected: PASS — 4 passed.

- [ ] **Step 5: Correr la suite completa**

Run: `npm test`
Expected: PASS — todo verde.

- [ ] **Step 6: Commit**

```bash
git add app/routes/account.profile.jsx app/routes/account.profile.password.test.js
git commit -m "feat(account): acción de cambio de contraseña en Mi perfil"
```

---

### Task 5: Sección "Seguridad" en la interfaz

**Files:**
- Modify: `app/routes/account.profile.jsx` (el componente `AccountProfile` y un componente nuevo `PasswordField` en el mismo archivo)

**Interfaces:**
- Consumes: la rama `POST` de la Task 4, que devuelve `{error, passwordChanged}`.
- Produces: nada que consuman otras tareas.

El formulario de contraseña usa `useFetcher`, **no** `useActionData`. `useActionData()` es uno solo por ruta: si ambos formularios lo compartieran, guardar el perfil pintaría "Cambios guardados" dentro de la tarjeta de seguridad.

- [ ] **Step 1: Agregar el componente de campo con toggle**

Agregar en `app/routes/account.profile.jsx`, antes de `export default function AccountProfile()`:

```jsx
// Campo de contraseña con toggle de visibilidad. Mismo patrón que registro.jsx.
function PasswordField({id, name, label, autoComplete, help}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field acct-form-full">
      <label htmlFor={id}>{label}</label>
      <div style={{position: 'relative'}}>
        <input
          className="input"
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          minLength={8}
          required
          style={{paddingRight: 44}}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            color: 'var(--ink-3)',
          }}
        >
          <Icon name={visible ? 'eye_off' : 'eye'} size={18} />
        </button>
      </div>
      {help && <span className="help-msg">{help}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Agregar la tarjeta de Seguridad al componente**

En `AccountProfile`, agregar al inicio de la función, junto a los hooks existentes:

```jsx
  const pwFetcher = useFetcher();
  const pwBusy = pwFetcher.state !== 'idle';
  const pwChanged = pwFetcher.data?.passwordChanged === true;
```

Y agregar este bloque **después** del `</Form>` del formulario de perfil, todavía dentro del `<>…</>`:

```jsx
      <h2 style={{margin: '4px 0 -8px', fontSize: 18}}>Seguridad</h2>
      <pwFetcher.Form method="POST" className="acct-form" key={pwChanged ? 'ok' : 'edit'}>
        <div className="acct-form-grid">
          <PasswordField
            id="currentPassword"
            name="currentPassword"
            label="Contraseña actual"
            autoComplete="current-password"
          />
          <PasswordField
            id="newPassword"
            name="newPassword"
            label="Nueva contraseña"
            autoComplete="new-password"
            help="Mínimo 8 caracteres."
          />
          <PasswordField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirmar nueva contraseña"
            autoComplete="new-password"
          />
        </div>

        {pwFetcher.data?.error && (
          <p className="error-msg" role="alert">
            {pwFetcher.data.error}
          </p>
        )}
        {pwChanged && (
          <p className="help-msg" style={{color: 'var(--ok)'}} role="status">
            Contraseña actualizada. Cerramos la sesión en tus otros dispositivos.
          </p>
        )}

        <div className="acct-form-actions">
          <button type="submit" className="btn btn-accent" disabled={pwBusy}>
            {pwBusy ? 'Cambiando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </pwFetcher.Form>
```

El `key` que alterna entre `'edit'` y `'ok'` es lo que limpia los tres campos tras un cambio exitoso: cambiar la `key` hace que React remonte el formulario con los inputs vacíos, sin necesidad de estado controlado por campo.

- [ ] **Step 3: Verificar el lint y los tipos**

Run: `npx eslint app/routes/account.profile.jsx`
Expected: sin salida (código 0).

- [ ] **Step 4: Correr la suite completa**

Run: `npm test`
Expected: PASS — todo verde.

- [ ] **Step 5: Commit**

```bash
git add app/routes/account.profile.jsx
git commit -m "feat(account): sección Seguridad con cambio de contraseña"
```

---

### Task 6: Verificación manual en el navegador

**Files:** ninguno (sólo verificación).

Esta tarea existe porque el punto central del diseño —que el usuario **siga dentro** tras cambiar su contraseña— depende de que la cookie nueva llegue al navegador antes de que React Router revalide el loader de `account.jsx`. Ningún test unitario cubre ese acoplamiento.

- [ ] **Step 1: Crear un usuario de prueba**

```bash
export TURSO_DATABASE_URL="$(grep -m1 '^TURSO_DATABASE_URL=' .env | cut -d= -f2-)"
export TURSO_AUTH_TOKEN="$(grep -m1 '^TURSO_AUTH_TOKEN=' .env | cut -d= -f2-)"
export AUTH_PEPPER="$(grep -m1 '^AUTH_PEPPER=' .env | cut -d= -f2-)"
node scripts/create-user.mjs --email qa-pass@example.com --password 'claveinicial1' \
  --first-name QA --last-name Pass --no-shopify --force
```

> No uses `set -a; . ./.env` — el valor de `EMAIL_FROM` contiene `<...>` y zsh lo interpreta como redirección.

- [ ] **Step 2: Levantar el servidor**

Run: `npm run dev`
Expected: sirve en `http://localhost:3000`.

- [ ] **Step 3: Recorrer los seis casos**

Entrar a `http://localhost:3000/login` con `qa-pass@example.com` / `claveinicial1`, ir a **Mi perfil** y verificar en orden:

| # | Acción | Resultado esperado |
|---|---|---|
| 1 | Contraseña actual incorrecta | `La contraseña actual es incorrecta.` |
| 2 | Nueva y confirmación distintas | `Las contraseñas no coinciden.` |
| 3 | Nueva de 7 caracteres | `La contraseña debe tener al menos 8 caracteres.` |
| 4 | Nueva igual a la actual | `La nueva contraseña debe ser distinta a la actual.` |
| 5 | Cambio válido a `clavenueva22` | Mensaje de éxito, los 3 campos vacíos, y **al hacer clic en "Cotizaciones" el usuario sigue dentro** (no rebota a `/login`) |
| 6 | Cerrar sesión y volver a entrar | `clavenueva22` funciona; `claveinicial1` falla |

**El caso 5 es el que valida la decisión central.** Si rebota a `/login`, la cookie no llegó a tiempo: cambia el `return {error: null, passwordChanged: true}` de `changePasswordAction` por un `redirect('/account/profile')`, que fuerza al navegador a aplicar el `Set-Cookie` antes de la siguiente petición.

- [ ] **Step 4: Verificar que las otras sesiones sí mueren**

Con la sesión abierta en un segundo navegador (o ventana de incógnito) desde antes del cambio, navegar a `/account`.
Expected: redirige a `/login`.

- [ ] **Step 5: Limpiar el usuario de prueba**

`users` tiene claves foráneas desde `quotes`, `wishlist` y `email_tokens`; hay que borrar esas filas primero o el DELETE falla con `FOREIGN KEY constraint failed`.

```bash
node --input-type=module -e "
import {getDb} from './app/lib/db/client.js';
const db = getDb(process.env);
const EMAIL='qa-pass@example.com';
const u = await db.execute({sql:'SELECT id FROM users WHERE email = ?', args:[EMAIL]});
if (!u.rows.length) { console.log('ya no existe'); process.exit(0); }
const id = u.rows[0].id;
for (const t of ['wishlist','quotes','email_tokens']) {
  await db.execute({sql: \`DELETE FROM \${t} WHERE user_id = ?\`, args:[id]});
}
await db.execute({sql:'DELETE FROM login_attempts WHERE email = ?', args:[EMAIL]});
await db.execute({sql:'DELETE FROM users WHERE id = ?', args:[id]});
console.log('usuario QA eliminado');
"
```

- [ ] **Step 6: Commit final**

Si el caso 5 obligó a cambiar a `redirect`, commitear ese ajuste:

```bash
git add app/routes/account.profile.jsx
git commit -m "fix(account): redirigir tras el cambio para aplicar la cookie nueva"
```

Si no hubo cambios, no hay nada que commitear.

---

## Auto-revisión del plan

**Cobertura del spec:**

| Requisito del spec | Task |
|---|---|
| Dos formularios, un action, ramificado por método | 4 |
| `useFetcher` para separar el estado | 5 |
| Re-sincronizar la cookie con el `session_version` nuevo | 4 (paso 7 del orden), verificado en 6 |
| No replicar `session.destroy()` | 4 (no aparece en el código) |
| Validaciones puras antes de `verifyPassword` | 1, 4 |
| Los 6 mensajes exactos | 1 (tres), 4 (tres) |
| Contador compartido con el login | 2, 4 |
| Los intentos exitosos no se registran | 4 (sólo hay `recordAttempt(..., false)`) |
| `password-policy.js` + test | 1 |
| `attempts.js` + refactor de `auth.login.jsx` | 2 |
| `getPasswordRecord` + refactor de `auth.login.jsx` | 3 |
| Toggle de visibilidad, `autoComplete`, `minLength`, limpiar campos | 5 |
| Pruebas manuales en orden | 6 |

Sin huecos.

**Consistencia de nombres entre tareas:** `validatePasswordChange` (1) se llama igual en 4. `clientIp`/`recentFailures`/`recordAttempt`/`MAX_ATTEMPTS` (2) se usan con esos nombres en 4. `getPasswordRecord` (3) se usa en 3 y 4. Los campos del formulario `currentPassword`/`newPassword`/`confirmPassword` coinciden entre el test de la Task 4, la acción de la Task 4 y los `name` de la Task 5.

**Riesgo abierto y conocido:** el Step 3 de la Task 6. Si la cookie nueva no alcanza a aplicarse antes de que React Router revalide el loader de `account.jsx`, el usuario rebotará a `/login` justo después de un cambio exitoso. El plan incluye el remedio exacto (devolver `redirect('/account/profile')` en vez de `data`) y el caso de prueba que lo detecta. Es el único punto que ninguna prueba automatizada cubre, por el acoplamiento entre `Set-Cookie` y la revalidación del cliente.
