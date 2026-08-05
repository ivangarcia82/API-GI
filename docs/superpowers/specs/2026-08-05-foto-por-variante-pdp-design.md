# Foto por variante en la PDP

Al elegir otro color en la ficha de producto cambia el precio, el SKU y el
stock, pero la foto se queda en la del color anterior. Este documento recoge la
causa y el diseño acordado: emparejar la imagen de la variante con la galería
por `id` y sincronizar la miniatura activa en el mismo render.

## Causa

`app/routes/products.$handle.jsx` arma la galería con las imágenes del producto
y pinta la principal por índice:

```js
const images = product.images?.nodes?.length
  ? product.images.nodes
  : [selectedVariant?.image].filter(Boolean);          // :120-122

const [activeImg, setActiveImg] = useState(0);          // :128
const mainImage = images[activeImg]?.url || selectedVariant?.image?.url; // :164
```

`activeImg` sólo lo mueve el clic en una miniatura. Cambiar de variante navega
a `?Color=Rojo` y `useOptimisticVariant` actualiza `selectedVariant` al
instante, pero **nada reinicia `activeImg`**, así que `mainImage` sigue
apuntando a la misma posición de la galería.

Dos obstáculos secundarios impiden arreglarlo tal cual está el código:

1. **No hay con qué emparejar.** El fragmento de variante pide
   `image { __typename id url altText width height }` (`:673`), pero la galería
   pide `images(first: 6) { nodes { url altText width height } }` (`:702`), sin
   `id`. No existe una llave común fiable.
2. **El tope de 6 se queda corto.** Un producto con cuatro colores más fotos de
   detalle o empaque pasa de seis imágenes, y la foto de alguna variante queda
   fuera de la galería. Además sólo se pintan 5 miniaturas (`.slice(0, 5)`,
   `:262`), así que la sexta ya hoy es inalcanzable.

## Decisiones tomadas

| Pregunta | Decisión |
| --- | --- |
| ¿Las variantes tienen imagen asignada en Shopify? | Sólo algunas. El diseño no puede asumir que siempre exista. |
| ¿Qué muestra una variante sin imagen? | La primera foto del producto. Nunca dejar en pantalla la foto de otro color mientras el selector dice uno distinto. |
| ¿Qué pasa con las miniaturas? | Se quedan todas; sólo cambia cuál está resaltada. El usuario sigue pudiendo ver detalle, empaque, etc. |
| ¿Cuántas imágenes? | Traer 12 y pintarlas todas. La rejilla ya es de 5 columnas y se acomodan en filas. |

Se descartaron dos alternativas:

- **Emparejar por URL** (sin tocar el GraphQL): las URLs del CDN llegan con
  parámetros (`?v=`, `&width=`) que pueden diferir entre `variant.image.url` y
  `images.nodes[].url`. Fallaría en silencio, igual que falla hoy.
- **Pintar siempre `selectedVariant.image` como principal**: no requiere
  emparejar, pero rompe las miniaturas — al hacer clic en una, la principal ya
  no le correspondería.

## Diseño

### 1. Query

En `PRODUCT_FRAGMENT`:

```graphql
images(first: 12) { nodes { id url altText width height } }
```

`id` es la llave del emparejamiento; 12 evita que la foto de una variante quede
fuera de la galería.

### 2. Helper puro — `app/lib/gallery.js`

```js
resolveVariantImageIndex(images, variantImage) // → índice, o 0
```

Devuelve la posición de la foto de la variante dentro de la galería. Devuelve
`0` cuando:

- la variante no trae imagen (el caso "sólo algunas la tienen"),
- el `id` no aparece en la galería (imagen más allá de las 12),
- el `id` de la variante o el de la imagen de galería viene nulo —`Image.id` es
  nullable en la Storefront API, y `null === null` daría un falso positivo,
- la galería viene vacía.

Va como helper aislado, no dentro del componente, para poder probarlo solo.
Sigue el patrón del repo: `filters.js`, `specs.js` y sus `*.test.js`.

### 3. Sincronización en la ruta

```js
const [activeImg, setActiveImg] = useState(0);
const [syncedVariantId, setSyncedVariantId] = useState(selectedVariant?.id);

if (selectedVariant?.id !== syncedVariantId) {
  setSyncedVariantId(selectedVariant?.id);
  setActiveImg(resolveVariantImageIndex(images, selectedVariant?.image));
}
```

El ajuste ocurre **durante el render**, no en un `useEffect`. Es el patrón que
React documenta para estado derivado de props: React vuelve a renderizar antes
de pintar, así que la foto nueva sale en el mismo frame que el precio y el SKU.
Con `useEffect` habría un frame intermedio con la foto vieja — un parpadeo
visible justo en la interacción que estamos arreglando.

Como `useOptimisticVariant` (`:104-107`) ya adelanta la variante antes de que
responda el loader, el cambio se siente instantáneo aunque la red tarde.

### 4. Clic manual en miniatura

Sigue funcionando igual y **manda sobre la variante**: si el usuario abre la
foto de detalle, ahí se queda. Sólo se reinicia cuando vuelve a cambiar de
variante. El bloque de sincronización no se dispara porque `syncedVariantId`
no cambió.

### 5. Miniaturas

Se quita el `.slice(0, 5)` y se pintan todas las imágenes de `images`. El
`.pdp-thumbs` de `gi-screens.css:1524` ya es `grid-template-columns: repeat(5,
...)`, así que las filas adicionales se acomodan sin tocar CSS. La condición
`images.length > 1` para mostrar el bloque se mantiene.

### 6. Transición

`key={mainImage}` en el `PH` de `.pdp-main`. Sin esto el `<img>` cambia de
`src` con el estado `loaded` todavía en `true`, y el navegador deja el hueco en
blanco mientras descarga la nueva. Con `key`, el componente remonta y usa el
fundido de 400 ms que `PH` ya trae (`ui.jsx:124`).

## Pruebas

`app/lib/gallery.test.js` cubre `resolveVariantImageIndex`:

| Caso | Esperado |
| --- | --- |
| La imagen de la variante está en la galería | Su índice |
| La variante no trae imagen (`null`/`undefined`) | `0` |
| El `id` de la variante no está en la galería | `0` |
| `id` nulo en la variante o en una imagen de la galería | `0` |
| Galería vacía | `0` |

Verificación manual en la tienda real: abrir un producto con varios colores,
cambiar de swatch y confirmar que la foto principal y la miniatura resaltada
siguen a la variante, y que un color sin imagen asignada vuelve a la primera
foto en vez de quedarse con la del color anterior.

## Fuera de alcance

- Precargar las imágenes de las variantes al pasar el mouse por los swatches.
- Cambiar la foto en las tarjetas del catálogo (`ProductCard.jsx`).
- Rellenar en el admin de Shopify las variantes que hoy no tienen imagen. El
  diseño degrada con elegancia, pero la cobertura real depende de ese trabajo
  de contenido.
