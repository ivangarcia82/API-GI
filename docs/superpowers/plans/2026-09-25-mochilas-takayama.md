# Mochilas Takayama — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Landing interna `/mochilas-takayama`, visible sólo para cuentas `@generandoideas.com`, que presenta las mochilas con tag `mochila-takayama`, deja elegir una (modelo + color) y manda la elección con los datos de entrega a igarcia@generandoideas.com.

**Architecture:** Una ruta de React Router (Hydrogen) con `loader` (puerta de colaborador + productos de Storefront) y `action` (validación + correo por Resend). La lógica pura vive en `app/lib/takayama/` (productos, validación, correo) y en `app/lib/auth/collaborator*.js` (dominio y puerta). El registro deja de crear customer en Shopify y de avisar a marketing cuando el correo es del dominio. Sin tablas nuevas.

**Tech Stack:** Hydrogen 2026.4 / React Router 7.14, libSQL (Turso) para usuarios, Storefront API, Resend vía `fetch`, GSAP (`~/lib/motion`), CSS plano con tokens de `gi-tokens.css`, Vitest (+ jsdom por archivo).

**Spec:** `docs/superpowers/specs/2026-09-25-mochilas-takayama-design.md`

## Global Constraints

- Ruta: `/mochilas-takayama`.
- Tag de productos: `mochila-takayama`.
- Dominio de colaboradores: exactamente `@generandoideas.com` (trim + minúsculas; sin subdominios, sin `generandoideas.com.mx`).
- Destinatario: `env.TAKAYAMA_EMAIL` con fallback `igarcia@generandoideas.com`; copia (`cc`) y `replyTo` al colaborador.
- Asunto: `Mochila Takayama – {Nombre} – {Modelo} / {Color}`.
- Sin precios en la landing. Se ocultan variantes sin inventario y productos sin variantes disponibles.
- Sin base de datos nueva; la elección sólo viaja por correo.
- Teléfono: 10 dígitos. CP: 5 dígitos.
- Todo valor del usuario en el correo pasa por `escapeHtml` (`~/lib/email/escape.js`).
- Copia visible al usuario en español de México, tono del sitio.
- Pruebas: `npm test` (vitest). Archivos de prueba co-localizados `*.test.js(x)`; los de componentes llevan `// @vitest-environment jsdom`.
- Mensajes de commit en español con prefijo convencional y el trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. Cuenta guardada con mayúsculas/espacios (`IGarcia@GenerandoIdeas.com `) → debe entrar. Prueba en Task 1.
2. Sesión caducada (cambio de contraseña sube `session_version`) → debe ir a `/login?redirectTo=/mochilas-takayama`, no a `/login` pelón. Prueba en Task 2.
3. `variantId` manipulado (variante de un producto sin el tag, o sin inventario) → 400 "Esa mochila ya no está disponible", no se manda correo. Prueba en Task 7.
4. Teléfono con espacios, guiones o `+52` (`+52 55 1234-5678`) → aceptado y normalizado a 10 dígitos. Prueba en Task 5.
5. Nombre con salto de línea o HTML (`Ana\n<b>x</b>`) → asunto en una sola línea, HTML escapado. Prueba en Task 6.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `app/lib/auth/collaborator.js` (nuevo) | `isCollaboratorEmail`, sin imports |
| `app/lib/auth/collaborator-guard.js` (nuevo) | `loadCollaborator(context, returnTo)` |
| `app/routes/auth.signup.jsx` (mod) | omitir `linkSignupCustomer` para colaboradores |
| `app/routes/auth.verify.jsx` (mod) | omitir `notifyAdvisorOfSignup` para colaboradores |
| `app/lib/takayama/products.js` (nuevo) | query, normalización, `findVariant`, `fetchTakayamaProducts` |
| `app/lib/takayama/validate.js` (nuevo) | `validateTakayamaRequest(form)` |
| `app/lib/takayama/email.js` (nuevo) | `buildTakayamaEmail`, `takayamaRecipient` |
| `app/routes/mochilas-takayama.jsx` (nuevo) | loader, action, meta, links, render |
| `app/components/takayama/TakayamaLanding.jsx` (nuevo) | hero, línea, grid, detalle |
| `app/components/takayama/TakayamaForm.jsx` (nuevo) | formulario + confirmación |
| `app/styles/gi-takayama.css` (nuevo) | estilos de la landing |
| `.env.example` (mod) | `TAKAYAMA_EMAIL` |

---

### Task 1: `isCollaboratorEmail`

**Files:**
- Create: `app/lib/auth/collaborator.js`
- Test: `app/lib/auth/collaborator.test.js`

**Interfaces:**
- Produces: `COLLABORATOR_DOMAIN: 'generandoideas.com'`, `isCollaboratorEmail(email: unknown): boolean`

- [ ] **Step 1: Write the failing test**

```js
// app/lib/auth/collaborator.test.js
import {describe, it, expect} from 'vitest';
import {isCollaboratorEmail, COLLABORATOR_DOMAIN} from './collaborator.js';

describe('isCollaboratorEmail', () => {
  it('acepta el dominio corporativo', () => {
    expect(COLLABORATOR_DOMAIN).toBe('generandoideas.com');
    expect(isCollaboratorEmail('igarcia@generandoideas.com')).toBe(true);
  });

  it('ignora mayúsculas y espacios', () => {
    expect(isCollaboratorEmail('  IGarcia@GenerandoIdeas.com ')).toBe(true);
  });

  it('rechaza otros dominios, subdominios y parecidos', () => {
    expect(isCollaboratorEmail('ana@empresa.mx')).toBe(false);
    expect(isCollaboratorEmail('ana@mail.generandoideas.com')).toBe(false);
    expect(isCollaboratorEmail('ana@generandoideas.com.mx')).toBe(false);
    expect(isCollaboratorEmail('ana@xgenerandoideas.com')).toBe(false);
    expect(isCollaboratorEmail('x@evil.com@generandoideas.com')).toBe(false);
  });

  it('rechaza vacíos', () => {
    expect(isCollaboratorEmail('')).toBe(false);
    expect(isCollaboratorEmail(null)).toBe(false);
    expect(isCollaboratorEmail(undefined)).toBe(false);
    expect(isCollaboratorEmail('@generandoideas.com')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/auth/collaborator.test.js`
Expected: FAIL — `Failed to resolve import "./collaborator.js"`.

- [ ] **Step 3: Write minimal implementation**

```js
// app/lib/auth/collaborator.js
// Colaboradores de Generando Ideas: cuentas cuyo correo es del dominio
// corporativo. Sin imports para que lo usen igual el registro que las páginas
// internas (y los scripts de Node, como roles.js).
export const COLLABORATOR_DOMAIN = 'generandoideas.com';

/**
 * @param {unknown} email
 * @returns {boolean} true sólo para `algo@generandoideas.com`, exacto
 */
export function isCollaboratorEmail(email) {
  const e = String(email ?? '').trim().toLowerCase();
  const at = e.indexOf('@');
  // Una sola arroba y algo antes de ella.
  if (at <= 0 || at !== e.lastIndexOf('@')) return false;
  return e.slice(at + 1) === COLLABORATOR_DOMAIN;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/auth/collaborator.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/auth/collaborator.js app/lib/auth/collaborator.test.js
git commit -m "feat(auth): reconoce el correo de colaborador de Generando Ideas

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Puerta `loadCollaborator`

**Files:**
- Create: `app/lib/auth/collaborator-guard.js`
- Test: `app/lib/auth/collaborator-guard.test.js`

**Interfaces:**
- Consumes: `isCollaboratorEmail` (Task 1); `getSessionUser(session)` de `./session.js`; `requireUser(context)` de `./guard.js` (lanza `redirect('/login')`); `findById(db, id)` de `./users.js` (devuelve `{id, email, firstName, lastName, ...}` o `null`); `getDb(env)` de `~/lib/db/client.js`.
- Produces: `loadCollaborator(context, returnTo: string): Promise<{user, allowed: boolean}>`. Lanza `redirect('/login?redirectTo=<returnTo codificado>')` si no hay sesión, si está caducada o si el usuario ya no existe.

- [ ] **Step 1: Write the failing test**

```js
// app/lib/auth/collaborator-guard.test.js
import {describe, it, expect, vi, beforeEach} from 'vitest';

const getSessionUser = vi.fn();
const requireUser = vi.fn();
const findById = vi.fn();

vi.mock('~/lib/auth/session', () => ({getSessionUser: (...a) => getSessionUser(...a)}));
vi.mock('~/lib/auth/guard', () => ({requireUser: (...a) => requireUser(...a)}));
vi.mock('~/lib/auth/users', () => ({findById: (...a) => findById(...a)}));
vi.mock('~/lib/db/client', () => ({getDb: () => ({__db: true})}));

import {loadCollaborator} from './collaborator-guard.js';

const context = {env: {}, session: {}};
const LOGIN = '/login?redirectTo=%2Fmochilas-takayama';

async function thrown(p) {
  try {
    await p;
  } catch (err) {
    return err;
  }
  throw new Error('esperaba que lanzara');
}

