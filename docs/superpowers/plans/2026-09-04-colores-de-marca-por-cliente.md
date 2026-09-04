# Colores de marca por cliente — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un cliente cuyo customer de Shopify trae el metafield `custom.colores` sólo vea, en todas las superficies de producto de la aplicación, productos que puede pedir en alguno de los colores de su marca.

**Architecture:** Un módulo puro (`app/lib/brand-colors.js`) traduce el metafield a familias de color reutilizando `colorFamilyOf()` de `filters.js`; un módulo de servidor (`app/lib/brand-colors.server.js`) lo lee por Admin API con memo por request y caché de Hydrogen. Cada superficie aplica la restricción de forma nativa (`productFilters` / `collection.products(filters:)`) donde la Storefront API lo permite, y por post-filtro en memoria donde no.

**Tech Stack:** Hydrogen 2026.4.2 · React Router 7.14 · Storefront API + Admin API `2026-04` · Vitest · libSQL/Turso (sólo para el snapshot de sesión, que ya existe)

**Spec:** `docs/superpowers/specs/2026-09-04-colores-de-marca-por-cliente-design.md`

## Global Constraints

- **Idioma:** todo comentario, mensaje de commit y texto de interfaz va en español. Los comentarios explican *por qué*, no *qué* — es la convención de este repositorio.
- **Metafield:** `namespace: "custom"`, `key: "colores"`, `ownerType: CUSTOMER`, tipo `list.single_line_text_field`. Valor de ejemplo real: `["Rojo","Negro"]`.
- **Semántica ANY:** un producto aparece si **alguno** de sus tonos pertenece a alguna familia de la marca.
- **Coincidencia por familia:** siempre vía `colorFamilyOf()` de `app/lib/filters.js`. Nunca comparar cadenas crudas.
- **Fail-open:** sin sesión, sin `gid`, en stub mode, con el metafield vacío, con la llamada al Admin API caída, o con **todos** los valores irreconocibles → **no se filtra nada**. Nunca se tumba una ruta.
- **Fail-closed en un solo caso:** si la marca tiene familias reconocibles pero **ninguna** existe en el catálogo, el resultado es 0 productos, no el catálogo entero.
- **Opción de variante:** se llama `color` (minúscula) en `variantOption`; en los productos el nombre de la opción se detecta con `/color/i`.
- **Tests:** Vitest, archivo `*.test.js` junto al fuente. Correr con `npx vitest run <ruta>`.
- **Sin dependencias nuevas.** Todo sale de `@shopify/hydrogen@2026.4.2`, que ya exporta `createWithCache`, `CacheShort` y `CacheLong`.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `app/lib/brand-colors.js` **(nuevo)** | Puro. Parseo del metafield, intersección con la selección del usuario, construcción de `ProductFilter`, post-filtro en memoria. **Importable desde el cliente** |
| `app/lib/brand-colors.server.js` **(nuevo)** | I/O. `getBrandColors(context)` y `getColorVocabulary(context)`, con memo por request y caché. **Nunca se importa desde un componente** |
| `app/lib/admin/operations.js` | Se le añade `getCustomerBrandColors(env, gid)`, junto a `getCustomerAdvisor` |
| `app/lib/filters.js` | Se le añade la opción `colorObligatorio` a `buildProductFilters` |
| `app/lib/context.js` | Cableado de `withCache` en `additionalContext` |
| `scripts/diagnostico-colores-marca.mjs` **(nuevo)** | Mide el recorte del catálogo por familia antes de encender nada |

La separación `brand-colors.js` / `brand-colors.server.js` no es decorativa: `RecentlyViewed.jsx` es un componente de cliente y necesita las funciones puras. Si el I/O viviera en el mismo módulo, Vite arrastraría `admin/client.js` —y con él la forma de usar el token de Admin— al bundle del navegador.

---

### Task 1: Diagnóstico del recorte real

Es la salvaguarda de la decisión "los productos sin color reconocible se ocultan". Va primero para que el número exista **antes** de que nadie construya encima.

**Files:**
- Create: `scripts/diagnostico-colores-marca.mjs`
- Modify: `package.json` (sección `scripts`)

**Interfaces:**
- Consumes: `COLOR_FAMILIES`, `colorFamilyOf` de `app/lib/filters.js` (ya existen)
- Produces: nada que consuma otra tarea. Es una herramienta de decisión.

- [ ] **Step 1: Escribir el script**

