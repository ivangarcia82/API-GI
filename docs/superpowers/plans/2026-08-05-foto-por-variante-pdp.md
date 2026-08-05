# Foto por variante en la PDP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que al cambiar de variante en la ficha de producto, la foto principal y la miniatura resaltada pasen a la imagen de esa variante.

**Architecture:** Un helper puro (`app/lib/gallery.js`) empareja por `id` la imagen de la variante con la galería del producto y devuelve su índice, o `0` cuando no se puede emparejar. La ruta `products.$handle.jsx` ajusta su estado `activeImg` **durante el render** cuando cambia el id de la variante, para que la foto salga en el mismo frame que el precio y el SKU.

**Tech Stack:** Shopify Hydrogen 2026.4.2 · React 18 · React Router 7 · Vitest · JavaScript (no TypeScript)

**Spec:** `docs/superpowers/specs/2026-08-05-foto-por-variante-pdp-design.md`

## Global Constraints

- El proyecto es **JavaScript**, no TypeScript. No agregar anotaciones de tipo; documentar con JSDoc como hace `app/lib/specs.js`.
- **No** agregar dependencias nuevas. Todo se resuelve con lo que ya está en `package.json`.
- Los comentarios de código van **en español**, explicando el *porqué* (no el *qué*), como en `app/lib/specs.js` y `app/lib/decoration/`.
- Los tests viven junto al módulo que prueban: `app/lib/<modulo>.test.js`. Vitest los descubre con `include: ['app/**/*.test.{js,jsx}']` y corren en entorno `node`.
- Formato: `@shopify/prettier-config` (comillas simples, sin punto y coma opcional omitido, ancho 80). Verificar con `npm run lint`.
- Fallback obligatorio del spec: **cuando no se puede emparejar, se muestra la primera foto del producto** — nunca se deja en pantalla la foto del color anterior.

---

### Task 1: Helper `resolveVariantImageIndex`

Módulo puro que decide qué foto de la galería corresponde a la variante elegida. Se hace primero y aislado porque es toda la lógica del cambio; la ruta después sólo la conecta.

**Files:**
- Create: `app/lib/gallery.js`
- Test: `app/lib/gallery.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `resolveVariantImageIndex(images, variantImage) → number`, exportada con nombre desde `~/lib/gallery`. `images` es el arreglo `product.images.nodes` (objetos con `id`, `url`, `altText`, `width`, `height`); `variantImage` es `selectedVariant.image` (objeto con `id`, o `null`/`undefined`). Devuelve el índice dentro de `images`, o `0`.

- [ ] **Step 1: Escribir el test que falla**

Crear `app/lib/gallery.test.js`:

```js
import {describe, it, expect} from 'vitest';
import {resolveVariantImageIndex} from './gallery';

const IMG = (n) => `gid://shopify/ProductImage/${n}`;

const galeria = [
  {id: IMG(1), url: 'frente.jpg'},
  {id: IMG(2), url: 'rojo.jpg'},
  {id: IMG(3), url: 'detalle.jpg'},
];

describe('resolveVariantImageIndex — empareja por id', () => {
  it('devuelve la posición de la foto de la variante', () => {
    expect(resolveVariantImageIndex(galeria, {id: IMG(2)})).toBe(1);
    expect(resolveVariantImageIndex(galeria, {id: IMG(3)})).toBe(2);
  });

  it('empareja también la primera foto de la galería', () => {
    expect(resolveVariantImageIndex(galeria, {id: IMG(1)})).toBe(0);
  });
});

/* En esta tienda sólo algunas variantes tienen imagen asignada, así que el
   fallback no es un caso raro: es el camino habitual de media catálogo. */