beforeEach(() => {
  getSessionUser.mockReset().mockReturnValue({userId: 'u1', sessionVersion: 1});
  requireUser.mockReset().mockResolvedValue({userId: 'u1', sessionVersion: 1});
  findById.mockReset().mockResolvedValue({id: 'u1', email: 'ana@generandoideas.com'});
});

describe('loadCollaborator', () => {
  it('sin sesión manda a login con regreso a la página', async () => {
    getSessionUser.mockReturnValue(null);
    const res = await thrown(loadCollaborator(context, '/mochilas-takayama'));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(LOGIN);
    expect(requireUser).not.toHaveBeenCalled();
  });

  it('sesión caducada también regresa a la página, no a /login pelón', async () => {
    requireUser.mockRejectedValue(new Response(null, {status: 302, headers: {Location: '/login'}}));
    const res = await thrown(loadCollaborator(context, '/mochilas-takayama'));
    expect(res.headers.get('Location')).toBe(LOGIN);
  });

  it('usuario borrado manda a login', async () => {
    findById.mockResolvedValue(null);
    const res = await thrown(loadCollaborator(context, '/mochilas-takayama'));
    expect(res.headers.get('Location')).toBe(LOGIN);
  });

  it('propaga errores que no son redirect', async () => {
    requireUser.mockRejectedValue(new Error('db caída'));
    const err = await thrown(loadCollaborator(context, '/mochilas-takayama'));
    expect(err.message).toBe('db caída');
  });

  it('colaborador: allowed true', async () => {
    const r = await loadCollaborator(context, '/mochilas-takayama');
    expect(r).toEqual({user: {id: 'u1', email: 'ana@generandoideas.com'}, allowed: true});
  });

  it('otro dominio: allowed false', async () => {
    findById.mockResolvedValue({id: 'u1', email: 'ana@empresa.mx'});
    const r = await loadCollaborator(context, '/mochilas-takayama');
    expect(r.allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/auth/collaborator-guard.test.js`
Expected: FAIL — no se resuelve `./collaborator-guard.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// app/lib/auth/collaborator-guard.js
// Server-only. Puerta de las páginas internas para colaboradores. A diferencia
// de requireUser, quien no tiene sesión vuelve a la página tras entrar: el aviso
// a los colaboradores lleva el enlace directo y no deben perderse en /account.
import {redirect} from 'react-router';
import {getSessionUser} from './session.js';
import {requireUser} from './guard.js';
import {findById} from './users.js';
import {getDb} from '~/lib/db/client.js';
import {isCollaboratorEmail} from './collaborator.js';

function loginFor(returnTo) {
  return `/login?redirectTo=${encodeURIComponent(returnTo)}`;
}

/**
 * @param {any} context  contexto de Hydrogen (session, env)
 * @param {string} returnTo  ruta interna a la que se vuelve tras el login
 * @returns {Promise<{user: any, allowed: boolean}>}
 */
export async function loadCollaborator(context, returnTo) {
  if (!getSessionUser(context.session)) throw redirect(loginFor(returnTo));

  let sessionUser;
  try {
    // Reutiliza la validación de session_version (y el borrado del cookie).
    sessionUser = await requireUser(context);
  } catch (err) {
    if (err instanceof Response && err.status >= 300 && err.status < 400) {
      throw redirect(loginFor(returnTo));
    }
    throw err;
  }

  const user = await findById(getDb(context.env), sessionUser.userId);
  if (!user) throw redirect(loginFor(returnTo));

  return {user, allowed: isCollaboratorEmail(user.email)};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/auth/collaborator-guard.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/auth/collaborator-guard.js app/lib/auth/collaborator-guard.test.js
git commit -m "feat(auth): puerta de páginas internas que regresa a la página tras el login

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: El registro de un colaborador no toca Shopify ni avisa a marketing

**Files:**
- Modify: `app/routes/auth.signup.jsx` (import + línea ~106 `const shopifyGid = await linkSignupCustomer(...)`)
- Modify: `app/routes/auth.verify.jsx` (import + bloque `const avisando = ...` en el action)
- Test: `app/routes/auth.signup.action.test.js` (agregar `describe`)
- Test: `app/routes/auth.verify.action.test.js` (agregar `describe`)

**Interfaces:**
- Consumes: `isCollaboratorEmail` (Task 1).

- [ ] **Step 1: Write the failing tests**

Al final de `app/routes/auth.signup.action.test.js` (usa `signupRequest`, `context`, `createUser`, `linkSignupCustomer` ya definidos en el archivo):

```js
describe('signup action · colaboradores', () => {
  it('no crea customer en Shopify para un correo @generandoideas.com', async () => {
    createUser.mockResolvedValue({id: 'u2', email: 'ana@generandoideas.com'});
    const res = await action({
      request: signupRequest({email: 'Ana@GenerandoIdeas.com'}),
      context,
    });
    expect(linkSignupCustomer).not.toHaveBeenCalled();
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/login?registrado=1');
  });

  it('sí lo crea para cualquier otro dominio', async () => {
    await action({request: signupRequest(), context});
    expect(linkSignupCustomer).toHaveBeenCalledTimes(1);
  });
});
```

Al final de `app/routes/auth.verify.action.test.js` (usa `verifyRequest`, `makeContext`, `findById`, `notifyAdvisorOfSignup`, `loginSession`, `USER`):

```js
describe('verify action · colaboradores', () => {
  it('no avisa a marketing ni a la ejecutiva por un colaborador', async () => {
    findById.mockResolvedValue({...USER, email: 'ana@generandoideas.com', shopifyCustomerGid: null});
    const context = makeContext();

    const res = await action({request: verifyRequest(), context});

    expect(notifyAdvisorOfSignup).not.toHaveBeenCalled();
    expect(context.waitUntil).not.toHaveBeenCalled();
    expect(loginSession).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(302);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run app/routes/auth.signup.action.test.js app/routes/auth.verify.action.test.js`
Expected: FAIL — `linkSignupCustomer` llamado 1 vez / `notifyAdvisorOfSignup` llamado.

- [ ] **Step 3: Implement**

En `app/routes/auth.signup.jsx`, agregar el import:

```js
import {isCollaboratorEmail} from '~/lib/auth/collaborator';
```

y reemplazar

```js
  const shopifyGid = await linkSignupCustomer(db, context.env, user, {newsletterOptIn});
  user.shopifyCustomerGid = shopifyGid;
```

por

```js
  // Un colaborador se registra para las páginas internas, no como lead: sin
  // customer en Shopify, marketing no lo ve con `lead-pendiente` por asignar.
  const shopifyGid = isCollaboratorEmail(email)
    ? null
    : await linkSignupCustomer(db, context.env, user, {newsletterOptIn});
  user.shopifyCustomerGid = shopifyGid;
```

En `app/routes/auth.verify.jsx`, agregar el import:

```js
import {isCollaboratorEmail} from '~/lib/auth/collaborator';
```

y envolver el aviso:

```js
    // Un colaborador no es un lead: nadie tiene que asignarlo.
    if (!isCollaboratorEmail(user.email)) {
      const avisando = Promise.resolve()
        .then(() => notifyAdvisorOfSignup(context.env, {user}))
        .catch((err) => {
          console.error('[verify] advisor notification failed:', err);
        });
      if (typeof context.waitUntil === 'function') context.waitUntil(avisando);
      else await avisando;
    }
```

(conservar el comentario existente encima del bloque).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/routes/auth.signup.action.test.js app/routes/auth.verify.action.test.js`
Expected: PASS (todas, incluidas las existentes).

- [ ] **Step 5: Commit**

```bash
git add app/routes/auth.signup.jsx app/routes/auth.verify.jsx app/routes/auth.signup.action.test.js app/routes/auth.verify.action.test.js
git commit -m "feat(registro): el colaborador se registra sin volverse lead en Shopify

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Productos Takayama

**Files:**
- Create: `app/lib/takayama/products.js`
- Test: `app/lib/takayama/products.test.js`

**Interfaces:**
- Produces:
  - `TAKAYAMA_TAG = 'mochila-takayama'`
  - `TAKAYAMA_PRODUCTS_QUERY` (string `#graphql`)
  - `modelName(title: string): string` — "MOCHILA TAKAYAMA TAKTIK TROLLEY MOC-TAT" → "Taktik Trolley"
  - `colorName(variantTitle: string): string` — "AZUL/NEGRO" → "Azul / Negro"
  - `tidyDescription(text: string): string`
  - `normalizeTakayamaProducts(nodes): TakayamaProduct[]` con `TakayamaProduct = {id, handle, name, description, variants: {id, color, image: string|null, imageAlt: string|null}[]}`
  - `findVariant(products, variantId): {product, variant} | null`
  - `fetchTakayamaProducts(storefront): Promise<TakayamaProduct[]>`

- [ ] **Step 1: Write the failing test**

```js
// app/lib/takayama/products.test.js
import {describe, it, expect, vi} from 'vitest';
import {
  TAKAYAMA_TAG,
  modelName,
  colorName,
  tidyDescription,
  normalizeTakayamaProducts,
  findVariant,
  fetchTakayamaProducts,
} from './products.js';

const img = (url) => ({url, altText: null});

function node(over = {}) {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'g4-moc-zen',
    title: 'MOCHILA TAKAYAMA ZEN MOC-ZEN',
    description: 'Mochila ligera.',
    tags: [TAKAYAMA_TAG, 'textil'],
    featuredImage: img('https://cdn/zen.png'),
    variants: {nodes: [{id: 'v1', title: 'NEGRO', availableForSale: true, image: null}]},
    ...over,
  };
}

describe('nombres', () => {
  it('limpia el título del modelo', () => {
    expect(modelName('MOCHILA TAKAYAMA ZEN MOC-ZEN')).toBe('Zen');
    expect(modelName('MOCHILA TAKAYAMA TAKTIK TROLLEY MOC-TAT')).toBe('Taktik Trolley');
    expect(modelName('MOCHILA TAKAYAMA ATOMIK DELUXE MOC-ATD')).toBe('Atomik Deluxe');
  });

  it('formatea colores compuestos', () => {
    expect(colorName('AZUL/NEGRO')).toBe('Azul / Negro');
    expect(colorName('NEGRO')).toBe('Negro');
  });

  it('separa oraciones pegadas en la descripción', () => {
    expect(tidyDescription('resistente al aguaFabricada con telas')).toBe(
      'resistente al agua. Fabricada con telas',
    );
  });
});

describe('normalizeTakayamaProducts', () => {
  it('normaliza y usa la imagen del producto si la variante no trae', () => {
    const [p] = normalizeTakayamaProducts([node()]);
    expect(p).toEqual({
      id: 'gid://shopify/Product/1',
      handle: 'g4-moc-zen',
      name: 'Zen',
      description: 'Mochila ligera.',
      variants: [{id: 'v1', color: 'Negro', image: 'https://cdn/zen.png', imageAlt: null}],
    });
  });

  it('prefiere la imagen de la variante', () => {
    const [p] = normalizeTakayamaProducts([
      node({variants: {nodes: [{id: 'v1', title: 'ROJO', availableForSale: true, image: img('https://cdn/rojo.png')}]}}),
    ]);
    expect(p.variants[0].image).toBe('https://cdn/rojo.png');
  });

  it('descarta variantes y productos sin inventario', () => {
    const out = normalizeTakayamaProducts([
      node({
        id: 'p1',
        variants: {
          nodes: [
            {id: 'a', title: 'AZUL/NEGRO', availableForSale: false, image: null},
            {id: 'b', title: 'GRIS/NEGRO', availableForSale: true, image: null},
          ],
        },
      }),
      node({id: 'p2', title: 'MOCHILA TAKAYAMA MAIKO MOC-MAI', variants: {nodes: [{id: 'c', title: 'GRIS', availableForSale: false, image: null}]}}),
    ]);
    expect(out.map((p) => p.id)).toEqual(['p1']);
    expect(out[0].variants.map((v) => v.id)).toEqual(['b']);
  });

  it('descarta productos que no traen el tag (la búsqueda puede colar otros)', () => {
    expect(normalizeTakayamaProducts([node({tags: ['textil']})])).toEqual([]);
  });

  it('ordena por nombre', () => {
    const out = normalizeTakayamaProducts([
      node({id: 'z', title: 'MOCHILA TAKAYAMA ZEN MOC-ZEN'}),
      node({id: 'a', title: 'MOCHILA TAKAYAMA EVO MOC-EVO'}),
    ]);
    expect(out.map((p) => p.name)).toEqual(['Evo', 'Zen']);
  });

  it('tolera null', () => {
    expect(normalizeTakayamaProducts(null)).toEqual([]);
  });
});

describe('findVariant', () => {
  const products = normalizeTakayamaProducts([node()]);
  it('encuentra la variante y su producto', () => {
    expect(findVariant(products, 'v1')).toMatchObject({product: {name: 'Zen'}, variant: {color: 'Negro'}});
  });
  it('null si no existe', () => {
    expect(findVariant(products, 'otra')).toBeNull();
  });
});

describe('fetchTakayamaProducts', () => {
  it('consulta por tag y normaliza', async () => {
    const storefront = {
      query: vi.fn().mockResolvedValue({products: {nodes: [node()]}}),
      CacheShort: () => 'short',
    };
    const out = await fetchTakayamaProducts(storefront);
    expect(storefront.query.mock.calls[0][1]).toEqual({
      variables: {query: 'tag:mochila-takayama'},
      cache: 'short',
    });
    expect(out).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/takayama/products.test.js`
Expected: FAIL — no se resuelve `./products.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// app/lib/takayama/products.js
// Catálogo de la landing interna de mochilas Takayama. Los productos se
// eligen por tag en Shopify; la búsqueda de Storefront no es del todo estricta
// con los tags (ver lib/filters.js), así que además se filtra aquí.
export const TAKAYAMA_TAG = 'mochila-takayama';

export const TAKAYAMA_PRODUCTS_QUERY = `#graphql
  query TakayamaProducts(
    $query: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    products(first: 50, query: $query) {
      nodes {
        id
        handle
        title
        description
        tags
        featuredImage { url altText }
        variants(first: 20) {
          nodes { id title availableForSale image { url altText } }
        }
      }
    }
  }
`;

function titleCase(s) {
  return String(s)
    .toLowerCase()
    .replace(/(^|[\s/])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
}

/** "MOCHILA TAKAYAMA ZEN MOC-ZEN" → "Zen" */
export function modelName(title) {
  const core = String(title ?? '')
    .trim()
    .replace(/^mochila\s+takayama\s+/i, '')
    .replace(/\s+moc-[a-z0-9]+$/i, '');
  return titleCase(core);
}

/** "AZUL/NEGRO" → "Azul / Negro" */
export function colorName(variantTitle) {
  return String(variantTitle ?? '')
    .split('/')
    .map((p) => titleCase(p.trim()))
    .filter(Boolean)
    .join(' / ');
}

/**
 * Las descripciones vienen de HTML aplanado: "aguaFabricada". Donde una
 * minúscula toca una mayúscula se separan como dos oraciones.
 */
export function tidyDescription(text) {
  return String(text ?? '').replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1. $2');
}

export function normalizeTakayamaProducts(nodes) {
  return (nodes ?? [])
    .filter((p) => (p.tags ?? []).includes(TAKAYAMA_TAG))
    .map((p) => {
      const fallback = p.featuredImage ?? null;
      const variants = (p.variants?.nodes ?? [])
        .filter((v) => v.availableForSale)
        .map((v) => {
          const image = v.image ?? fallback;
          return {
            id: v.id,
            color: colorName(v.title),
            image: image?.url ?? null,
            imageAlt: image?.altText ?? null,
          };
        });
      return {
        id: p.id,
        handle: p.handle,
        name: modelName(p.title),
        description: tidyDescription(p.description),
        variants,
      };
    })
    .filter((p) => p.variants.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export function findVariant(products, variantId) {
  for (const product of products) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return {product, variant};
  }
  return null;
}

export async function fetchTakayamaProducts(storefront) {
  const {products} = await storefront.query(TAKAYAMA_PRODUCTS_QUERY, {
    variables: {query: `tag:${TAKAYAMA_TAG}`},
    cache: storefront.CacheShort(),
  });
  return normalizeTakayamaProducts(products?.nodes);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/takayama/products.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/takayama/products.js app/lib/takayama/products.test.js
git commit -m "feat(takayama): catálogo de mochilas por tag, sin agotadas

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Validación del formulario

**Files:**
- Create: `app/lib/takayama/validate.js`
- Test: `app/lib/takayama/validate.test.js`

**Interfaces:**
- Produces: `validateTakayamaRequest(form: FormData)` →
  `{ok: true, values: {fullName, position, phone, variantId, foraneo: boolean, shipping: null | {street, neighborhood, zip, city, state, references, recipient}}}`
  o `{ok: false, errors: Record<string, string>}`.
  `phone` sale normalizado a 10 dígitos. Si `foraneo` es false, `shipping` es `null` aunque lleguen campos.

- [ ] **Step 1: Write the failing test**

```js
// app/lib/takayama/validate.test.js
import {describe, it, expect} from 'vitest';
import {validateTakayamaRequest} from './validate.js';

function form(fields) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const BASE = {
  fullName: 'Ana López',
  position: 'Diseño',
  phone: '5512345678',
  variantId: 'gid://shopify/ProductVariant/1',
  foraneo: 'no',
};

const SHIP = {
  street: 'Av. Juárez 10',
  neighborhood: 'Centro',
  zip: '44100',
  city: 'Guadalajara',
  state: 'Jalisco',
};

describe('validateTakayamaRequest · local', () => {
  it('acepta lo mínimo y no pide dirección', () => {
    const r = validateTakayamaRequest(form(BASE));
    expect(r).toEqual({
      ok: true,
      values: {...BASE, foraneo: false, shipping: null},
    });
  });

  it('ignora campos de envío si no es foráneo', () => {
    const r = validateTakayamaRequest(form({...BASE, ...SHIP}));
    expect(r.values.shipping).toBeNull();
  });

  it('marca los obligatorios que faltan', () => {
    const r = validateTakayamaRequest(form({}));
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(
      ['foraneo', 'fullName', 'phone', 'position', 'variantId'].sort(),
    );
  });

  it('recorta espacios', () => {
    const r = validateTakayamaRequest(form({...BASE, fullName: '  Ana López  '}));
    expect(r.values.fullName).toBe('Ana López');
  });
});

describe('validateTakayamaRequest · teléfono', () => {
  it.each(['55 1234 5678', '55-1234-5678', '+52 55 1234-5678', '525512345678'])(
    'normaliza %s',
    (phone) => {
      expect(validateTakayamaRequest(form({...BASE, phone})).values.phone).toBe('5512345678');
    },
  );

  it.each(['12345', '551234567890123', 'abc'])('rechaza %s', (phone) => {
    const r = validateTakayamaRequest(form({...BASE, phone}));
    expect(r.errors.phone).toBeTruthy();
  });
});

describe('validateTakayamaRequest · foráneo', () => {
  it('exige la dirección', () => {
    const r = validateTakayamaRequest(form({...BASE, foraneo: 'si'}));
    expect(Object.keys(r.errors).sort()).toEqual(
      ['city', 'neighborhood', 'state', 'street', 'zip'].sort(),
    );
  });

  it('valida el código postal', () => {
    const r = validateTakayamaRequest(form({...BASE, foraneo: 'si', ...SHIP, zip: '4410'}));
    expect(r.errors.zip).toBeTruthy();
  });

  it('acepta la dirección completa; referencias y quien recibe son opcionales', () => {
    const r = validateTakayamaRequest(form({...BASE, foraneo: 'si', ...SHIP}));
    expect(r.ok).toBe(true);
    expect(r.values.foraneo).toBe(true);
    expect(r.values.shipping).toEqual({...SHIP, references: '', recipient: ''});
  });

  it('rechaza un valor de foráneo fuera de catálogo', () => {
    const r = validateTakayamaRequest(form({...BASE, foraneo: 'tal vez'}));
    expect(r.errors.foraneo).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/takayama/validate.test.js`
Expected: FAIL — no se resuelve `./validate.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// app/lib/takayama/validate.js
// Validación del formulario de la mochila. El navegador ya valida, pero el
// action es la única puerta que cuenta.
const MAX = 200;

function field(form, name) {
  return String(form.get(name) ?? '').trim().slice(0, MAX);
}

/** Deja sólo dígitos y quita la lada de país 52 si viene. */
function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('52')) return digits.slice(2);
  return digits;
}

/**
 * @param {FormData} form
 */
export function validateTakayamaRequest(form) {
  const errors = {};

  const fullName = field(form, 'fullName');
  const position = field(form, 'position');
  const phone = normalizePhone(field(form, 'phone'));
  const variantId = field(form, 'variantId');
  const foraneoRaw = field(form, 'foraneo');

  if (!fullName) errors.fullName = 'Escribe tu nombre completo.';
  if (!position) errors.position = 'Escribe tu área o puesto.';
  if (phone.length !== 10) errors.phone = 'El teléfono debe tener 10 dígitos.';
  if (!variantId) errors.variantId = 'Elige una mochila.';
  if (foraneoRaw !== 'si' && foraneoRaw !== 'no') {
    errors.foraneo = 'Indica si eres foráneo.';
  }

  const foraneo = foraneoRaw === 'si';
  let shipping = null;
  if (foraneo) {
    shipping = {
      street: field(form, 'street'),
      neighborhood: field(form, 'neighborhood'),
      zip: field(form, 'zip'),
      city: field(form, 'city'),
      state: field(form, 'state'),
      references: field(form, 'references'),
      recipient: field(form, 'recipient'),
    };
    if (!shipping.street) errors.street = 'Escribe calle y número.';
    if (!shipping.neighborhood) errors.neighborhood = 'Escribe la colonia.';
    if (!/^\d{5}$/.test(shipping.zip)) errors.zip = 'El código postal debe tener 5 dígitos.';
    if (!shipping.city) errors.city = 'Escribe la ciudad.';
    if (!shipping.state) errors.state = 'Escribe el estado.';
  }

  if (Object.keys(errors).length > 0) return {ok: false, errors};
  return {ok: true, values: {fullName, position, phone, variantId, foraneo, shipping}};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/takayama/validate.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/takayama/validate.js app/lib/takayama/validate.test.js
git commit -m "feat(takayama): valida los datos de entrega y la rama foránea

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Correo de la elección

**Files:**
- Create: `app/lib/takayama/email.js`
- Test: `app/lib/takayama/email.test.js`

**Interfaces:**
- Consumes: `escapeHtml` de `~/lib/email/escape.js`; `values` de Task 5; `product`/`variant` de Task 4 (`product.name`, `variant.color`, `variant.image`).
- Produces:
  - `TAKAYAMA_DEFAULT_TO = 'igarcia@generandoideas.com'`
  - `takayamaRecipient(env): string`
  - `buildTakayamaEmail({email, values, product, variant}): {subject: string, html: string}`

- [ ] **Step 1: Write the failing test**

```js
// app/lib/takayama/email.test.js
import {describe, it, expect} from 'vitest';
import {buildTakayamaEmail, takayamaRecipient, TAKAYAMA_DEFAULT_TO} from './email.js';

const product = {name: 'Zen'};
const variant = {color: 'Azul / Negro', image: 'https://cdn/zen.png'};
const local = {
  fullName: 'Ana López',
  position: 'Diseño',
  phone: '5512345678',
  variantId: 'v1',
  foraneo: false,
  shipping: null,
};

function build(values = local) {
  return buildTakayamaEmail({email: 'ana@generandoideas.com', values, product, variant});
}

describe('takayamaRecipient', () => {
  it('usa TAKAYAMA_EMAIL o el default', () => {
    expect(TAKAYAMA_DEFAULT_TO).toBe('igarcia@generandoideas.com');
    expect(takayamaRecipient({})).toBe('igarcia@generandoideas.com');
    expect(takayamaRecipient({TAKAYAMA_EMAIL: 'otra@generandoideas.com'})).toBe(
      'otra@generandoideas.com',
    );
  });
});

describe('buildTakayamaEmail', () => {
  it('arma el asunto', () => {
    expect(build().subject).toBe('Mochila Takayama – Ana López – Zen / Azul / Negro');
  });

  it('incluye los datos y la entrega en oficina', () => {
    const {html} = build();
    expect(html).toContain('ana@generandoideas.com');
    expect(html).toContain('Diseño');
    expect(html).toContain('5512345678');
    expect(html).toContain('Entrega en oficina');
    expect(html).not.toContain('Código postal');
  });

  it('incluye la dirección si es foráneo', () => {
    const {html} = build({
      ...local,
      foraneo: true,
      shipping: {
        street: 'Av. Juárez 10',
        neighborhood: 'Centro',
        zip: '44100',
        city: 'Guadalajara',
        state: 'Jalisco',
        references: '',
        recipient: '',
      },
    });
    expect(html).toContain('Foráneo');
    expect(html).toContain('Av. Juárez 10');
    expect(html).toContain('44100');
    // Sin "quién recibe", recibe el colaborador.
    expect(html).toContain('Ana López');
  });

  it('asunto en una línea y HTML escapado', () => {
    const {subject, html} = build({...local, fullName: 'Ana\n<b>x</b>'});
    expect(subject).not.toMatch(/[\r\n]/);
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/takayama/email.test.js`
Expected: FAIL — no se resuelve `./email.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// app/lib/takayama/email.js
// Correo con la elección de mochila de un colaborador.
import {escapeHtml} from '~/lib/email/escape.js';

export const TAKAYAMA_DEFAULT_TO = 'igarcia@generandoideas.com';

export function takayamaRecipient(env) {
  return (env && env.TAKAYAMA_EMAIL) || TAKAYAMA_DEFAULT_TO;
}

function oneLine(s) {
  return String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function row(label, value) {
  return `<tr><td style="padding:6px 12px 6px 0;color:#636569;white-space:nowrap;vertical-align:top">${escapeHtml(
    label,
  )}</td><td style="padding:6px 0;color:#2e3033">${escapeHtml(value)}</td></tr>`;
}

/**
 * @param {{email: string, values: any, product: {name: string}, variant: {color: string, image?: string|null}}} args
 */
export function buildTakayamaEmail({email, values, product, variant}) {
  const subject = oneLine(
    `Mochila Takayama – ${values.fullName} – ${product.name} / ${variant.color}`,
  );

  const datos = [
    row('Nombre', values.fullName),
    row('Correo', email),
    row('Área / puesto', values.position),
    row('Teléfono', values.phone),
    row('Mochila', `${product.name} · ${variant.color}`),
    row('Entrega', values.foraneo ? 'Foráneo (envío)' : 'Entrega en oficina'),
  ].join('');

  const s = values.shipping;
  const envio =
    values.foraneo && s
      ? `<h3 style="font:600 16px sans-serif;margin:24px 0 8px">Datos de envío</h3><table>${[
          row('Calle y número', s.street),
          row('Colonia', s.neighborhood),
          row('Código postal', s.zip),
          row('Ciudad', s.city),
          row('Estado', s.state),
          ...(s.references ? [row('Referencias', s.references)] : []),
          row('Recibe', s.recipient || values.fullName),
        ].join('')}</table>`
      : '';

  const foto = variant.image
    ? `<img src="${escapeHtml(variant.image)}" alt="${escapeHtml(
        `${product.name} ${variant.color}`,
      )}" width="200" style="display:block;margin:0 0 16px;border-radius:12px">`
    : '';

  const html = `<div style="font:14px/1.5 sans-serif;color:#2e3033;max-width:560px">
<h2 style="font:700 20px sans-serif;margin:0 0 16px">Nueva elección de mochila Takayama</h2>
${foto}<table>${datos}</table>${envio}
</div>`;

  return {subject, html};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/takayama/email.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/takayama/email.js app/lib/takayama/email.test.js
git commit -m "feat(takayama): correo con la elección y los datos de entrega

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Ruta — loader y action

**Files:**
- Create: `app/routes/mochilas-takayama.jsx` (servidor + render mínimo; el render completo llega en Task 8)
- Test: `app/routes/mochilas-takayama.test.js`
- Modify: `.env.example` (agregar `TAKAYAMA_EMAIL`)

**Interfaces:**
- Consumes: `loadCollaborator` (Task 2), `fetchTakayamaProducts`, `findVariant` (Task 4), `validateTakayamaRequest` (Task 5), `buildTakayamaEmail`, `takayamaRecipient` (Task 6), `sendEmail(env, {to, subject, html, replyTo, cc})` de `~/lib/email/resend`, `assertSameOrigin` de `~/lib/http/csrf`.
- Produces (datos que consume la UI de Task 8):
  - loader permitido: `{denied: false, collaborator: {email, fullName}, products: TakayamaProduct[]}`
  - loader denegado: `{denied: true}` con status 403
  - action: `{ok: true, summary: {model, color, foraneo}}` | `{ok: false, errors}` (400) | `{ok: false, formError}` (403/502)

- [ ] **Step 1: Write the failing test**

```js
// app/routes/mochilas-takayama.test.js
import {describe, it, expect, vi, beforeEach} from 'vitest';

const loadCollaborator = vi.fn();
const sendEmail = vi.fn();

vi.mock('~/lib/http/csrf', () => ({assertSameOrigin: () => {}}));
vi.mock('~/lib/auth/collaborator-guard', () => ({
  loadCollaborator: (...a) => loadCollaborator(...a),
}));
vi.mock('~/lib/email/resend', () => ({sendEmail: (...a) => sendEmail(...a)}));

import {loader, action} from './mochilas-takayama.jsx';

async function read(res) {
  if (res instanceof Response) return {status: res.status, body: await res.json()};
  if (res?.init) return {status: res.init.status ?? 200, body: res.data, headers: res.init.headers};
  return {status: 200, body: res};
}

const NODE = {
  id: 'p1',
  handle: 'g4-moc-zen',
  title: 'MOCHILA TAKAYAMA ZEN MOC-ZEN',
  description: 'Ligera.',
  tags: ['mochila-takayama'],
  featuredImage: {url: 'https://cdn/zen.png', altText: null},
  variants: {
    nodes: [
      {id: 'v-ok', title: 'NEGRO', availableForSale: true, image: null},
      {id: 'v-agotada', title: 'ROJO', availableForSale: false, image: null},
    ],
  },
};

function makeContext() {
  return {
    env: {},
    session: {},
    storefront: {
      query: vi.fn().mockResolvedValue({products: {nodes: [NODE]}}),
      CacheShort: () => 'short',
    },
  };
}

function post(fields) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request('https://gi.test/mochilas-takayama', {method: 'POST', body});
}

const VALID = {
  fullName: 'Ana López',
  position: 'Diseño',
  phone: '5512345678',
  variantId: 'v-ok',
  foraneo: 'no',
};

beforeEach(() => {
  loadCollaborator.mockReset().mockResolvedValue({
    user: {id: 'u1', email: 'ana@generandoideas.com', firstName: 'Ana', lastName: 'López'},
    allowed: true,
  });
  sendEmail.mockReset().mockResolvedValue({stub: false, id: 'e1'});
});

describe('loader', () => {
  it('pide la puerta con regreso a esta página', async () => {
    await loader({context: makeContext()});
    expect(loadCollaborator.mock.calls[0][1]).toBe('/mochilas-takayama');
  });

  it('colaborador: productos y datos, sin caché', async () => {
    const r = await read(await loader({context: makeContext()}));
    expect(r.body.denied).toBe(false);
    expect(r.body.collaborator).toEqual({email: 'ana@generandoideas.com', fullName: 'Ana López'});
    expect(r.body.products.map((p) => p.name)).toEqual(['Zen']);
    expect(r.headers['Cache-Control']).toMatch(/no-store/);
  });

  it('otro dominio: 403 sin consultar productos', async () => {
    loadCollaborator.mockResolvedValue({user: {email: 'ana@empresa.mx'}, allowed: false});
    const context = makeContext();
    const r = await read(await loader({context}));
    expect(r.status).toBe(403);
    expect(r.body).toEqual({denied: true});
    expect(context.storefront.query).not.toHaveBeenCalled();
  });

  it('propaga el redirect a login', async () => {
    loadCollaborator.mockRejectedValue(new Response(null, {status: 302}));
    await expect(loader({context: makeContext()})).rejects.toMatchObject({status: 302});
  });
});

describe('action', () => {
  it('manda el correo a igarcia con copia al colaborador', async () => {
    const r = await read(await action({request: post(VALID), context: makeContext()}));
    expect(r.body).toEqual({ok: true, summary: {model: 'Zen', color: 'Negro', foraneo: false}});
    const [, msg] = sendEmail.mock.calls[0];
    expect(msg.to).toBe('igarcia@generandoideas.com');
    expect(msg.cc).toBe('ana@generandoideas.com');
    expect(msg.replyTo).toBe('ana@generandoideas.com');
    expect(msg.subject).toBe('Mochila Takayama – Ana López – Zen / Negro');
  });

  it('respeta TAKAYAMA_EMAIL', async () => {
    const context = makeContext();
    context.env.TAKAYAMA_EMAIL = 'rh@generandoideas.com';
    await action({request: post(VALID), context});
    expect(sendEmail.mock.calls[0][1].to).toBe('rh@generandoideas.com');
  });

  it('otro dominio: 403 sin correo', async () => {
    loadCollaborator.mockResolvedValue({user: {email: 'ana@empresa.mx'}, allowed: false});
    const r = await read(await action({request: post(VALID), context: makeContext()}));
    expect(r.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('datos inválidos: 400 con errores por campo', async () => {
    const r = await read(
      await action({request: post({...VALID, phone: '123'}), context: makeContext()}),
    );
    expect(r.status).toBe(400);
    expect(r.body.errors.phone).toBeTruthy();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each(['v-agotada', 'gid://shopify/ProductVariant/de-otro-producto'])(
    'variante no elegible (%s): 400 sin correo',
    async (variantId) => {
      const r = await read(
        await action({request: post({...VALID, variantId}), context: makeContext()}),
      );
      expect(r.status).toBe(400);
      expect(r.body.errors.variantId).toBe('Esa mochila ya no está disponible. Elige otra.');
      expect(sendEmail).not.toHaveBeenCalled();
    },
  );

  it('fallo de Resend: 502 con mensaje', async () => {
    sendEmail.mockRejectedValue(new Error('Resend API error (status 500)'));
    const r = await read(await action({request: post(VALID), context: makeContext()}));
    expect(r.status).toBe(502);
    expect(r.body.formError).toBe('No pudimos enviar tu elección, intenta de nuevo.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/routes/mochilas-takayama.test.js`
Expected: FAIL — no se resuelve `./mochilas-takayama.jsx`.

- [ ] **Step 3: Write minimal implementation**

```jsx
// app/routes/mochilas-takayama.jsx
// Landing interna: los colaboradores eligen su mochila Takayama (regalo del
// proveedor). Sólo cuentas @generandoideas.com; la elección se manda por
// correo, no se guarda.
import {data, useLoaderData} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';
import {loadCollaborator} from '~/lib/auth/collaborator-guard';
import {fetchTakayamaProducts, findVariant} from '~/lib/takayama/products';
import {validateTakayamaRequest} from '~/lib/takayama/validate';
import {buildTakayamaEmail, takayamaRecipient} from '~/lib/takayama/email';
import {sendEmail} from '~/lib/email/resend';

const PATH = '/mochilas-takayama';
const NO_STORE = {'Cache-Control': 'no-cache, no-store, must-revalidate'};

export const meta = () => [
  {title: 'Mochilas Takayama · Generando Ideas'},
  {name: 'robots', content: 'noindex, nofollow'},
];

/**
 * @param {import('./+types/mochilas-takayama').Route.LoaderArgs} args
 */
export async function loader({context}) {
  const {user, allowed} = await loadCollaborator(context, PATH);
  if (!allowed) return data({denied: true}, {status: 403, headers: NO_STORE});

  const products = await fetchTakayamaProducts(context.storefront);
  return data(
    {
      denied: false,
      collaborator: {
        email: user.email,
        fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
      },
      products,
    },
    {headers: NO_STORE},
  );
}

/**
 * @param {import('./+types/mochilas-takayama').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);
  const {user, allowed} = await loadCollaborator(context, PATH);
  if (!allowed) {
    return data(
      {ok: false, formError: 'Esta página es sólo para colaboradores de Generando Ideas.'},
      {status: 403},
    );
  }

  const result = validateTakayamaRequest(await request.formData());
  if (!result.ok) return data({ok: false, errors: result.errors}, {status: 400});

  // No se confía en el cliente: la variante debe seguir en el catálogo del tag
  // y con inventario al momento de enviar.
  const products = await fetchTakayamaProducts(context.storefront);
  const match = findVariant(products, result.values.variantId);
  if (!match) {
    return data(
      {ok: false, errors: {variantId: 'Esa mochila ya no está disponible. Elige otra.'}},
      {status: 400},
    );
  }

  const {subject, html} = buildTakayamaEmail({email: user.email, values: result.values, ...match});
  try {
    await sendEmail(context.env, {
      to: takayamaRecipient(context.env),
      cc: user.email,
      replyTo: user.email,
      subject,
      html,
    });
  } catch (err) {
    console.error('[takayama] send failed:', err);
    return data(
      {ok: false, formError: 'No pudimos enviar tu elección, intenta de nuevo.'},
      {status: 502},
    );
  }

  return data({
    ok: true,
    summary: {model: match.product.name, color: match.variant.color, foraneo: result.values.foraneo},
  });
}

export default function MochilasTakayama() {
  const loaderData = useLoaderData();
  if (loaderData.denied) return <p>Esta página es sólo para colaboradores de Generando Ideas.</p>;
  return <pre>{JSON.stringify(loaderData.products.map((p) => p.name))}</pre>;
}
```

En `.env.example`, debajo de `SALES_EMAIL=...`:

```
# Buzón que recibe las elecciones de mochila Takayama (default igarcia@generandoideas.com)
TAKAYAMA_EMAIL="igarcia@generandoideas.com"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/routes/mochilas-takayama.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routes/mochilas-takayama.jsx app/routes/mochilas-takayama.test.js .env.example
git commit -m "feat(takayama): ruta interna que valida y manda la elección por correo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: UI de la landing

**Files:**
- Create: `app/components/takayama/TakayamaForm.jsx`
- Create: `app/components/takayama/TakayamaLanding.jsx`
- Create: `app/styles/gi-takayama.css`
- Modify: `app/routes/mochilas-takayama.jsx` (import, `links`, componente por defecto)
- Test: `app/components/takayama/TakayamaForm.test.jsx`

**Interfaces:**
- Consumes: datos del loader/action de Task 7.
- Produces:
  - `TakayamaForm({products, collaborator, selectedVariantId, onSelectVariant})`
  - `TakayamaLanding({products, collaborator})` (default export)

- [ ] **Step 1: Write the failing test**

```jsx
// app/components/takayama/TakayamaForm.test.jsx
// @vitest-environment jsdom
import {describe, it, expect, afterEach, vi} from 'vitest';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {TakayamaForm} from './TakayamaForm.jsx';

const PRODUCTS = [
  {
    id: 'p1',
    handle: 'zen',
    name: 'Zen',
    description: '',
    variants: [{id: 'v1', color: 'Negro', image: null, imageAlt: null}],
  },
  {
    id: 'p2',
    handle: 'sack',
    name: 'Sack',
    description: '',
    variants: [
      {id: 'v2', color: 'Azul / Negro', image: null, imageAlt: null},
      {id: 'v3', color: 'Negro', image: null, imageAlt: null},
    ],
  },
];

function montar(props = {}) {
  const onSelectVariant = vi.fn();
  const Stub = createRoutesStub([
    {
      path: '/mochilas-takayama',
      Component: () => (
        <TakayamaForm
          products={PRODUCTS}
          collaborator={{email: 'ana@generandoideas.com', fullName: 'Ana López'}}
          selectedVariantId=""
          onSelectVariant={onSelectVariant}
          {...props}
        />
      ),
      action: () => ({ok: true}),
    },
  ]);
  render(<Stub initialEntries={['/mochilas-takayama']} />);
  return {onSelectVariant};
}

afterEach(cleanup);

describe('TakayamaForm', () => {
  it('prellena el nombre y muestra el correo sin dejarlo editar', () => {
    montar();
    expect(screen.getByLabelText('Nombre completo').value).toBe('Ana López');
    expect(screen.getByText('ana@generandoideas.com')).toBeTruthy();
    expect(screen.queryByLabelText('Correo')).toBeNull();
  });

  it('ofrece cada color como opción y avisa al elegir', () => {
    const {onSelectVariant} = montar();
    const select = screen.getByLabelText('Mochila');
    expect(select.querySelectorAll('option[value]:not([value=""])')).toHaveLength(3);
    fireEvent.change(select, {target: {value: 'v2'}});
    expect(onSelectVariant).toHaveBeenCalledWith('v2');
  });

  it('pide la dirección sólo si es foráneo', () => {
    montar();
    expect(screen.queryByLabelText('Código postal')).toBeNull();
    fireEvent.click(screen.getByLabelText('Sí, necesito envío'));
    expect(screen.getByLabelText('Código postal')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('No, recojo en oficina'));
    expect(screen.queryByLabelText('Código postal')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/components/takayama/TakayamaForm.test.jsx`
Expected: FAIL — no se resuelve `./TakayamaForm.jsx`.

- [ ] **Step 3: Implement the form**

```jsx
// app/components/takayama/TakayamaForm.jsx
import {useState} from 'react';
import {useFetcher} from 'react-router';

function Field({label, name, error, children, ...input}) {
  const id = `tk-${name}`;
  return (
    <div className={`tk-field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children ?? <input id={id} name={name} aria-invalid={error ? 'true' : undefined} {...input} />}
      {error ? <p className="tk-error">{error}</p> : null}
    </div>
  );
}

/**
 * @param {{products: any[], collaborator: {email: string, fullName: string},
 *   selectedVariantId: string, onSelectVariant: (id: string) => void}} props
 */
export function TakayamaForm({products, collaborator, selectedVariantId, onSelectVariant}) {
  const fetcher = useFetcher();
  const [foraneo, setForaneo] = useState('');
  const busy = fetcher.state !== 'idle';
  const result = fetcher.data;
  const errors = result?.errors ?? {};

  if (result?.ok) {
    const {model, color, foraneo: esForaneo} = result.summary;
    return (
      <div className="tk-done" role="status">
        <span className="eyebrow">Listo</span>
        <h3>¡Tu elección fue enviada!</h3>
        <p>
          Elegiste la <strong>{model}</strong> en <strong>{color}</strong>.{' '}
          {esForaneo
            ? 'Te la enviaremos a la dirección que registraste.'
            : 'Te avisaremos cuando puedas recogerla en la oficina.'}
        </p>
        <p className="tk-muted">Te mandamos una copia a {collaborator.email}.</p>
      </div>
    );
  }

  return (
    <fetcher.Form method="post" className="tk-form">
      {result?.formError ? (
        <p className="tk-form-error" role="alert">
          {result.formError}
        </p>
      ) : null}

      <Field label="Mochila" name="variantId" error={errors.variantId}>
        <select
          id="tk-variantId"
          name="variantId"
          required
          value={selectedVariantId}
          onChange={(e) => onSelectVariant(e.target.value)}
        >
          <option value="">Elige tu mochila…</option>
          {products.map((p) => (
            <optgroup key={p.id} label={p.name}>
              {p.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {p.name} · {v.color}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <div className="tk-grid-2">
        <Field
          label="Nombre completo"
          name="fullName"
          required
          autoComplete="name"
          defaultValue={collaborator.fullName}
          error={errors.fullName}
        />
        <div className="tk-field">
          <span className="tk-label">Correo</span>
          <p className="tk-static">{collaborator.email}</p>
        </div>
        <Field label="Área o puesto" name="position" required error={errors.position} />
        <Field
          label="Teléfono (WhatsApp)"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="10 dígitos"
          required
          error={errors.phone}
        />
      </div>

      <fieldset className="tk-field tk-choice">
        <legend>¿Eres foráneo?</legend>
        <label>
          <input
            type="radio"
            name="foraneo"
            value="no"
            required
            checked={foraneo === 'no'}
            onChange={() => setForaneo('no')}
          />
          No, recojo en oficina
        </label>
        <label>
          <input
            type="radio"
            name="foraneo"
            value="si"
            checked={foraneo === 'si'}
            onChange={() => setForaneo('si')}
          />
          Sí, necesito envío
        </label>
        {errors.foraneo ? <p className="tk-error">{errors.foraneo}</p> : null}
      </fieldset>

      {foraneo === 'si' ? (
        <div className="tk-shipping">
          <h4>Datos de envío</h4>
          <div className="tk-grid-2">
            <Field label="Calle y número" name="street" required autoComplete="address-line1" error={errors.street} />
            <Field label="Colonia" name="neighborhood" required error={errors.neighborhood} />
            <Field
              label="Código postal"
              name="zip"
              required
              inputMode="numeric"
              pattern="\d{5}"
              maxLength={5}
              autoComplete="postal-code"
              error={errors.zip}
            />
            <Field label="Ciudad" name="city" required autoComplete="address-level2" error={errors.city} />
            <Field label="Estado" name="state" required autoComplete="address-level1" error={errors.state} />
            <Field label="Quién recibe (opcional)" name="recipient" placeholder="Si no eres tú" />
          </div>
          <Field label="Referencias (opcional)" name="references" error={errors.references}>
            <textarea id="tk-references" name="references" rows={2} placeholder="Entre calles, color de fachada…" />
          </Field>
        </div>
      ) : null}

      <button type="submit" className="tk-submit" disabled={busy}>
        {busy ? 'Enviando…' : 'Enviar mi elección'}
      </button>
    </fetcher.Form>
  );
}
```

- [ ] **Step 4: Run the form test**

Run: `npx vitest run app/components/takayama/TakayamaForm.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the landing**

```jsx
// app/components/takayama/TakayamaLanding.jsx
import {useEffect, useRef, useState} from 'react';
import MarketingLayout from '~/components/marketing/MarketingLayout';
import {TakayamaForm} from './TakayamaForm.jsx';

const ATRIBUTOS = [
  {t: 'Repelentes al agua', d: 'Materiales de alta resistencia que protegen lo que llevas.'},
  {t: 'Telas balísticas', d: 'Tejidos pensados para el uso diario, sin perder forma.'},
  {t: 'Diseños anti-robo', d: 'Modelos con apertura trasera y compartimentos ocultos.'},
  {t: 'Listas para tu laptop', d: 'Compartimentos acolchados para equipo y accesorios.'},
];

function ModelCard({product, activeVariantId, onColor, onOpen, isChosen}) {
  const variant = product.variants.find((v) => v.id === activeVariantId) ?? product.variants[0];
  return (
    <article className={`tk-card${isChosen ? ' is-chosen' : ''}`} data-tk-card>
      <button type="button" className="tk-card-media" onClick={() => onOpen(product.id)}>
        {variant.image ? (
          <img
            src={variant.image}
            alt={variant.imageAlt ?? `${product.name} ${variant.color}`}
            loading="lazy"
            width="480"
            height="480"
          />
        ) : null}
        {isChosen ? <span className="tk-badge">Tu elección</span> : null}
      </button>
      <div className="tk-card-body">
        <h3>{product.name}</h3>
        <div className="tk-chips" role="group" aria-label={`Colores de ${product.name}`}>
          {product.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`tk-chip${v.id === variant.id ? ' is-on' : ''}`}
              aria-pressed={v.id === variant.id}
              onClick={() => onColor(product.id, v.id)}
            >
              {v.color}
            </button>
          ))}
        </div>
        <button type="button" className="tk-link" onClick={() => onOpen(product.id)}>
          Ver detalle
        </button>
      </div>
    </article>
  );
}

function Detail({product, activeVariantId, onColor, onChoose, onClose}) {
  const variant = product.variants.find((v) => v.id === activeVariantId) ?? product.variants[0];
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tk-overlay" onClick={onClose}>
      <div
        className="tk-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tk-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="tk-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>
        <div className="tk-detail-media">
          {variant.image ? <img src={variant.image} alt={`${product.name} ${variant.color}`} /> : null}
        </div>
        <div className="tk-detail-body">
          <span className="eyebrow">Takayama</span>
          <h3 id="tk-detail-title">{product.name}</h3>
          <p>{product.description}</p>
          <div className="tk-chips" role="group" aria-label="Color">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`tk-chip${v.id === variant.id ? ' is-on' : ''}`}
                aria-pressed={v.id === variant.id}
                onClick={() => onColor(product.id, v.id)}
              >
                {v.color}
              </button>
            ))}
          </div>
          <button type="button" className="tk-submit" onClick={() => onChoose(variant.id)}>
            Elegir esta
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TakayamaLanding({products, collaborator}) {
  const [activeByProduct, setActiveByProduct] = useState({});
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [openId, setOpenId] = useState(null);
  const formRef = useRef(null);
  const rootRef = useRef(null);

  const chosenProductId =
    products.find((p) => p.variants.some((v) => v.id === selectedVariantId))?.id ?? null;

  const setColor = (productId, variantId) =>
    setActiveByProduct((m) => ({...m, [productId]: variantId}));

  const choose = (variantId) => {
    setSelectedVariantId(variantId);
    const product = products.find((p) => p.variants.some((v) => v.id === variantId));
    if (product) setColor(product.id, variantId);
    setOpenId(null);
    formRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
  };

  useEffect(() => {
    let ctx;
    import('~/lib/motion').then(({gsap, ScrollTrigger, prefersReducedMotion}) => {
      if (prefersReducedMotion() || !rootRef.current) return;
      ctx = gsap.context(() => {
        gsap.from('.tk-hero-line', {yPercent: 110, opacity: 0, duration: 1, stagger: 0.12, ease: 'expo.out'});
        ScrollTrigger.batch('[data-tk-card]', {
          start: 'top 88%',
          once: true,
          onEnter: (els) =>
            gsap.from(els, {y: 40, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'power3.out'}),
        });
      }, rootRef);
    });
    return () => ctx?.revert();
  }, []);

  const open = products.find((p) => p.id === openId);
  const firstName = collaborator.fullName.split(' ')[0];

  return (
    <MarketingLayout className="tk-page">
      <div ref={rootRef}>
        <section className="section tk-hero">
          <div className="wrap">
            <span className="eyebrow">Para el equipo Generando Ideas</span>
            <h1 className="display tk-hero-title">
              <span className="tk-hero-mask"><span className="tk-hero-line">Línea</span></span>{' '}
              <span className="tk-hero-mask">
                <span className="tk-hero-line text-grad-word">Takayama</span>
              </span>
            </h1>
            <p className="tk-lede">
              {firstName ? `${firstName}, ` : ''}gracias a nuestro proveedor, cada colaborador puede elegir
              una mochila de la línea Takayama. Explora los modelos, elige la tuya y déjanos tus datos para
              entregártela.
            </p>
            <a href="#modelos" className="tk-submit tk-cta">
              Elige tu mochila
            </a>
          </div>
        </section>

        <section className="section section-alt tk-line">
          <div className="wrap tk-attrs">
            {ATRIBUTOS.map((a) => (
              <div key={a.t} className="tk-attr reveal">
                <h3>{a.t}</h3>
                <p>{a.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section" id="modelos">
          <div className="wrap">
            <span className="eyebrow reveal">{products.length} modelos disponibles</span>
            <h2 className="reveal">Encuentra la que va contigo.</h2>
            {products.length === 0 ? (
              <p className="tk-muted">Por ahora no hay modelos disponibles. Vuelve a intentarlo más tarde.</p>
            ) : (
              <div className="tk-cards">
                {products.map((p) => (
                  <ModelCard
                    key={p.id}
                    product={p}
                    activeVariantId={activeByProduct[p.id]}
                    onColor={setColor}
                    onOpen={setOpenId}
                    isChosen={p.id === chosenProductId}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="section section-alt" id="formulario" ref={formRef}>
          <div className="wrap tk-form-wrap">
            <span className="eyebrow">Último paso</span>
            <h2>Tus datos de entrega</h2>
            <TakayamaForm
              products={products}
              collaborator={collaborator}
              selectedVariantId={selectedVariantId}
              onSelectVariant={choose}
            />
          </div>
        </section>
      </div>

      {open ? (
        <Detail
          product={open}
          activeVariantId={activeByProduct[open.id]}
          onColor={setColor}
          onChoose={choose}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </MarketingLayout>
  );
}
```

Nota: `choose` desde el `<select>` también hace scroll al formulario; como el select ya está en el formulario, el scroll es mínimo. Si molesta en revisión manual, separar `onSelectVariant` del scroll.

- [ ] **Step 6: Styles**

```css
/* app/styles/gi-takayama.css — landing interna Mochilas Takayama */
.tk-page .tk-hero { padding-top: var(--s-9); padding-bottom: var(--s-8); }
.tk-hero-title { margin: var(--s-4) 0 var(--s-5); }
.tk-hero-mask { display: inline-block; overflow: hidden; vertical-align: bottom; }
.tk-hero-line { display: inline-block; }
.tk-lede { max-width: 640px; font-size: 18px; line-height: 1.6; color: var(--ink-3); margin: 0 0 var(--s-6); }

.tk-attrs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--s-5); }
.tk-attr h3 { font: 700 18px/1.3 var(--font-display); margin: 0 0 var(--s-2); color: var(--ink-title); }
.tk-attr p { margin: 0; color: var(--ink-3); line-height: 1.55; }

.tk-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--s-5);
  margin-top: var(--s-6);
}
.tk-card {
  background: var(--bg-elev);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.35s;
}
.tk-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-3); }
.tk-card.is-chosen { box-shadow: 0 0 0 2px var(--accent), var(--shadow-accent); }
.tk-card-media {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1;
  padding: var(--s-4);
  background: var(--bg-soft);
  border: 0;
  cursor: pointer;
}
.tk-card-media img { width: 100%; height: 100%; object-fit: contain; transition: transform 0.5s; }
.tk-card:hover .tk-card-media img { transform: scale(1.05); }
.tk-badge {
  position: absolute; top: var(--s-3); left: var(--s-3);
  background: var(--accent); color: #fff; font: 600 12px var(--font-body);
  padding: 4px 10px; border-radius: var(--r-pill);
}
.tk-card-body { padding: var(--s-4); display: grid; gap: var(--s-3); }
.tk-card-body h3 { margin: 0; font: 700 20px var(--font-display); color: var(--ink-title); }

.tk-chips { display: flex; flex-wrap: wrap; gap: var(--s-2); }
.tk-chip {
  border: 1px solid var(--line-strong); background: transparent; color: var(--ink-2);
  font: 500 13px var(--font-body); padding: 5px 12px; border-radius: var(--r-pill); cursor: pointer;
}
.tk-chip.is-on { border-color: var(--ink); background: var(--ink); color: #fff; }
.tk-link {
  justify-self: start; border: 0; background: none; padding: 0; cursor: pointer;
  color: var(--accent-deep); font: 600 14px var(--font-body);
}

.tk-overlay {
  position: fixed; inset: 0; z-index: 100; background: rgba(20, 17, 10, 0.55);
  display: grid; place-items: center; padding: var(--s-4);
}
.tk-detail {
  position: relative; background: var(--bg-elev); border-radius: var(--r-xl);
  max-width: 920px; width: 100%; max-height: calc(100vh - 32px); overflow: auto;
  display: grid; grid-template-columns: 1fr 1fr;
}
.tk-detail-media { background: var(--bg-soft); padding: var(--s-6); display: grid; place-items: center; }
.tk-detail-media img { width: 100%; max-height: 460px; object-fit: contain; }
.tk-detail-body { padding: var(--s-6); display: grid; gap: var(--s-4); align-content: start; }
.tk-detail-body h3 { margin: 0; font: 700 32px var(--font-display); color: var(--ink-title); }
.tk-detail-body p { margin: 0; color: var(--ink-3); line-height: 1.6; }
.tk-close {
  position: absolute; top: var(--s-3); right: var(--s-3); width: 40px; height: 40px;
  border-radius: 50%; border: 0; background: var(--bg-elev); box-shadow: var(--shadow-2);
  font-size: 24px; cursor: pointer;
}

.tk-submit {
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent); color: #fff; border: 0; border-radius: var(--r-pill);
  font: 600 16px var(--font-body); padding: 14px 28px; cursor: pointer; text-decoration: none;
  transition: background 0.2s, transform 0.2s;
}
.tk-submit:hover { background: var(--accent-deep); transform: translateY(-1px); }
.tk-submit:disabled { opacity: 0.6; cursor: progress; transform: none; }

.tk-form-wrap { max-width: 760px; }
.tk-form { display: grid; gap: var(--s-5); margin-top: var(--s-5); }
.tk-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-4); }
.tk-field { display: grid; gap: 6px; border: 0; padding: 0; margin: 0; }
.tk-field label, .tk-label, .tk-field legend { font: 600 14px var(--font-body); color: var(--ink-2); }
.tk-field input, .tk-field select, .tk-field textarea {
  font: 400 16px var(--font-body); padding: 12px 14px; border-radius: var(--r-md);
  border: 1px solid var(--line-strong); background: var(--bg-elev); color: var(--ink); width: 100%;
}
.tk-field.has-error input, .tk-field.has-error select { border-color: var(--err); }
.tk-static { margin: 0; padding: 12px 0; color: var(--ink-3); }
.tk-choice label { display: flex; gap: var(--s-2); align-items: center; font-weight: 400; }
.tk-shipping { display: grid; gap: var(--s-4); padding: var(--s-5); border-radius: var(--r-lg); background: var(--bg-elev); }
.tk-shipping h4 { margin: 0; font: 700 18px var(--font-display); }
.tk-error { margin: 0; color: var(--err); font-size: 13px; }
.tk-form-error { margin: 0; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: var(--err-soft); color: var(--err); }
.tk-done { margin-top: var(--s-5); padding: var(--s-6); border-radius: var(--r-lg); background: var(--ok-soft); }
.tk-done h3 { margin: var(--s-2) 0; font: 700 26px var(--font-display); }
.tk-muted { color: var(--ink-3); }
.tk-denied { max-width: 560px; margin: var(--s-9) auto; padding: 0 var(--s-4); text-align: center; }

@media (max-width: 900px) {
  .tk-attrs { grid-template-columns: 1fr 1fr; }
  .tk-detail { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .tk-attrs, .tk-grid-2 { grid-template-columns: 1fr; }
  .tk-cards { grid-template-columns: 1fr 1fr; gap: var(--s-3); }
  .tk-detail-body, .tk-detail-media { padding: var(--s-4); }
}
@media (prefers-reduced-motion: reduce) {
  .tk-card, .tk-card-media img, .tk-submit { transition: none; }
}
```

- [ ] **Step 7: Wire into the route**

En `app/routes/mochilas-takayama.jsx`, agregar imports:

```jsx
import TakayamaLanding from '~/components/takayama/TakayamaLanding';
import takayamaStyles from '~/styles/gi-takayama.css?url';
```

agregar después de `meta`:

```jsx
export const links = () => [{rel: 'stylesheet', href: takayamaStyles}];
```

y reemplazar el componente por defecto:

```jsx
export default function MochilasTakayama() {
  const loaderData = useLoaderData();
  if (loaderData.denied) {
    return (
      <main className="tk-denied">
        <span className="eyebrow">Acceso restringido</span>
        <h1 className="display">Esta página es sólo para colaboradores.</h1>
        <p className="tk-muted">
          Entra con tu correo @generandoideas.com para elegir tu mochila Takayama.
        </p>
        <form method="post" action="/auth/logout">
          <button type="submit" className="tk-submit">Cerrar sesión</button>
        </form>
      </main>
    );
  }
  return <TakayamaLanding products={loaderData.products} collaborator={loaderData.collaborator} />;
}
```

`/auth/logout` acepta `POST` (con chequeo de Origin, que un `<form>` del mismo sitio cumple) y redirige a `/`.

- [ ] **Step 8: Run all tests and lint**

Run: `npm test && npx eslint app/routes/mochilas-takayama.jsx app/components/takayama app/lib/takayama app/lib/auth/collaborator*.js`
Expected: todo en verde. Si `mochilas-takayama.test.js` falla al importar `?url` (no debería: Vitest usa el pipeline de assets de Vite), agregar al test `vi.mock('~/styles/gi-takayama.css?url', () => ({default: ''}))`.

- [ ] **Step 9: Commit**

```bash
git add app/components/takayama app/styles/gi-takayama.css app/routes/mochilas-takayama.jsx
git commit -m "feat(takayama): landing con modelos, detalle y formulario de entrega

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Verificación en la app real

**Files:** ninguno (salvo ajustes que salgan de aquí).

- [ ] **Step 1: Levantar la app**

Run: `npm run dev` (en segundo plano) y abrir `http://localhost:3000/mochilas-takayama`.

- [ ] **Step 2: Sin sesión**

Expected: redirect a `/login?redirectTo=%2Fmochilas-takayama`. Al entrar con una cuenta `@generandoideas.com`, cae de vuelta en la landing.

- [ ] **Step 3: Catálogo**

Expected: aparecen los modelos del tag menos los agotados (hoy 14 de 15: Maiko está en 0). Comparar contra el admin (`tag:mochila-takayama`). Si faltan productos que sí tienen el tag (la búsqueda de Storefront no los devolvió), crear en Shopify la colección automática "Mochilas Takayama" (condición: tag = `mochila-takayama`), cambiar la query a `collection(handle: "mochilas-takayama") { products(first: 50) { nodes {...} } }` y ajustar `fetchTakayamaProducts` y su prueba.

- [ ] **Step 4: Otro dominio**

Con una cuenta de cliente (no `@generandoideas.com`): se ve "Esta página es sólo para colaboradores" y la respuesta es 403.

- [ ] **Step 5: Envío**

Elegir un modelo desde la tarjeta, desde el detalle y desde el select; probar "No" y "Sí" en foráneo; enviar. Sin `RESEND_API_KEY` en local, la consola muestra `[email][STUB] sendEmail invoked ... to=igarcia@generandoideas.com cc=<correo>`. Con la llave, confirmar que llega el correo y la copia.

- [ ] **Step 6: Móvil**

A 375 px de ancho: sin scroll horizontal, grid de 2 columnas, detalle en una columna, formulario en una columna.

- [ ] **Step 7: Registro de colaborador**

Registrar `prueba+tk@generandoideas.com` (o el que tengas): verificar que no aparece customer nuevo en Shopify con `lead-pendiente` y que no llega aviso a marketing.

- [ ] **Step 8: Commit de ajustes (si hubo)**

```bash
git add -A
git commit -m "fix(takayama): ajustes de la verificación manual

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