```javascript
// scripts/diagnostico-colores-marca.mjs
//
// Uso:  set -a; . ./.env; set +a; PUBLIC_STORE_DOMAIN=development-gi.myshopify.com \
//         node scripts/diagnostico-colores-marca.mjs
//
// Mide cuánto catálogo le queda a un cliente según los colores de su marca,
// antes de encender el filtro. Responde a dos preguntas:
//   1. Por cada familia de color, ¿cuántos productos activos sobreviven?
//   2. ¿Cuántos productos no tienen NINGÚN tono clasificable (UNICO,
//      TRANSPARENTE, MARMOLEADO)? Ésos desaparecen para todos los clientes
//      con paleta, y son el riesgo real de la decisión que tomamos.
import {COLOR_FAMILIES, colorFamilyOf} from '../app/lib/filters.js';

const env = process.env;
const dominio = env.PUBLIC_STORE_DOMAIN;
const token = env.PRIVATE_ADMIN_API_TOKEN;
const version = env.SHOPIFY_ADMIN_API_VERSION || '2026-04';

if (!dominio || !token) {
  console.error(
    '✗ Faltan PUBLIC_STORE_DOMAIN y/o PRIVATE_ADMIN_API_TOKEN.\n' +
      '  set -a; . ./.env; set +a; PUBLIC_STORE_DOMAIN=development-gi.myshopify.com \\\n' +
      '    node scripts/diagnostico-colores-marca.mjs',
  );
  process.exit(1);
}

const QUERY = `
  query productosConColor($cursor: String) {
    products(first: 250, after: $cursor, query: "status:active") {
      nodes { id options { name optionValues { name } } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

async function pedir(cursor) {
  const res = await fetch(`https://${dominio}/admin/api/${version}/graphql.json`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Shopify-Access-Token': token},
    body: JSON.stringify({query: QUERY, variables: {cursor}}),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(`Admin API: ${JSON.stringify(json.errors ?? res.status)}`);
  }
  return json.data.products;
}

const porFamilia = new Map(COLOR_FAMILIES.map((f) => [f.id, 0]));
let total = 0;
let sinNingunTono = 0;
const tonosNoReconocidos = new Map();

let cursor = null;
do {
  const page = await pedir(cursor);
  for (const p of page.nodes) {
    total += 1;
    const opcion = (p.options || []).find((o) => /color/i.test(o.name));
    const tonos = (opcion?.optionValues || []).map((v) => v.name);
    const familias = new Set();
    for (const t of tonos) {
      const fam = colorFamilyOf(t);
      if (fam) familias.add(fam);
      else tonosNoReconocidos.set(t, (tonosNoReconocidos.get(t) || 0) + 1);
    }
    if (familias.size === 0) sinNingunTono += 1;
    for (const f of familias) porFamilia.set(f, porFamilia.get(f) + 1);
  }
  cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  process.stderr.write(`\r  leídos ${total}…`);
} while (cursor);
process.stderr.write('\n\n');

const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;
console.log(`Productos activos analizados: ${total}\n`);
console.log('Catálogo que le queda a una marca de UN SOLO color:');
for (const fam of COLOR_FAMILIES) {
  const n = porFamilia.get(fam.id);
  console.log(`  ${fam.label.padEnd(12)} ${String(n).padStart(6)}  ${pct(n).padStart(7)}`);
}
console.log(
  `\nProductos sin ningún tono clasificable: ${sinNingunTono} (${pct(sinNingunTono)})`,
);
console.log('  → desaparecen para TODOS los clientes con paleta.\n');
console.log('Valores de color que no se reconocen (top 20):');
for (const [tono, n] of [...tonosNoReconocidos].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${String(n).padStart(5)}  ${tono}`);
}
```

- [ ] **Step 2: Registrar el script en package.json**

En `package.json`, dentro de `"scripts"`, junto a `"crear-asesores"`:

```json
"diagnostico-colores": "node scripts/diagnostico-colores-marca.mjs",
```

- [ ] **Step 3: Correrlo y leer el resultado**

```bash
set -a; . ./.env; set +a
PUBLIC_STORE_DOMAIN=development-gi.myshopify.com npm run diagnostico-colores
```

Esperado: la tabla de las 13 familias sobre ~6.980 productos activos. Tarda ~30 s (28 páginas de 250).

**Umbral de decisión — pararse y avisar al usuario, no seguir a ciegas:**
- Si "productos sin ningún tono clasificable" supera el **10%**, hay que decírselo antes de continuar: la decisión de ocultarlos se tomó suponiendo que era ruido marginal.
- Si alguna familia frecuente deja menos del **5%** del catálogo, decírselo también: esa marca tendría un catálogo inservible.

- [ ] **Step 4: Commit**

```bash
git add scripts/diagnostico-colores-marca.mjs package.json
git commit -m "chore(colores): script de diagnóstico del recorte por familia de color"
```

---

### Task 2: Módulo puro `brand-colors.js`

**Files:**
- Create: `app/lib/brand-colors.js`
- Modify: `app/lib/filters.js` (exportar `SIN_COINCIDENCIA`)
- Test: `app/lib/brand-colors.test.js`

**Interfaces:**
- Consumes: `colorFamilyOf`, `groupColorValues` de `app/lib/filters.js`
- Produces también: `SIN_COINCIDENCIA` exportada desde `app/lib/filters.js` — la Task 5 la reutiliza
- Produces:
  - `parseBrandColors(raw: string|null) → string[]` — ids de familia
  - `effectiveColorFamilies(seleccion: string[], marca: string[]) → string[]` — lo que se consulta
  - `visibleColorSelection(seleccion: string[], marca: string[]) → string[]` — lo que se pinta como chip
  - `brandProductFilters(familias: string[], vocabulario: Array<{label,count}>) → ProductFilter[]|null`
  - `productMatchesBrand(producto, familias: string[]) → boolean`
  - `keepBrandProducts(productos: any[], familias: string[]) → any[]`

- [ ] **Step 1: Escribir el test que falla**

```javascript
// app/lib/brand-colors.test.js
import {describe, it, expect} from 'vitest';
import {
  parseBrandColors,
  effectiveColorFamilies,
  visibleColorSelection,
  brandProductFilters,
  productMatchesBrand,
  keepBrandProducts,
} from './brand-colors.js';

/* El metafield es list.single_line_text_field SIN validación de choices: es
   texto libre que escribe una persona en el admin. Todo lo que sigue son
   valores que de verdad puede traer. */
describe('parseBrandColors', () => {
  it('traduce el valor real de la tienda a familias', () => {
    expect(parseBrandColors('["Rojo","Negro"]')).toEqual(['rojo', 'negro']);
  });

  it('clasifica tonos compuestos por su familia', () => {
    expect(parseBrandColors('["AZUL MARINO","Verde Pistacho"]')).toEqual(['azul', 'verde']);
  });

  it('colapsa los que caen en la misma familia', () => {
    expect(parseBrandColors('["Rojo","Vino","Guinda"]')).toEqual(['rojo']);
  });

  it('descarta lo que no es un color y conserva lo que sí', () => {
    expect(parseBrandColors('["Pantone 186C","Negro"]')).toEqual(['negro']);
  });

  /* Fail-open: una errata en el admin no puede vaciarle el catálogo a un
     cliente. Sin familias reconocibles, no se filtra. */
  it('devuelve vacío si nada es reconocible', () => {
    expect(parseBrandColors('["Pantone 186C","#c2352c"]')).toEqual([]);
  });

  it.each([
    ['null', null],
    ['cadena vacía', ''],
    ['JSON roto', '["Rojo"'],
    ['no es un array', '{"color":"Rojo"}'],
    ['array vacío', '[]'],
  ])('devuelve vacío con %s', (_, valor) => {
    expect(parseBrandColors(valor)).toEqual([]);
  });
});

describe('effectiveColorFamilies', () => {
  it('sin marca respeta la selección del usuario', () => {
    expect(effectiveColorFamilies(['verde'], [])).toEqual(['verde']);
  });

  it('con marca y sin selección devuelve la paleta entera', () => {
    expect(effectiveColorFamilies([], ['rojo', 'negro'])).toEqual(['rojo', 'negro']);
  });

  it('con marca y selección devuelve la intersección', () => {
    expect(effectiveColorFamilies(['rojo', 'verde'], ['rojo', 'negro'])).toEqual(['rojo']);
  });

  /* Nadie se sale de su paleta editando la URL a mano. */
  it('vuelve a la paleta si la selección queda fuera de ella', () => {
    expect(effectiveColorFamilies(['verde'], ['rojo', 'negro'])).toEqual(['rojo', 'negro']);
  });
});

describe('visibleColorSelection', () => {
  it('sin marca es la selección tal cual', () => {
    expect(visibleColorSelection(['verde'], [])).toEqual(['verde']);
  });

  /* Los chips sólo pueden prometer lo que la consulta está aplicando: un chip
     "Verde" con una x que no quita nada sería mentir. */
  it('con marca borra lo que no es de la paleta', () => {
    expect(visibleColorSelection(['rojo', 'verde'], ['rojo', 'negro'])).toEqual(['rojo']);
  });
});

const VOCABULARIO = [
  {label: 'ROJO', count: 66},
  {label: 'VINO', count: 5},
  {label: 'NEGRO', count: 61},
  {label: 'AZUL MARINO', count: 15},
  {label: 'UNICO', count: 2},
];

describe('brandProductFilters', () => {
  it('expande cada familia a todos sus tonos del catálogo', () => {
    expect(brandProductFilters(['rojo'], VOCABULARIO)).toEqual([
      {variantOption: {name: 'color', value: 'ROJO'}},
      {variantOption: {name: 'color', value: 'VINO'}},
    ]);
  });

  it('sin marca no filtra', () => {
    expect(brandProductFilters([], VOCABULARIO)).toBeNull();
  });

  /* Fail-closed, el único caso: la marca es morada y la tienda no vende nada
     morado. La verdad es "no hay nada para ti aquí", no "toma el catálogo
     entero". Un valor imposible es cómo se le dice eso a la API sin que cada
     loader tenga que ramificar. */
  it('devuelve un filtro imposible si ninguna familia existe en el catálogo', () => {
    const out = brandProductFilters(['morado'], VOCABULARIO);
    expect(out).toHaveLength(1);
    expect(out[0].variantOption.value).toBe('GI-SIN-COINCIDENCIA');
  });
});

describe('productMatchesBrand', () => {
  const producto = {colors: ['ROJO', 'AZUL MARINO', 'UNICO']};

  it('sin marca pasa todo', () => {
    expect(productMatchesBrand(producto, [])).toBe(true);
  });

  /* ANY: basta con que se pueda pedir en uno de sus colores. */
  it('basta con que coincida un tono', () => {
    expect(productMatchesBrand(producto, ['rojo'])).toBe(true);
  });

  it('no coincide si ningún tono es de la paleta', () => {
    expect(productMatchesBrand(producto, ['verde'])).toBe(false);
  });

  it('lee la opción de variante cuando no viene normalizado', () => {
    const crudo = {options: [{name: 'Color', optionValues: [{name: 'NEGRO'}]}]};
    expect(productMatchesBrand(crudo, ['negro'])).toBe(true);
  });

  /* UNICO / TRANSPARENTE / MARMOLEADO no son colores: no pertenecen a ninguna
     familia y por tanto no salvan a un producto. */
  it('un producto sólo en tonos no clasificables no coincide con nada', () => {
    expect(productMatchesBrand({colors: ['UNICO', 'TRANSPARENTE']}, ['rojo'])).toBe(false);
  });

  it('un producto sin colores no coincide', () => {
    expect(productMatchesBrand({colors: []}, ['rojo'])).toBe(false);
  });
});

describe('keepBrandProducts', () => {
  const lista = [{id: 1, colors: ['ROJO']}, {id: 2, colors: ['VERDE']}];

  it('sin marca devuelve la lista intacta', () => {
    expect(keepBrandProducts(lista, [])).toBe(lista);
  });

  it('con marca deja sólo los que coinciden', () => {
    expect(keepBrandProducts(lista, ['rojo']).map((p) => p.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/lib/brand-colors.test.js`
Expected: FAIL — `Failed to resolve import "./brand-colors.js"`

- [ ] **Step 3: Exportar el filtro imposible desde `filters.js`**

Vive en `filters.js` y no en `brand-colors.js` porque `filters.js` es quien
construye los `ProductFilter` de esta aplicación, y porque la Task 5 lo
necesita también: una sola definición, no dos copias del mismo literal.

Añadir en `app/lib/filters.js`, en el bloque "Construcción de la consulta",
justo antes de `buildProductFilters`:

```javascript
/* Un cliente con paleta de marca no puede acabar en "no filtro nada": eso le
   enseñaría el catálogo entero, lo contrario de lo prometido. Cuando su paleta
   no tiene ningún tono en la tienda, se filtra por un valor imposible para que
   la respuesta sea 0 productos, que es la verdad. */
export const SIN_COINCIDENCIA = {
  variantOption: {name: 'color', value: 'GI-SIN-COINCIDENCIA'},
};
```

- [ ] **Step 4: Escribir la implementación**

```javascript
// app/lib/brand-colors.js
/* Generando Ideas — colores de marca del cliente.
 *
 * Los clientes son marcas, y cada marca tiene su paleta. La tienda la guarda
 * en el metafield de customer `custom.colores`, un list.single_line_text_field
 * SIN validación de choices: texto libre que escribe una persona en el admin.
 * Los valores reales ("Rojo", "Negro") coinciden con las etiquetas de
 * COLOR_FAMILIES, así que aquí se normaliza a familias y no se inventa un
 * vocabulario nuevo.
 *
 * Todo lo de este archivo es puro: lo importa también RecentlyViewed, que es
 * un componente de cliente. El I/O vive en brand-colors.server.js para que el
 * cliente de Admin API no acabe en el bundle del navegador.
 */
import {colorFamilyOf, groupColorValues, SIN_COINCIDENCIA} from './filters.js';

/**
 * Familias de color de la marca, a partir del valor crudo del metafield.
 * Tolerante con todo lo que puede escribirse a mano: JSON roto, un objeto en
 * vez de un array, hexadecimales, códigos Pantone. Devuelve [] —o sea, "no
 * filtres"— en vez de romper.
 * @param {string|null|undefined} raw
 * @returns {string[]} ids de familia, sin repetir, en el orden del metafield
 */
export function parseBrandColors(raw) {
  if (!raw) return [];
  let lista;
  try {
    lista = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(lista)) return [];
  const out = [];
  for (const valor of lista) {
    const familia = colorFamilyOf(valor);
    if (familia && !out.includes(familia)) out.push(familia);
  }
  return out;
}

/**
 * Las familias que de verdad se consultan. Con marca, nunca se sale de la
 * paleta: ni eligiendo en el panel ni editando `?color=` a mano.
 * @param {string[]} seleccion familias elegidas por el usuario
 * @param {string[]} marca familias de su paleta ([] si no tiene)
 */
export function effectiveColorFamilies(seleccion, marca) {
  const paleta = marca || [];
  const elegidas = seleccion || [];
  if (!paleta.length) return elegidas;
  if (!elegidas.length) return paleta;
  const interseccion = elegidas.filter((f) => paleta.includes(f));
  // Pidió sólo colores ajenos a su marca: se le devuelve su paleta, no la nada.
  return interseccion.length ? interseccion : paleta;
}

/**
 * Las familias que se pintan como chip removible. La paleta NO va aquí: es el
 * suelo del catálogo, no un filtro aplicado, y una x que no quita nada mentiría.
 * @param {string[]} seleccion
 * @param {string[]} marca
 */
export function visibleColorSelection(seleccion, marca) {
  const paleta = marca || [];
  const elegidas = seleccion || [];
  if (!paleta.length) return elegidas;
  return elegidas.filter((f) => paleta.includes(f));
}

/**
 * `ProductFilter[]` para las consultas que aceptan facetas. Cada familia se
 * expande a los tonos crudos que existen en la tienda; al ser todos del mismo
 * tipo, la API los combina con O.
 * @param {string[]} familias
 * @param {Array<{label: string, count: number}>} vocabulario tonos del catálogo
 * @returns {Array<object>|null} null cuando no hay marca (no filtrar)
 */
export function brandProductFilters(familias, vocabulario) {
  const paleta = familias || [];
  if (!paleta.length) return null;
  const grupos = groupColorValues(vocabulario || []);
  const out = [];
  for (const id of paleta) {
    const grupo = grupos.find((g) => g.family === id);
    if (!grupo) continue;
    for (const value of grupo.values) out.push({variantOption: {name: 'color', value}});
  }
  return out.length ? out : [SIN_COINCIDENCIA];
}

/** Los tonos de un producto, venga normalizado o crudo de la Storefront API. */
function tonosDe(producto) {
  if (producto?.colors?.length) return producto.colors;
  const opcion = (producto?.options || []).find((o) => /color/i.test(o?.name || ''));
  return (opcion?.optionValues || []).map((v) => (typeof v === 'string' ? v : v?.name));
}

/**
 * ¿Este producto se puede pedir en algún color de la marca? Semántica ANY: un
 * producto en ROJO/NEGRO/AZUL sí sirve a una marca roja, porque lo van a
 * cotizar en rojo.
 * @param {object} producto normalizado (`colors`) o crudo (`options`)
 * @param {string[]} familias
 */
export function productMatchesBrand(producto, familias) {
  const paleta = familias || [];
  if (!paleta.length) return true;
  for (const tono of tonosDe(producto)) {
    const familia = colorFamilyOf(tono);
    if (familia && paleta.includes(familia)) return true;
  }
  return false;
}

/**
 * Post-filtro en memoria, para las consultas que no aceptan facetas
 * (predictiveSearch, productRecommendations, nodes(ids:)). Devuelve la misma
 * referencia cuando no hay marca, para no copiar listas sin motivo.
 * @param {Array<object>} productos
 * @param {string[]} familias
 */
export function keepBrandProducts(productos, familias) {
  const paleta = familias || [];
  if (!paleta.length) return productos;
  return (productos || []).filter((p) => productMatchesBrand(p, paleta));
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `npx vitest run app/lib/brand-colors.test.js app/lib/filters.test.js`
Expected: PASS, 22 tests nuevos y los de `filters.test.js` sin tocar

- [ ] **Step 6: Commit**

```bash
git add app/lib/brand-colors.js app/lib/brand-colors.test.js app/lib/filters.js
git commit -m "feat(colores): módulo puro de colores de marca del cliente"
```

---

### Task 3: Lectura del metafield por Admin API

**Files:**
- Modify: `app/lib/admin/operations.js` (añadir al final, junto a las demás operaciones de customer)
- Test: `app/lib/admin/operations.test.js` (añadir un `describe`)

**Interfaces:**
- Consumes: `adminFetch`, `isStubMode` de `app/lib/admin/client.js` (ya existen)
- Produces: `getCustomerBrandColors(env, customerGid) → Promise<string|null>` — el valor **crudo** del metafield. El parseo es de `brand-colors.js`; esta función sólo habla con la red.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `app/lib/admin/operations.test.js`. Añadir también `getCustomerBrandColors` a la lista de imports del principio del archivo.

```javascript
describe('getCustomerBrandColors', () => {
  it('devuelve el valor crudo del metafield', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValueOnce({
      customer: {metafield: {value: '["Rojo","Negro"]'}},
    });
    const out = await getCustomerBrandColors(
      {PRIVATE_ADMIN_API_TOKEN: 't'},
      'gid://shopify/Customer/9989852135727',
    );
    expect(out).toBe('["Rojo","Negro"]');
    const [, , vars] = adminFetch.mock.calls[0];
    expect(vars.gid).toBe('gid://shopify/Customer/9989852135727');
  });

  it('devuelve null cuando el customer no tiene el metafield', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValueOnce({customer: {metafield: null}});
    expect(await getCustomerBrandColors({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://x')).toBeNull();
  });

  it('devuelve null cuando el customer no existe', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValueOnce({customer: null});
    expect(await getCustomerBrandColors({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://x')).toBeNull();
  });

  /* Sin token no hay a quién preguntar, y un stub inventado restringiría el
     catálogo en desarrollo sin que nadie entienda por qué. */
  it('no llama a la red en stub mode', async () => {
    isStubMode.mockReturnValue(true);
    expect(await getCustomerBrandColors({}, 'gid://x')).toBeNull();
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('no llama a la red sin gid', async () => {
    isStubMode.mockReturnValue(false);
    expect(await getCustomerBrandColors({PRIVATE_ADMIN_API_TOKEN: 't'}, null)).toBeNull();
    expect(adminFetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/lib/admin/operations.test.js -t getCustomerBrandColors`
Expected: FAIL — `getCustomerBrandColors is not a function`

- [ ] **Step 3: Escribir la implementación**

Añadir al final de `app/lib/admin/operations.js`:

```javascript
const CUSTOMER_BRAND_COLORS = `
  query customerBrandColors($gid: ID!) {
    customer(id: $gid) {
      metafield(namespace: "custom", key: "colores") { value }
    }
  }
`;

/**
 * Lee la paleta de marca del cliente: el metafield de customer
 * `custom.colores`, un list.single_line_text_field cuyo valor es un JSON como
 * `["Rojo","Negro"]`. Devuelve la cadena cruda —el parseo vive en
 * brand-colors.js, que es puro y testeable sin red.
 *
 * Null-safe por diseño: sin token, sin gid, sin customer o sin metafield
 * devuelve null, que aguas arriba significa "no filtres". Requiere el scope
 * read_customers, el mismo que ya usa getCustomerAdvisor.
 * @param {Record<string, any>} env
 * @param {string|null|undefined} customerGid
 * @returns {Promise<string|null>}
 */
export async function getCustomerBrandColors(env, customerGid) {
  if (isStubMode(env) || !customerGid) return null;
  const data = await adminFetch(env, CUSTOMER_BRAND_COLORS, {gid: customerGid});
  return data?.customer?.metafield?.value ?? null;
}
```

- [ ] **Step 4: Correr los tests del archivo entero**

Run: `npx vitest run app/lib/admin/operations.test.js`
Expected: PASS — los 5 nuevos y todos los que ya había

- [ ] **Step 5: Commit**

```bash
git add app/lib/admin/operations.js app/lib/admin/operations.test.js
git commit -m "feat(colores): lectura del metafield custom.colores por Admin API"
```

---

### Task 4: Resolución en servidor, con memo y caché

**Files:**
- Create: `app/lib/brand-colors.server.js`
- Modify: `app/lib/context.js`
- Test: `app/lib/brand-colors.server.test.js`

**Interfaces:**
- Consumes: `getSessionUser` (`app/lib/auth/session.js`), `getCustomerBrandColors` (Task 3), `parseBrandColors` (Task 2), `GI_CATALOG_SEARCH_QUERY` (`app/lib/giFragments.js`)
- Produces:
  - `getBrandColors(context) → Promise<{families: string[], raw: string|null}|null>` — `null` = sin restricción
  - `getColorVocabulary(context) → Promise<Array<{label: string, count: number}>>`

- [ ] **Step 1: Cablear `withCache` en el contexto**

En `app/lib/context.js`. `createWithCache` necesita valores por request (`cache`, `waitUntil`, `request`), así que se construye dentro de la función, no en el `additionalContext` de módulo que hay ahora.

Añadir al import de Hydrogen:

```javascript
import {createHydrogenContext, createWithCache} from '@shopify/hydrogen';
```

Y dentro de `createHydrogenRouterContext`, después de resolver `cache` y `session`, cambiar la llamada a `createHydrogenContext` para que su segundo argumento lleve `withCache`:

```javascript
  // Caché de subrequest para lo que no pasa por la Storefront API. La usa
  // getBrandColors: leer la paleta del cliente por Admin API en cada carga de
  // cada página sería un round trip de más en toda la aplicación.
  const withCache = createWithCache({cache, waitUntil, request});

  const hydrogenContext = createHydrogenContext(
    {
      env,
      request,
      cache,
      waitUntil,
      session,
      i18n: {language: 'ES', country: 'MX'},
      cart: {queryFragment: CART_QUERY_FRAGMENT},
    },
    {...additionalContext, withCache},
  );
```

- [ ] **Step 2: Escribir el test que falla**

```javascript
// app/lib/brand-colors.server.test.js
import {describe, it, expect, vi, beforeEach} from 'vitest';

const getCustomerBrandColors = vi.fn();
vi.mock('./admin/operations.js', () => ({
  getCustomerBrandColors: (...a) => getCustomerBrandColors(...a),
}));

const getSessionUser = vi.fn();
vi.mock('./auth/session.js', () => ({
  getSessionUser: (...a) => getSessionUser(...a),
}));

import {getBrandColors} from './brand-colors.server.js';

/* withCache se salta la caché y ejecuta: aquí se prueba la lógica, no Hydrogen. */
const hazContexto = () => ({
  env: {PRIVATE_ADMIN_API_TOKEN: 't'},
  session: {},
  withCache: {run: (_opciones, fn) => fn({addDebugData: () => {}})},
});

beforeEach(() => {
  getCustomerBrandColors.mockReset();
  getSessionUser.mockReset();
});

describe('getBrandColors', () => {
  it('devuelve las familias del cliente que tiene paleta', async () => {
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://shopify/Customer/1'});
    getCustomerBrandColors.mockResolvedValue('["Rojo","Negro"]');
    const out = await getBrandColors(hazContexto());
    expect(out.families).toEqual(['rojo', 'negro']);
  });

  it('devuelve null sin sesión', async () => {
    getSessionUser.mockReturnValue(null);
    expect(await getBrandColors(hazContexto())).toBeNull();
    expect(getCustomerBrandColors).not.toHaveBeenCalled();
  });

  it('devuelve null si el usuario no está enlazado a Shopify', async () => {
    getSessionUser.mockReturnValue({userId: 'u1', gid: null});
    expect(await getBrandColors(hazContexto())).toBeNull();
    expect(getCustomerBrandColors).not.toHaveBeenCalled();
  });

  it('devuelve null si el metafield está vacío', async () => {
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://x'});
    getCustomerBrandColors.mockResolvedValue(null);
    expect(await getBrandColors(hazContexto())).toBeNull();
  });

  /* Fail-open ruidoso: una errata en el admin no puede vaciarle el catálogo a
     un cliente, pero tiene que quedar rastro para poder corregirla. */
  it('no restringe si ningún valor del metafield es reconocible, y avisa', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://x'});
    getCustomerBrandColors.mockResolvedValue('["Pantone 186C"]');
    expect(await getBrandColors(hazContexto())).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  /* El catálogo no puede caerse porque el Admin API tenga un mal día. */
  it('no restringe ni lanza si el Admin API falla', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://x'});
    getCustomerBrandColors.mockRejectedValue(new Error('502'));
    expect(await getBrandColors(hazContexto())).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  /* El loader de root y el de la ruta corren en paralelo: sin memo, cada
     página pagaría dos llamadas idénticas al Admin API. */
  it('memoiza por request', async () => {
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://x'});
    getCustomerBrandColors.mockResolvedValue('["Rojo"]');
    const context = hazContexto();
    const [a, b] = await Promise.all([getBrandColors(context), getBrandColors(context)]);
    expect(a).toBe(b);
    expect(getCustomerBrandColors).toHaveBeenCalledTimes(1);
  });

  /* Aislamiento: dos clientes distintos en el mismo isolate no comparten
     resultado. */
  it('no comparte el memo entre requests distintas', async () => {
    getSessionUser.mockReturnValueOnce({userId: 'u1', gid: 'gid://1'});
    getCustomerBrandColors.mockResolvedValueOnce('["Rojo"]');
    const uno = await getBrandColors(hazContexto());
    getSessionUser.mockReturnValueOnce({userId: 'u2', gid: 'gid://2'});
    getCustomerBrandColors.mockResolvedValueOnce('["Verde"]');
    const dos = await getBrandColors(hazContexto());
    expect(uno.families).toEqual(['rojo']);
    expect(dos.families).toEqual(['verde']);
  });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `npx vitest run app/lib/brand-colors.server.test.js`
Expected: FAIL — `Failed to resolve import "./brand-colors.server.js"`

- [ ] **Step 4: Escribir la implementación**

```javascript
// app/lib/brand-colors.server.js
/* Generando Ideas — resolución en servidor de la paleta de marca del cliente.
 *
 * Server-only: importa el cliente de Admin API. Las funciones puras que también
 * necesita el navegador viven en brand-colors.js.
 */
import {CacheLong, CacheShort} from '@shopify/hydrogen';
import {getSessionUser} from './auth/session.js';
import {getCustomerBrandColors} from './admin/operations.js';
import {parseBrandColors} from './brand-colors.js';
import {GI_CATALOG_SEARCH_QUERY} from './giFragments.js';

/* Memo por request. El loader de root y el de la ruta corren en paralelo, así
   que sin esto cada página pagaría dos veces lo mismo. Va en un WeakMap y no
   como propiedad del contexto para no escribir sobre un objeto de Hydrogen; la
   entrada se recolecta con la request. */
const porRequest = new WeakMap();

function memo(context, clave, fn) {
  let cajon = porRequest.get(context);
  if (!cajon) {
    cajon = {};
    porRequest.set(context, cajon);
  }
  if (!cajon[clave]) cajon[clave] = fn();
  return cajon[clave];
}

const FACET_COLOR = 'filter.v.option.color';

async function leerPaleta(context) {
  const usuario = getSessionUser(context.session);
  if (!usuario?.gid) return null;

  let raw = null;
  try {
    raw = await context.withCache.run(
      {
        // La clave lleva el gid: dos clientes con paletas distintas nunca
        // comparten entrada. Es la caché de servidor, no la del navegador.
        cacheKey: ['gi-brand-colors', usuario.gid],
        cacheStrategy: CacheShort({maxAge: 300, staleWhileRevalidate: 300}),
        shouldCacheResult: (v) => v !== undefined,
      },
      () => getCustomerBrandColors(context.env, usuario.gid),
    );
  } catch (error) {
    // El catálogo no puede caerse porque el Admin API tenga un mal día.
    console.error('[brand-colors] no se pudo leer custom.colores:', error);
    return null;
  }

  if (!raw) return null;

  const families = parseBrandColors(raw);
  if (!families.length) {
    // Fail-open: alguien escribió "Pantone 186C" o un hexadecimal en el admin.
    // Vaciarle el catálogo al cliente sería un castigo desproporcionado por
    // una errata, pero tiene que quedar rastro para corregirla.
    console.warn(
      `[brand-colors] ningún valor reconocible en custom.colores de ${usuario.gid}: ${raw}`,
    );
    return null;
  }
  return {families, raw};
}

/**
 * La paleta de marca del cliente de esta request, o null si no hay restricción
 * que aplicar (sin sesión, sin gid, sin token de Admin, metafield vacío o
 * ilegible, o el Admin API caído).
 * @param {any} context contexto de Hydrogen
 * @returns {Promise<{families: string[], raw: string}|null>}
 */
export function getBrandColors(context) {
  return memo(context, 'brand', () => leerPaleta(context));
}

/**
 * Los tonos crudos de color que existen en la tienda ("ROJO", "AZUL MARINO",
 * "VERDE PISTACHO"…), de la faceta de color del catálogo completo.
 *
 * Hace falta porque expandir la familia "Rojo" a sus tonos exige saber cuáles
 * existen, y /collections/:handle y /search no tienen ninguna pre-consulta de
 * facetas de donde sacarlos. Cambia con el catálogo, no con el cliente: es una
 * sola entrada compartida, con CacheLong.
 * @param {any} context
 * @returns {Promise<Array<{label: string, count: number}>>}
 */
export function getColorVocabulary(context) {
  return memo(context, 'vocabulario', async () => {
    try {
      const res = await context.storefront.query(GI_CATALOG_SEARCH_QUERY, {
        cache: CacheLong(),
        variables: {
          query: '*',
          productFilters: null,
          sortKey: 'RELEVANCE',
          reverse: false,
          first: 1,
        },
      });
      const facetas = res?.search?.productFilters || [];
      return (facetas.find((f) => f.id === FACET_COLOR)?.values || []).filter(
        (v) => v.count > 0,
      );
    } catch (error) {
      // Sin vocabulario no se puede expandir ninguna familia. Devolver [] hace
      // que brandProductFilters emita el filtro imposible y el cliente vea 0
      // productos — es preferible a enseñarle el catálogo de otro.
      console.error('[brand-colors] no se pudo leer el vocabulario de color:', error);
      return [];
    }
  });
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `npx vitest run app/lib/brand-colors.server.test.js`
Expected: PASS, 8 tests

- [ ] **Step 6: Verificar que la aplicación sigue arrancando**

Run: `npm run dev`
Expected: arranca sin errores. Abrir `http://localhost:3000/catalogo` y comprobar que carga igual que antes (todavía no se aplica ningún filtro). Cortar con Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add app/lib/brand-colors.server.js app/lib/brand-colors.server.test.js app/lib/context.js
git commit -m "feat(colores): resolución de la paleta en servidor, con memo y caché"
```

---

### Task 5: El catálogo

La superficie principal, y la única con panel de filtros. Aquí también se retira la pre-consulta de vocabulario que sobra.

**Files:**
- Modify: `app/lib/filters.js` (opción `colorObligatorio` en `buildProductFilters`)
- Modify: `app/routes/catalogo.jsx` (loader completo + estado vacío)
- Test: `app/lib/filters.test.js` (casos añadidos), `app/routes/catalogo.brandColors.test.js` (nuevo)

**Interfaces:**
- Consumes: `getBrandColors`, `getColorVocabulary` (Task 4); `effectiveColorFamilies`, `visibleColorSelection` (Task 2)
- Produces: el loader devuelve un campo nuevo `marcaColores: string[]` junto a `products`, `totalCount`, `filtros` y `facetas`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `app/lib/filters.test.js`:

```javascript
describe('buildProductFilters · colorObligatorio', () => {
  const FAMILIAS = [{family: 'rojo', values: ['ROJO', 'VINO']}];

  it('sin la opción, una familia sin tonos simplemente no filtra', () => {
    expect(buildProductFilters({color: ['morado']}, FAMILIAS)).toBeNull();
  });

  /* Un cliente con paleta no puede caer en "no filtro nada": eso le enseñaría
     el catálogo entero, que es justo lo contrario de lo que se le prometió. */
  it('con la opción, una familia sin tonos devuelve un filtro imposible', () => {
    const out = buildProductFilters({color: ['morado']}, FAMILIAS, {colorObligatorio: true});
    expect(out).toEqual([{variantOption: {name: 'color', value: 'GI-SIN-COINCIDENCIA'}}]);
  });

  it('con la opción y tonos disponibles, filtra normal', () => {
    const out = buildProductFilters({color: ['rojo']}, FAMILIAS, {colorObligatorio: true});
    expect(out).toEqual([
      {variantOption: {name: 'color', value: 'ROJO'}},
      {variantOption: {name: 'color', value: 'VINO'}},
    ]);
  });
});
```

Y crear `app/routes/catalogo.brandColors.test.js`:

```javascript
import {describe, it, expect, vi, beforeEach} from 'vitest';

const storefrontQuery = vi.fn();
vi.mock('@shopify/hydrogen', () => ({
  getPaginationVariables: () => ({first: 24, endCursor: null}),
  Pagination: () => null,
}));

const getBrandColors = vi.fn();
const getColorVocabulary = vi.fn();
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: (...a) => getBrandColors(...a),
  getColorVocabulary: (...a) => getColorVocabulary(...a),
}));

import {loader} from './catalogo.jsx';

const VOCABULARIO = [
  {label: 'ROJO', count: 66},
  {label: 'NEGRO', count: 61},
  {label: 'VERDE', count: 18},
];

const context = {storefront: {query: (...a) => storefrontQuery(...a)}, session: {}};
const pedir = (url) => loader({context, request: new Request('https://gi.test' + url)});

/** Los valores de color de los productFilters de la última consulta. */
const coloresPedidos = () => {
  const [, opciones] = storefrontQuery.mock.calls.at(-1);
  return (opciones.variables.productFilters || [])
    .filter((f) => f.variantOption)
    .map((f) => f.variantOption.value);
};

beforeEach(() => {
  storefrontQuery.mockReset();
  storefrontQuery.mockResolvedValue({
    search: {
      totalCount: 0,
      nodes: [],
      productFilters: [],
      pageInfo: {hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null},
    },
  });
  getBrandColors.mockReset();
  getColorVocabulary.mockReset();
  getColorVocabulary.mockResolvedValue(VOCABULARIO);
});

describe('catálogo · colores de marca', () => {
  it('un cliente sin paleta consulta sin filtro de color', async () => {
    getBrandColors.mockResolvedValue(null);
    const out = await pedir('/catalogo');
    expect(coloresPedidos()).toEqual([]);
    expect(out.marcaColores).toEqual([]);
  });

  it('un cliente con paleta consulta sólo sus tonos', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo', 'negro'], raw: '["Rojo","Negro"]'});
    const out = await pedir('/catalogo');
    expect(coloresPedidos().sort()).toEqual(['NEGRO', 'ROJO']);
    expect(out.marcaColores).toEqual(['rojo', 'negro']);
  });

  it('elegir un color de su paleta lo estrecha a ese', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo', 'negro'], raw: '["Rojo","Negro"]'});
    await pedir('/catalogo?color=rojo');
    expect(coloresPedidos()).toEqual(['ROJO']);
  });

  /* Forzoso, sin escape: no hay URL que saque al cliente de su paleta. */
  it('pedir un color ajeno por URL no lo saca de su paleta', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo', 'negro'], raw: '["Rojo","Negro"]'});
    const out = await pedir('/catalogo?color=verde');
    expect(coloresPedidos().sort()).toEqual(['NEGRO', 'ROJO']);
    // Y el chip no promete un verde que no se está aplicando.
    expect(out.filtros.color).toEqual([]);
  });

  it('el panel sólo ofrece los colores de su paleta', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    storefrontQuery.mockResolvedValue({
      search: {
        totalCount: 1,
        nodes: [],
        productFilters: [
          {
            id: 'filter.v.option.color',
            values: [
              {label: 'ROJO', count: 10},
              {label: 'VERDE', count: 4},
            ],
          },
        ],
        pageInfo: {hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null},
      },
    });
    const out = await pedir('/catalogo');
    expect(out.facetas.colores.map((c) => c.family)).toEqual(['rojo']);
  });

  it('la paleta también viaja en la ruta por colección', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    storefrontQuery.mockResolvedValue({collection: null});
    await pedir('/catalogo?cat=textil');
    expect(coloresPedidos()).toEqual(['ROJO']);
  });

  /* Ya no hace falta una pre-consulta para descubrir el vocabulario: viene
     cacheado. Una sola consulta por carga. */
  it('no hace una consulta extra para el vocabulario de color', async () => {
    getBrandColors.mockResolvedValue(null);
    await pedir('/catalogo?color=rojo');
    expect(storefrontQuery).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run app/routes/catalogo.brandColors.test.js app/lib/filters.test.js`
Expected: FAIL — el loader no devuelve `marcaColores` y `buildProductFilters` no acepta el tercer argumento

- [ ] **Step 3: Añadir `colorObligatorio` a `buildProductFilters`**

En `app/lib/filters.js`. `SIN_COINCIDENCIA` ya está exportada desde la Task 2;
aquí sólo se usa. Cambiar la firma y el bucle de color:

```javascript
export function buildProductFilters(filters, colorFamilies = [], {colorObligatorio = false} = {}) {
  const out = [];

  let tonosDeColor = 0;
  for (const familyId of filters.color || []) {
    const fam = colorFamilies.find((f) => f.family === familyId);
    // Una familia que no está en el resultado actual no aporta ningún tono:
    // añadir un filtro inventado vaciaría la búsqueda en vez de no filtrar.
    if (!fam) continue;
    for (const value of fam.values) {
      out.push({variantOption: {name: 'color', value}});
      tonosDeColor += 1;
    }
  }
  if (colorObligatorio && tonosDeColor === 0) out.push(SIN_COINCIDENCIA);

  // …el resto de la función (talla, material, tecnica, precio, disponibles)
  // se queda exactamente igual.
```

- [ ] **Step 4: Reescribir el loader del catálogo**

En `app/routes/catalogo.jsx`. Añadir a los imports:

```javascript
import {getBrandColors, getColorVocabulary} from '~/lib/brand-colors.server';
import {effectiveColorFamilies, visibleColorSelection} from '~/lib/brand-colors';
```

Sustituir el loader entero por:

```javascript
export async function loader({context, request}) {
  const {storefront} = context;
  const url = new URL(request.url);
  const filtros = parseFilterParams(url.searchParams);
  const paginationVariables = getPaginationVariables(request, {pageBy: 24});
  const sortDef = SORTS[filtros.sort];

  /* La paleta del cliente y el vocabulario de color de la tienda son
     independientes entre sí, así que van en paralelo. Los dos vienen
     cacheados: en la práctica no cuestan un round trip. */
  const [marca, vocabulario] = await Promise.all([
    getBrandColors(context),
    getColorVocabulary(context),
  ]);
  const marcaColores = marca?.families || [];

  /* Dos vistas del mismo filtro de color, y la diferencia importa:
       - `efectivos` es lo que se consulta. Con paleta, nunca sale de ella.
       - `visibles` es lo que se pinta como chip. La paleta no aparece: es el
         suelo del catálogo, no un filtro aplicado, y una x que no quitara nada
         mentiría. Lo que el usuario pidió fuera de su paleta se borra. */
  const filtrosEfectivos = {
    ...filtros,
    color: effectiveColorFamilies(filtros.color, marcaColores),
  };
  const filtrosVisibles = {
    ...filtros,
    color: visibleColorSelection(filtros.color, marcaColores),
  };

  const fuente = resolveCatalogSource(filtrosEfectivos);
  const consultaBase = {
    query: buildSearchQuery(filtrosEfectivos),
    sortKey: sortDef.sortKey,
    reverse: sortDef.reverse,
  };

  const buscar = (variables, etiqueta, consulta = GI_CATALOG_SEARCH_QUERY) =>
    storefront.query(consulta, {variables}).catch((error) => {
      console.error(`[catalogo] búsqueda (${etiqueta}) falló:`, error);
      return null;
    });

  /* El vocabulario de color solía pedirse con una consulta extra ("para
     construir el filtro hace falta una respuesta previa"). Ahora viene de
     getColorVocabulary, cacheado y compartido por todas las rutas, así que el
     catálogo se resuelve con una sola consulta. */
  const productFilters = buildProductFilters(
    filtrosEfectivos,
    groupColorValues(vocabulario),
    {colorObligatorio: marcaColores.length > 0},
  );

  /* La categoría se resuelve por colección porque `search(query:"tag:...")` no
     filtra: sólo pesa en la relevancia, y al cruzarla con cualquier otro filtro
     se cuelan productos de otras categorías. La colección no acepta texto libre,
     así que en cuanto hay `q` se vuelve a `search` y la categoría deja de
     aplicarse — `appliedFilters` la quita de los chips para no mentir. */
  const res =
    fuente.modo === 'coleccion'
      ? await buscar(
          {
            handle: fuente.handle,
            productFilters,
            sortKey: sortDef.sortKey === 'PRICE' ? 'PRICE' : 'RELEVANCE',
            reverse: sortDef.reverse,
            ...paginationVariables,
          },
          'resultados (colección)',
          GI_CATALOG_COLLECTION_QUERY,
        )
      : await buscar({...consultaBase, productFilters, ...paginationVariables}, 'resultados');

  const coleccion = res?.collection;
  const resultado = fuente.modo === 'coleccion' ? coleccion?.products : res?.search;
  const facetasCrudas =
    (fuente.modo === 'coleccion' ? resultado?.filters : resultado?.productFilters) || [];

  /* Todas las facetas salen de la consulta ya filtrada para que sus conteos
     reflejen lo aplicado. La de color es la excepción aparente: Shopify no
     estrecha una faceta con su propio filtro, así que aquí sigue llegando el
     vocabulario completo y los demás colores se pueden seguir eligiendo — salvo
     que el cliente tenga paleta, en cuyo caso el panel sólo ofrece la suya. */
  const colores = groupColorValues(
    (facetasCrudas.find((f) => f.id === FACET.color)?.values || []).filter((v) => v.count > 0),
  ).filter((c) => !marcaColores.length || marcaColores.includes(c.family));

  return {
    products: resultado
      ? {nodes: resultado.nodes || [], pageInfo: {...EMPTY.pageInfo, ...resultado.pageInfo}}
      : EMPTY,
    // La colección no expone total: se marca como desconocido en vez de
    // enseñar un 0 que sería falso.
    totalCount: fuente.modo === 'coleccion' ? null : (resultado?.totalCount ?? 0),
    filtros: appliedFilters(filtrosVisibles),
    marcaColores,
    facetas: {
      colores,
      materiales: listaDe(facetasCrudas, FACET.material),
      tecnicas: listaDe(facetasCrudas, FACET.tecnica),
      tallas: listaDe(facetasCrudas, FACET.talla),
    },
  };
}
```

- [ ] **Step 5: Estado vacío propio en el componente**

En `app/routes/catalogo.jsx`, en `export default function Catalogo()`, cambiar la desestructuración del loader:

```javascript
  const {products, totalCount, filtros, facetas, marcaColores = []} = useLoaderData();
```

Y dentro del bloque `visible.length === 0`, sustituir el `<p>` por:

```jsx
                      <p>
                        {marcaColores.length > 0
                          ? 'No hay productos en los colores de tu marca con estos filtros. Prueba a quitar alguno.'
                          : hayFiltros
                            ? 'Ninguna combinación de estos filtros devuelve productos. Prueba a quitar alguno.'
                            : 'Intenta con otras palabras de búsqueda.'}
                      </p>
```

- [ ] **Step 6: Correr los tests**

Run: `npx vitest run app/routes/catalogo.brandColors.test.js app/routes/catalogo.paginacion.test.js app/lib/filters.test.js`
Expected: PASS. `catalogo.paginacion.test.js` es la red de seguridad de que no hay regresión — si falla, el loader rompió algo que ya funcionaba.

- [ ] **Step 7: Commit**

```bash
git add app/lib/filters.js app/lib/filters.test.js app/routes/catalogo.jsx app/routes/catalogo.brandColors.test.js
git commit -m "feat(catalogo): el cliente con paleta de marca sólo ve sus colores"
```

---

### Task 6: Colecciones y búsqueda normal (filtrado nativo)

Las dos consultas que ya soportan facetas y sólo les falta la variable.

**Files:**
- Modify: `app/routes/collections.$handle.jsx`
- Modify: `app/routes/search.jsx` (`SEARCH_QUERY` y `regularSearch`)
- Test: `app/routes/collections.brandColors.test.js` (nuevo)

**Interfaces:**
- Consumes: `getBrandColors`, `getColorVocabulary` (Task 4); `brandProductFilters` (Task 2)
- Produces: nada nuevo hacia otras tareas

- [ ] **Step 1: Escribir el test que falla**

```javascript
// app/routes/collections.brandColors.test.js
import {describe, it, expect, vi, beforeEach} from 'vitest';

/* Sin mock de @shopify/hydrogen: el módulo real importa bien bajo Vitest, y un
   mock parcial se rompe en cuanto un componente importado de paso necesita algo
   que no está en él. Esta prueba no mira la paginación, sólo los filtros. */
const storefrontQuery = vi.fn();

const getBrandColors = vi.fn();
const getColorVocabulary = vi.fn();
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: (...a) => getBrandColors(...a),
  getColorVocabulary: (...a) => getColorVocabulary(...a),
}));

import {loader} from './collections.$handle.jsx';

const context = {storefront: {query: (...a) => storefrontQuery(...a)}, session: {}};
const pedir = () =>
  loader({
    context,
    params: {handle: 'textil'},
    request: new Request('https://gi.test/collections/textil'),
  });

beforeEach(() => {
  storefrontQuery.mockReset();
  storefrontQuery.mockResolvedValue({
    collection: {
      id: 'gid://c/1',
      handle: 'textil',
      title: 'Textil',
      products: {nodes: [], pageInfo: {}},
    },
  });
  getBrandColors.mockReset();
  getColorVocabulary.mockReset();
  getColorVocabulary.mockResolvedValue([
    {label: 'ROJO', count: 66},
    {label: 'VERDE', count: 18},
  ]);
});

describe('colección · colores de marca', () => {
  it('sin paleta no manda filtros', async () => {
    getBrandColors.mockResolvedValue(null);
    await pedir();
    const [, opciones] = storefrontQuery.mock.calls[0];
    expect(opciones.variables.filters).toBeNull();
  });

  it('con paleta manda sólo sus tonos', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    await pedir();
    const [, opciones] = storefrontQuery.mock.calls[0];
    expect(opciones.variables.filters).toEqual([{variantOption: {name: 'color', value: 'ROJO'}}]);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/routes/collections.brandColors.test.js`
Expected: FAIL — `variables.filters` es `undefined`

- [ ] **Step 3: Añadir `$filters` a la colección**

En `app/routes/collections.$handle.jsx`. Imports:

```javascript
import {getBrandColors, getColorVocabulary} from '~/lib/brand-colors.server';
import {brandProductFilters} from '~/lib/brand-colors';
```

Loader:

```javascript
export async function loader(args) {
  const {handle} = args.params;
  const {context, request} = args;
  if (!handle) throw redirect('/collections');

  const paginationVariables = getPaginationVariables(request, {pageBy: 24});

  // Un cliente con paleta de marca sólo ve, también aquí, lo que puede pedir
  // en sus colores.
  const [marca, vocabulario] = await Promise.all([
    getBrandColors(context),
    getColorVocabulary(context),
  ]);
  const filters = brandProductFilters(marca?.families || [], vocabulario);

  const {collection} = await context.storefront.query(COLLECTION_QUERY, {
    variables: {handle, filters, ...paginationVariables},
  });

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {status: 404});
  }

  return {collection, origin: new URL(request.url).origin};
}
```

Y en `COLLECTION_QUERY`, añadir la variable y pasarla a `products`:

```graphql
  query GiCollection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $filters: [ProductFilter!]
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image { url altText width height }
      products(
        filters: $filters
        first: $first
        last: $last
        before: $startCursor
        after: $endCursor
      ) {
```

- [ ] **Step 4: Añadir `$productFilters` a la búsqueda normal**

En `app/routes/search.jsx`. Imports:

```javascript
import {getBrandColors, getColorVocabulary} from '~/lib/brand-colors.server';
import {brandProductFilters, keepBrandProducts} from '~/lib/brand-colors';
```

En `SEARCH_QUERY`, añadir la variable a la lista y pasarla **sólo** al bloque `products:` (los bloques `articles:` y `pages:` no son productos y `ProductFilter` no aplica ahí):

```graphql
  query RegularSearch(
    $country: CountryCode
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $term: String!
    $startCursor: String
    $productFilters: [ProductFilter!]
  ) @inContext(country: $country, language: $language) {
```

```graphql
    products: search(
      after: $endCursor,
      before: $startCursor,
      first: $first,
      last: $last,
      query: $term,
      productFilters: $productFilters,
      sortKey: RELEVANCE,
      types: [PRODUCT],
      unavailableProducts: HIDE,
    ) {
```

Y en `regularSearch`, antes de la consulta:

```javascript
  const [marca, vocabulario] = await Promise.all([
    getBrandColors(context),
    getColorVocabulary(context),
  ]);
  const productFilters = brandProductFilters(marca?.families || [], vocabulario);

  // Search articles, pages, and products for the `q` term
  const {errors, ...items} = await storefront.query(SEARCH_QUERY, {
    variables: {...variables, term, productFilters},
  });
```

- [ ] **Step 5: Correr los tests**

Run: `npx vitest run app/routes/`
Expected: PASS — todos los tests de rutas

- [ ] **Step 6: Verificación manual**

```bash
npm run dev
```

Sin sesión: `/collections/textil` y `/search?q=termo` cargan como siempre. Cortar con Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add app/routes/collections.\$handle.jsx app/routes/search.jsx app/routes/collections.brandColors.test.js
git commit -m "feat(colores): colecciones y búsqueda filtran por la paleta del cliente"
```

---

### Task 7: Las superficies de post-filtro

Cuatro listas cortas donde la Storefront API no acepta facetas. Al no tener paginación propia, filtrarlas en memoria no rompe conteos ni cursores.

**Files:**
- Modify: `app/routes/_index.jsx` (home)
- Modify: `app/routes/search.jsx` (`PREDICTIVE_SEARCH_PRODUCT_FRAGMENT` y `predictiveSearch`)
- Modify: `app/routes/products.$handle.jsx` (recomendaciones)
- Modify: `app/routes/account.favoritos.jsx` (`FAVORITOS_QUERY` y loader)
- Test: `app/routes/_index.brandColors.test.js` (nuevo), `app/routes/account.favoritos.helper.test.js` (casos añadidos)

**Interfaces:**
- Consumes: `getBrandColors` (Task 4), `keepBrandProducts` (Task 2)
- Produces: `products.$handle.jsx` devuelve `marcaColores: string[]` en su loader — lo consume la Task 9

- [ ] **Step 1: Escribir el test que falla**

```javascript
// app/routes/_index.brandColors.test.js
import {describe, it, expect, vi, beforeEach} from 'vitest';

/* Sin mock de @shopify/hydrogen: _index.jsx no lo importa directamente, y
   mockearlo a medias rompería a los componentes que sí lo hacen de paso. */
const storefrontQuery = vi.fn();

const getBrandColors = vi.fn();
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: (...a) => getBrandColors(...a),
  getColorVocabulary: vi.fn(async () => []),
}));

vi.mock('~/lib/giFragments', async (original) => ({
  ...(await original()),
  fetchCollectionCards: vi.fn(async () => []),
}));

import {loader} from './_index.jsx';

const producto = (id, colors) => ({
  id,
  handle: `p-${id}`,
  title: `P${id}`,
  featuredImage: {url: `https://img/${id}.jpg`, altText: ''},
  priceRange: {minVariantPrice: {amount: '10.0', currencyCode: 'MXN'}},
  options: [{name: 'Color', optionValues: colors.map((name) => ({name}))}],
  variants: {nodes: [{id: `v-${id}`, availableForSale: true}]},
});

const context = {
  storefront: {query: (...a) => storefrontQuery(...a)},
  session: {},
  env: {PUBLIC_STORE_DOMAIN: 'x.myshopify.com'},
};

beforeEach(() => {
  storefrontQuery.mockReset();
  storefrontQuery.mockResolvedValue({
    products: {nodes: [producto('1', ['ROJO']), producto('2', ['VERDE'])]},
  });
  getBrandColors.mockReset();
});

describe('home · colores de marca', () => {
  it('sin paleta muestra todo', async () => {
    getBrandColors.mockResolvedValue(null);
    const out = await loader({context, request: new Request('https://gi.test/')});
    expect(out.products.map((p) => p.id)).toEqual(['1', '2']);
  });

  it('con paleta deja sólo los que se pueden pedir en sus colores', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    const out = await loader({context, request: new Request('https://gi.test/')});
    expect(out.products.map((p) => p.id)).toEqual(['1']);
  });

  /* El post-filtro se come parte de la tira, así que hay que sobre-pedir para
     que a un cliente con paleta no le queden cuatro productos. */
  it('pide de más para poder recortar', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    await loader({context, request: new Request('https://gi.test/')});
    const [, opciones] = storefrontQuery.mock.calls[0];
    expect(opciones.variables.first).toBe(60);
  });
});
```

Y añadir a `app/routes/account.favoritos.helper.test.js`:

```javascript
import {keepBrandProducts} from '~/lib/brand-colors';

describe('favoritos · colores de marca', () => {
  /* Un favorito guardado antes de que le asignaran la paleta puede quedar
     fuera de ella. Se oculta como en cualquier otra lista. */
  it('un favorito fuera de la paleta desaparece de la lista', () => {
    const favoritos = [
      {id: '1', colors: ['ROJO']},
      {id: '2', colors: ['VERDE']},
    ];
    expect(keepBrandProducts(favoritos, ['rojo']).map((p) => p.id)).toEqual(['1']);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npx vitest run app/routes/_index.brandColors.test.js`
Expected: FAIL — `variables.first` es 16 y la lista no se filtra

- [ ] **Step 3: El home**

En `app/routes/_index.jsx`. Imports:

```javascript
import {getBrandColors} from '~/lib/brand-colors.server';
import {keepBrandProducts} from '~/lib/brand-colors';
```

Y en `loadCriticalData`:

```javascript
async function loadCriticalData({context}) {
  const {storefront} = context;

  const [categories, featuredCollections, productsRes, marca] = await Promise.all([
    fetchCollectionCards(storefront, HOME_CATEGORIES.map((c) => c.handle)),
    fetchCollectionCards(storefront, HOME_FEATURED_COLLECTIONS),
    /* La tira es de "más vendidos", y ese orden sólo existe en
       `products(sortKey: BEST_SELLING)`: SearchSortKeys se queda en PRICE y
       RELEVANCE, así que migrar a `search` para ganar las facetas destruiría
       el criterio de la sección. Se filtra en memoria y se sobre-pide para
       que a un cliente con paleta no le queden cuatro productos. */
    storefront.query(GI_PRODUCTS_QUERY, {
      variables: {first: 60, sortKey: 'BEST_SELLING'},
    }),
    getBrandColors(context),
  ]);

  const products = keepBrandProducts(
    (productsRes?.products?.nodes || []).map(normalizeProduct).filter(Boolean),
    marca?.families || [],
  ).slice(0, 16);
```

- [ ] **Step 4: La búsqueda predictiva**

En `app/routes/search.jsx`. `predictiveSearch` no acepta facetas, así que el producto tiene que traer sus colores para poder filtrarlo aquí. Añadir al final de `PREDICTIVE_SEARCH_PRODUCT_FRAGMENT`, antes de la llave de cierre del fragment:

```graphql
    options { name optionValues { name } }
```

Y en `predictiveSearch`, después de las comprobaciones de `errors` e `items`, sustituir el cálculo de `total` y el return por:

```javascript
  // predictiveSearch no acepta productFilters: el recorte por paleta se hace
  // aquí, sobre una lista de 6-10 elementos que ya trae sus colores.
  const marca = await getBrandColors(context);
  const filtrados = {
    ...items,
    products: keepBrandProducts(items.products || [], marca?.families || []),
  };

  const total = Object.values(filtrados).reduce((acc, item) => acc + item.length, 0);

  return {type, term, result: {items: filtrados, total}};
```

- [ ] **Step 5: Las recomendaciones de la ficha**

En `app/routes/products.$handle.jsx`. Imports:

```javascript
import {getBrandColors} from '~/lib/brand-colors.server';
import {keepBrandProducts} from '~/lib/brand-colors';
```

Y en `loadCriticalData`, cambiar el `Promise.all` de stock y recomendaciones:

```javascript
  const [stock, recomendacionesCrudas, marca] = await Promise.all([
    getVariantInventory(context.env, product.selectedOrFirstAvailableVariant?.id),
    storefront
      .query(GI_PRODUCT_RECOMMENDATIONS_QUERY, {variables: {productId: product.id}})
      .then((r) =>
        (r?.productRecommendations || [])
          .map(normalizeProduct)
          .filter((p) => p && p.id !== product.id),
      )
      .catch(() => []),
    getBrandColors(context),
  ]);

  const marcaColores = marca?.families || [];
  // productRecommendations no acepta facetas: se recorta aquí. Es una tira
  // corta, así que no hay paginación ni conteo que romper.
  const recommendations = keepBrandProducts(recomendacionesCrudas, marcaColores);

  return {
    product,
    stock,
    recommendations,
    marcaColores,
    origin: new URL(request.url).origin,
  };
```

- [ ] **Step 6: Los favoritos**

En `app/routes/account.favoritos.jsx`. `nodes(ids:)` no acepta facetas y la consulta no pedía los colores: hay que añadirlos. En `FAVORITOS_QUERY`, dentro de `... on Product`:

```graphql
        options { name optionValues { name } }
```

Imports:

```javascript
import {getBrandColors} from '~/lib/brand-colors.server';
import {keepBrandProducts} from '~/lib/brand-colors';
```

Y el final del loader:

```javascript
  const [{nodes}, marca] = await Promise.all([
    context.storefront.query(FAVORITOS_QUERY, {variables: {ids}}),
    getBrandColors(context),
  ]);
  // Un favorito guardado antes de que le asignaran la paleta puede quedar
  // fuera de ella; se oculta como en cualquier otra lista.
  const products = keepBrandProducts(
    keepProducts(nodes).map((node) => normalizeProduct(node)).filter(Boolean),
    marca?.families || [],
  );
  return {products};
```

- [ ] **Step 7: Correr los tests**

Run: `npx vitest run`
Expected: PASS — la suite entera

- [ ] **Step 8: Commit**

```bash
git add app/routes/_index.jsx app/routes/search.jsx app/routes/products.\$handle.jsx app/routes/account.favoritos.jsx app/routes/_index.brandColors.test.js app/routes/account.favoritos.helper.test.js
git commit -m "feat(colores): home, predictiva, similares y favoritos respetan la paleta"
```

---

### Task 8: La tira de vistos recientemente (cliente)

La única superficie que no pasa por un loader: vive en `localStorage`.

**Files:**
- Modify: `app/root.jsx` (exponer la paleta al cliente)
- Modify: `app/lib/AppContext.jsx` (prop y valor de contexto)
- Modify: `app/components/gi/RecentlyViewed.jsx`
- Test: `app/components/gi/RecentlyViewed.test.jsx` (nuevo)

**Interfaces:**
- Consumes: `getBrandColors` (Task 4), `productMatchesBrand` (Task 2)
- Produces: `useApp().brandColors → string[]`

- [ ] **Step 1: Escribir el test que falla**

```javascript
// @vitest-environment jsdom
// app/components/gi/RecentlyViewed.test.jsx
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen} from '@testing-library/react';

const brandColors = {value: []};
vi.mock('~/lib/AppContext', () => ({
  useApp: () => ({brandColors: brandColors.value, isLoggedIn: false, favs: [], toggleFav: () => {}}),
  useToast: () => () => {},
}));

vi.mock('~/components/gi/ProductCard', () => ({
  ProductCard: ({product}) => <div data-testid="card">{product.title}</div>,
}));

import {RecentlyViewed} from './RecentlyViewed.jsx';

const HISTORIAL = [
  {id: '1', title: 'Rojo', image: 'https://img/1.jpg', colors: ['ROJO']},
  {id: '2', title: 'Verde', image: 'https://img/2.jpg', colors: ['VERDE']},
];

beforeEach(() => {
  window.localStorage.setItem('gi_recently_viewed', JSON.stringify(HISTORIAL));
  brandColors.value = [];
});

describe('RecentlyViewed · colores de marca', () => {
  it('sin paleta muestra todo el historial', () => {
    render(<RecentlyViewed current={{id: '99'}} />);
    expect(screen.getAllByTestId('card')).toHaveLength(2);
  });

  /* El historial es de localStorage y puede traer productos vistos antes de
     que le asignaran la paleta, o desde otra cuenta en el mismo navegador. */
  it('con paleta oculta lo que está fuera de ella', () => {
    brandColors.value = ['rojo'];
    render(<RecentlyViewed current={{id: '99'}} />);
    expect(screen.getAllByTestId('card')).toHaveLength(1);
    expect(screen.getByText('Rojo')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/components/gi/RecentlyViewed.test.jsx`
Expected: FAIL — el segundo caso muestra 2 tarjetas

- [ ] **Step 3: Exponer la paleta desde root**

En `app/root.jsx`. Import:

```javascript
import {getBrandColors} from '~/lib/brand-colors.server';
```

En `loadCriticalData`, añadir la paleta al `Promise.all` que ya está:

```javascript
  const [header, marca] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: 'main-menu', // Adjust to your header menu handle
      },
    }),
    // La tira de "vistos recientemente" vive en localStorage y se pinta en
    // cliente: necesita la paleta para no enseñar lo que ninguna lista
    // enseñaría. El memo por request hace que esto no cueste una llamada extra.
    getBrandColors(context),
  ]);
```

Y en el return:

```javascript
  return {
    header,
    isLoggedIn: Boolean(sessionUser),
    brandColors: marca?.families || [],
    favs,
    quote,
  };
```

Y en el componente, pasarlo al provider:

```jsx
      <AppProvider
        isLoggedIn={data.isLoggedIn}
        brandColors={data.brandColors}
        quote={data.quote}
        favs={data.favs}
      >
```

- [ ] **Step 4: Pasarlo por AppContext**

En `app/lib/AppContext.jsx`, en la firma de `AppProvider`:

```javascript
export function AppProvider({
  children,
  isLoggedIn = false,
  brandColors = [],
  quote: quoteProp = [],
  favs: favsProp = [],
}) {
```

Y en el objeto `value`, junto a `isLoggedIn`:

```javascript
    isLoggedIn,
    brandColors,
```

- [ ] **Step 5: Filtrar la tira**

En `app/components/gi/RecentlyViewed.jsx`. Imports:

```javascript
import {useApp} from '~/lib/AppContext';
import {productMatchesBrand} from '~/lib/brand-colors';
```

Y dentro del componente:

```javascript
export function RecentlyViewed({current, max = 4}) {
  const [items, setItems] = useState([]);
  const {brandColors = []} = useApp();

  useEffect(() => {
    if (current?.id) pushRecentlyViewed(current);
    // Client requirement: hide products with no image everywhere, including
    // this history strip (it builds its own snapshot shape in
    // products.$handle.jsx, bypassing normalizeProduct — see recentSnapshot).
    // El historial es de localStorage: puede traer productos vistos antes de
    // que le asignaran la paleta, o desde otra cuenta en el mismo navegador.
    setItems(
      getRecentlyViewed(current?.id)
        .filter((p) => p?.image && productMatchesBrand(p, brandColors))
        .slice(0, max),
    );
    // Re-run only when the viewed product changes (not on variant tweaks).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, max, brandColors]);
```

- [ ] **Step 6: Correr los tests**

Run: `npx vitest run`
Expected: PASS — la suite entera

- [ ] **Step 7: Commit**

```bash
git add app/root.jsx app/lib/AppContext.jsx app/components/gi/RecentlyViewed.jsx app/components/gi/RecentlyViewed.test.jsx
git commit -m "feat(colores): la tira de vistos recientemente respeta la paleta"
```

---

### Task 9: El aviso de la ficha de producto

Un producto fuera de la paleta se sigue viendo por URL directa —llega por un correo de la ejecutiva o desde un favorito viejo—, pero se avisa.

**Files:**
- Modify: `app/routes/products.$handle.jsx` (banda de aviso + marcado de swatches)
- Modify: `app/styles/gi-screens.css`
- Test: `app/routes/products.marcaColores.test.js` (nuevo)

**Interfaces:**
- Consumes: `marcaColores` del loader (Task 7), `productMatchesBrand` (Task 2)
- Produces: nada hacia otras tareas. Es la última.

- [ ] **Step 1: Escribir el test que falla**

Este caso es lógica pura sobre el producto, así que se prueba la decisión, no el DOM. Crear `app/routes/products.marcaColores.test.js`:

```javascript
import {describe, it, expect} from 'vitest';
import {productMatchesBrand} from '~/lib/brand-colors';
import {esFueraDeMarca, esTonoDeMarca} from './products.$handle.jsx';

const OPCION_COLOR = {
  name: 'Color',
  optionValues: [{name: 'AZUL'}, {name: 'VERDE'}],
};

describe('ficha · fuera de la paleta', () => {
  it('sin paleta nunca avisa', () => {
    expect(esFueraDeMarca(OPCION_COLOR, [])).toBe(false);
  });

  it('avisa cuando ningún tono es de la paleta', () => {
    expect(esFueraDeMarca(OPCION_COLOR, ['rojo'])).toBe(true);
  });

  it('no avisa si alguno sí lo es', () => {
    expect(esFueraDeMarca(OPCION_COLOR, ['azul'])).toBe(false);
  });

  it('un producto sin opción de color no dispara el aviso', () => {
    expect(esFueraDeMarca(undefined, ['rojo'])).toBe(false);
  });
});

describe('ficha · marcado de tonos', () => {
  it('marca los tonos que no son de la paleta', () => {
    expect(esTonoDeMarca('AZUL', ['azul'])).toBe(true);
    expect(esTonoDeMarca('VERDE', ['azul'])).toBe(false);
  });

  it('sin paleta todos los tonos valen', () => {
    expect(esTonoDeMarca('VERDE', [])).toBe(true);
  });
});

/* Coherencia con el resto de la aplicación: si el producto no aparece en
   ninguna lista, la ficha tiene que avisarlo. */
describe('ficha · coherente con los listados', () => {
  it('avisa exactamente cuando el producto no pasaría el post-filtro', () => {
    const producto = {colors: ['AZUL', 'VERDE']};
    expect(esFueraDeMarca(OPCION_COLOR, ['rojo'])).toBe(!productMatchesBrand(producto, ['rojo']));
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run app/routes/products.marcaColores.test.js`
Expected: FAIL — `esFueraDeMarca is not a function`

- [ ] **Step 3: Exportar las dos decisiones y usarlas**

En `app/routes/products.$handle.jsx`, junto a las demás funciones del archivo (fuera del componente), añadir:

```javascript
/* Se exportan para poder probar la decisión sin montar la ficha entera, que
   arrastra media aplicación. */

/**
 * ¿Este producto no se puede pedir en ningún color de la marca? Es la misma
 * pregunta que hace productMatchesBrand en los listados, sobre la forma que
 * tiene aquí el producto (opciones de la Storefront API, no normalizado).
 * @param {{optionValues?: Array<{name: string}>}|undefined} colorOption
 * @param {string[]} marcaColores
 */
export function esFueraDeMarca(colorOption, marcaColores) {
  if (!marcaColores?.length || !colorOption) return false;
  return !productMatchesBrand(
    {colors: (colorOption.optionValues || []).map((v) => v.name)},
    marcaColores,
  );
}

/** ¿Este tono concreto pertenece a la paleta de la marca? */
export function esTonoDeMarca(nombre, marcaColores) {
  if (!marcaColores?.length) return true;
  return productMatchesBrand({colors: [nombre]}, marcaColores);
}
```

Añadir `productMatchesBrand` al import que la Task 7 ya creó:

```javascript
import {keepBrandProducts, productMatchesBrand} from '~/lib/brand-colors';
```

En el componente, leer la paleta y calcular el aviso (junto a donde ya se calcula `colorOption`, línea ~183):

```javascript
  const {product, stock, recommendations = [], marcaColores = []} = useLoaderData();
```

```javascript
  const fueraDeMarca = esFueraDeMarca(colorOption, marcaColores);
```

Pintar la banda justo antes del bloque `{/* VARIANT OPTIONS (color/size as swatches) */}`:

```jsx
          {fueraDeMarca && (
            <div className="pdp-aviso-marca" role="status">
              Este producto no está disponible en los colores de tu marca.
              Puedes cotizarlo igual; tu ejecutiva te confirma las opciones.
            </div>
          )}
```

Y marcar los tonos ajenos dentro del `map` de `option.optionValues`, en la rama `if (isColor)`:

```jsx
                    if (isColor) {
                      const deMarca = esTonoDeMarca(name, marcaColores);
                      return (
                        <Link
                          key={option.name + name}
                          to={`?${variantUriQuery}`}
                          preventScrollReset
                          replace
                          className={`pdp-swatch ${selected ? 'active' : ''} ${deMarca ? '' : 'pdp-swatch-ajeno'}`}
                          style={{'--c': bg, opacity: available ? 1 : 0.3}}
                          title={deMarca ? name : `${name} · fuera de tu marca`}
                          aria-label={deMarca ? name : `${name}, fuera de los colores de tu marca`}
                        />
                      );
                    }
```

- [ ] **Step 4: Los estilos**

Al final de `app/styles/gi-screens.css`:

```css
/* Ficha · producto fuera de la paleta de marca del cliente.
   Avisa sin bloquear: el enlace pudo llegar por correo de la ejecutiva o desde
   un favorito guardado antes de que le asignaran la paleta. */
.pdp-aviso-marca {
  margin: 0 0 20px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  background: var(--bg-soft);
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.5;
}

/* Un tono que no es de su marca sigue siendo elegible, pero se distingue. */
.pdp-swatch-ajeno {
  opacity: 0.45;
}
.pdp-swatch-ajeno::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  border: 1px dashed var(--line);
}
```

- [ ] **Step 5: Correr los tests**

Run: `npx vitest run`
Expected: PASS — la suite entera

- [ ] **Step 6: Verificación manual de extremo a extremo**

```bash
npm run dev
```

Con `igarcia@generandoideas.com` —el único customer que hoy trae `["Rojo","Negro"]`— iniciar sesión y comprobar:

1. `/catalogo` — el panel sólo ofrece Rojo y Negro; ninguna tarjeta sin rojo ni negro.
2. `/catalogo?color=verde` — no se sale de su paleta y no aparece un chip "Verde".
3. `/collections/textil` — recortado.
4. `/search?q=termo` — recortado; la búsqueda predictiva del modal también.
5. Portada — la tira de más vendidos, recortada.
6. `/account/favoritos` — recortado.
7. Una ficha sólo en azul, por URL directa — se ve, con la banda de aviso, y sus swatches marcados.
8. Cerrar sesión y repetir 1-5: todo vuelve a verse completo.

Cortar con Ctrl-C.

- [ ] **Step 7: Lint y suite completa**

Run: `npm run lint && npm test`
Expected: sin errores

- [ ] **Step 8: Commit**

```bash
git add app/routes/products.\$handle.jsx app/routes/products.marcaColores.test.js app/styles/gi-screens.css
git commit -m "feat(colores): la ficha avisa cuando el producto no está en la paleta"
```

---

## Verificación final

- [ ] `npm test` — suite completa en verde
- [ ] `npm run lint` — sin errores
- [ ] El diagnóstico de la Task 1 se corrió y su resultado se comentó con el usuario
- [ ] Un cliente **sin** metafield ve exactamente lo mismo que antes de este cambio, en las nueve superficies
- [ ] Un cliente con `["Rojo","Negro"]` no ve ningún producto sin rojo ni negro en ninguna de ellas
- [ ] Cerrar sesión devuelve el catálogo completo