describe('resolveVariantImageIndex — cae a la primera foto', () => {
  it('cuando la variante no trae imagen', () => {
    expect(resolveVariantImageIndex(galeria, null)).toBe(0);
    expect(resolveVariantImageIndex(galeria, undefined)).toBe(0);
    expect(resolveVariantImageIndex(galeria, {})).toBe(0);
  });

  it('cuando la imagen de la variante no está en la galería', () => {
    expect(resolveVariantImageIndex(galeria, {id: IMG(99)})).toBe(0);
  });

  it('sin emparejar dos ids nulos entre sí', () => {
    // `Image.id` es nullable en la Storefront API. Sin guardia, findIndex
    // emparejaría null con null y devolvería 1 en vez del fallback.
    const conNulo = [{id: IMG(1), url: 'frente.jpg'}, {id: null, url: 'x.jpg'}];
    expect(resolveVariantImageIndex(conNulo, {id: null})).toBe(0);
  });

  it('cuando la galería viene vacía o no es un arreglo', () => {
    expect(resolveVariantImageIndex([], {id: IMG(2)})).toBe(0);
    expect(resolveVariantImageIndex(undefined, {id: IMG(2)})).toBe(0);
    expect(resolveVariantImageIndex(null, {id: IMG(2)})).toBe(0);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run app/lib/gallery.test.js`
Expected: FAIL — `Failed to resolve import "./gallery"` (el módulo todavía no existe).

- [ ] **Step 3: Escribir la implementación mínima**

Crear `app/lib/gallery.js`:

```js
/* Generando Ideas — galería de la PDP.
 *
 * Shopify permite asignar UNA imagen a cada variante, pero en esta tienda
 * sólo algunas la tienen. Cuando no hay con qué emparejar, se vuelve a la
 * primera foto: es preferible enseñar la imagen genérica del producto a
 * dejar en pantalla la del color anterior mientras el selector dice otro.
 */

/**
 * Posición de la imagen de una variante dentro de la galería del producto.
 *
 * @param {Array<{id?: string|null}>|null|undefined} images galería (`product.images.nodes`)
 * @param {{id?: string|null}|null|undefined} variantImage `selectedVariant.image`
 * @returns {number} índice dentro de `images`, o 0 si no se puede emparejar
 */
export function resolveVariantImageIndex(images, variantImage) {
  const id = variantImage?.id;
  if (!id || !Array.isArray(images) || images.length === 0) return 0;
  // `img?.id &&` no es redundante: `Image.id` es nullable en la Storefront
  // API y sin ese guardia dos nulos se emparejarían entre sí.
  const i = images.findIndex((img) => img?.id && img.id === id);
  return i >= 0 ? i : 0;
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run app/lib/gallery.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Correr la suite completa y el linter**

Run: `npm test && npm run lint`
Expected: toda la suite en verde y el linter sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add app/lib/gallery.js app/lib/gallery.test.js
git commit -m "feat(pdp): helper para emparejar la imagen de la variante con la galería"
```

---

### Task 2: Conectar la galería de la PDP a la variante

Cablea el helper en la ruta, pide `id` en la galería, sube el tope a 12 imágenes y pinta todas las miniaturas.

**Files:**
- Modify: `app/routes/products.$handle.jsx` (imports `:16`, estado `:128`, galería `:258` y `:262`, query `:702`)

**Interfaces:**
- Consumes: `resolveVariantImageIndex(images, variantImage) → number` de `~/lib/gallery` (Task 1).
- Produces: nada que consuman tareas posteriores.

- [ ] **Step 1: Importar el helper**

En `app/routes/products.$handle.jsx`, después de la línea 16 (`import {buildProductSpecs} from '~/lib/specs';`) agregar:

```js
import {resolveVariantImageIndex} from '~/lib/gallery';
```

- [ ] **Step 2: Pedir `id` y subir el tope de imágenes en la query**

En `PRODUCT_FRAGMENT` (≈línea 702), reemplazar:

```graphql
    images(first: 6) { nodes { url altText width height } }
```

por:

```graphql
    images(first: 12) { nodes { id url altText width height } }
```

Sin `id` no hay llave de emparejamiento; con tope 6 la foto de una variante puede quedar fuera de la galería en productos con varios colores más fotos de detalle.

- [ ] **Step 3: Sincronizar `activeImg` con la variante**

En el cuerpo del componente (≈línea 128), reemplazar:

```js
  const [activeImg, setActiveImg] = useState(0);
```

por:

```js
  const [activeImg, setActiveImg] = useState(0);
  /* Al cambiar de variante, la galería salta a la foto de esa variante.
     El estado se ajusta durante el render —no en un useEffect— para que la
     foto salga en el mismo frame que el precio y el SKU; con useEffect habría
     un frame intermedio con la foto anterior, justo el parpadeo que estamos
     corrigiendo. Un clic manual en una miniatura manda sobre esto hasta el
     siguiente cambio de variante, porque syncedVariantId no se mueve. */
  const [syncedVariantId, setSyncedVariantId] = useState(selectedVariant?.id);
  if (selectedVariant?.id !== syncedVariantId) {
    setSyncedVariantId(selectedVariant?.id);
    setActiveImg(resolveVariantImageIndex(images, selectedVariant?.image));
  }
```

El orden importa y ya se cumple en el archivo: `selectedVariant` se define en la línea 104 y `images` en la 120, ambos antes de este bloque. Los dos `useState` quedan incondicionales; sólo la asignación está dentro del `if`.

- [ ] **Step 4: Remontar la imagen principal para que haga fundido**

En el bloque `.pdp-main` (≈línea 258), reemplazar:

```jsx
            <PH src={mainImage} alt={product.title} aspect="ph-square" />
```

por:

```jsx
            <PH key={mainImage} src={mainImage} alt={product.title} aspect="ph-square" />
```

Sin `key`, el `<img>` cambia de `src` con el estado interno `loaded` todavía en `true` y el navegador deja el hueco en blanco mientras descarga. Con `key`, `PH` remonta y usa su fundido de 400 ms.

- [ ] **Step 5: Pintar todas las miniaturas**

En el bloque `.pdp-thumbs` (≈línea 262), reemplazar:

```jsx
              {images.slice(0, 5).map((img, i) => (
```

por:

```jsx
              {images.map((img, i) => (
```

No hay que tocar CSS: `.pdp-thumbs` en `app/styles/gi-screens.css:1524` ya es `grid-template-columns: repeat(5, minmax(0, 1fr))`, así que las filas extra se acomodan solas.

- [ ] **Step 6: Regenerar los tipos de la Storefront API**

Run: `npm run codegen`
Expected: `storefrontapi.generated.d.ts` se actualiza con el nuevo `images(first: 12)`.

Si el comando falla por falta de sesión de Shopify CLI, **sáltalo y sigue**: el proyecto es JavaScript y ese archivo es sólo tipado de apoyo, no afecta el runtime. Anótalo al reportar la tarea.

- [ ] **Step 7: Correr tests y linter**

Run: `npm test && npm run lint`
Expected: toda la suite en verde y el linter sin errores nuevos.

- [ ] **Step 8: Verificación manual en la tienda**

Run: `npm run dev`

Abrir `/catalogo`, entrar a un producto que muestre varios swatches de color y comprobar, uno por uno:

1. Al hacer clic en otro color, la foto principal cambia a la de esa variante y la miniatura correspondiente queda resaltada.
2. En un color **sin** imagen asignada en Shopify, la galería vuelve a la primera foto (no se queda con la del color anterior).
3. Al hacer clic en una miniatura de detalle, esa foto se queda puesta; sólo se reinicia al volver a cambiar de color.
4. Recargar con el color en la URL (`?Color=...`) muestra desde el inicio la foto correcta.
5. La foto entra con fundido, sin parpadeo en blanco.

Si algo de lo anterior falla, **no continuar al commit**: reportar cuál de los cinco puntos falló y qué se vio.

- [ ] **Step 9: Commit**

```bash
git add app/routes/products.$handle.jsx storefrontapi.generated.d.ts
git commit -m "feat(pdp): la galería sigue a la variante seleccionada"
```

Si el Step 6 se saltó, quitar `storefrontapi.generated.d.ts` del `git add`.

---

## Notas para quien ejecute

- **No** hace falta tocar `app/components/gi/ProductCard.jsx` ni el catálogo: el spec deja ese cambio fuera de alcance.
- **No** agregar precarga de imágenes al pasar el mouse por los swatches. También está fuera de alcance.
- La cobertura real depende del contenido: las variantes sin imagen en el admin de Shopify caerán al fallback por diseño. Eso no es un defecto del código.
