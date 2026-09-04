# Colores de marca por cliente — filtrado del catálogo por `custom.colores`

Los clientes de Generando Ideas son marcas, y cada marca tiene su paleta. La
tienda ya guarda esa paleta en el metafield de customer `custom.colores`. Este
documento recoge lo verificado contra la tienda y el diseño acordado para que
un cliente con paleta sólo vea productos que puede pedir en sus colores, en
todas las superficies de la aplicación.

## Lo verificado contra la tienda

Todo comprobado el 2026-09-04 contra `development-gi.myshopify.com` por Admin
API `2026-04`.

### El metafield

```
namespace: custom   key: colores   ownerType: CUSTOMER
type: list.single_line_text_field
validations: []          ← sin lista de valores permitidos, es texto libre
```

Hoy lo trae un solo customer, `igarcia@generandoideas.com`, con el valor
`["Rojo","Negro"]`. Los dos coinciden **exactamente** con las etiquetas de
`COLOR_FAMILIES` en `app/lib/filters.js:30-44`. Es la razón de que el diseño
normalice por familia y no invente un vocabulario nuevo.

Al no haber `validations.choices`, nada impide que mañana alguien escriba
`Pantone 186C` o `#c2352c`. El diseño tiene que sobrevivir a eso — ver
*Degradación*.

### Los colores en los productos

Muestra de 100 productos activos (de 6.980):

- **Los 100 tienen una opción llamada `color`.** No hay una clase de producto
  "sin color" que el filtro fuera a borrar por accidente.
- 28 valores distintos en la muestra. Los frecuentes son reconocibles
  (`ROJO` 66, `NEGRO` 61, `BLANCO` 52, `AZUL` 50, `NARANJA` 40), y hay
  compuestos (`AZUL MARINO`, `VERDE CLARO`, `PALO DE ROSA`, `ORO ROSA`) que
  `colorFamilyOf()` ya clasifica.
- Hay ruido que **no** es un color: `UNICO`, `TRANSPARENTE`, `MARMOLEADO`,
  `HUMO`. `colorFamilyOf()` devuelve `null` para todos ellos.

Consecuencia aceptada: un producto que sólo exista en `UNICO` o
`TRANSPARENTE` desaparece para cualquier cliente con paleta. Ver *Diagnóstico
previo*, que mide el alcance real antes de encender la función.

### El enganche que ya existe

- El snapshot de sesión (`app/lib/auth/session.js`) ya lleva el `gid` de
  Shopify en la cookie firmada: leer quién es el cliente no cuesta un viaje a
  Turso.
- `getCustomerAdvisor()` (`app/lib/admin/operations.js:162`) ya es exactamente
  el patrón de "leer un metafield de customer por Admin API", incluido su
  comportamiento en stub mode.
- `GI_PRODUCT_CARD_FRAGMENT` ya pide `options { name optionValues { name } }`
  y `normalizeProduct()` ya deriva `colors` (`app/lib/gi.js:129-150`). El
  post-filtro en memoria no cuesta ni una consulta extra donde se use ese
  fragment.

## Decisiones

| Pregunta | Decisión |
|---|---|
| Alcance | **Todas las superficies** de producto de la app |
| Dureza | **Forzoso, sin escape.** El panel sólo ofrece los colores de su marca |
| Coincidencia | **Por familia** (`colorFamilyOf`): "Rojo" trae ROJO, VINO, TINTO, GUINDA, GRANATE |
| Colores no reconocibles | **Se ocultan**: sin tono de la marca, el producto no aparece |
| Semántica | **ANY.** Basta con que el producto exista en alguno de sus colores |
| Ficha por link directo | **Se ve, con aviso** de que no está en sus colores |

Sobre la semántica ANY: un producto en ROJO/NEGRO/AZUL/VERDE sí aparece para
una marca Rojo/Negro, porque puede pedirse en rojo. La lectura estricta —que
*todos* sus colores fueran de la marca— dejaría el catálogo casi vacío (la
mayoría de los artículos promocionales vienen en 5+ colores) y además no la
puede resolver la API: obligaría a post-filtrar todo y rompería paginación y
conteos.

## Arquitectura

### Módulo nuevo: `app/lib/brand-colors.js`

Sigue el patrón de `filters.js`: la lógica es pura y testeable sin red; el
único I/O está aislado en una función.

**Puras:**

```js
parseBrandColors(valorDelMetafield) → string[]
```
`JSON.parse` del `list.single_line_text_field`, `colorFamilyOf()` sobre cada
valor, dedupe, descarta los `null`. Devuelve `[]` si el valor es `null`, `''`,
JSON inválido, o no es un array.

```js
effectiveColorFamilies(seleccionUsuario, familiasMarca) → string[]
```
- Sin marca (`familiasMarca` vacío): la selección tal cual — comportamiento
  actual intacto para clientes sin paleta.
- Con marca y sin selección: las familias de la marca.
- Con marca y con selección: la intersección.
- Con marca y una intersección vacía (alguien editó `?color=verde` a mano):
  las de la marca. No hay URL que se salga de la paleta.

```js
brandProductFilters(familias, vocabulario) → ProductFilter[] | null
productMatchesBrand(producto, familias) → boolean
keepBrandProducts(productos, familias) → productos
```
`brandProductFilters` expande cada familia a sus tonos crudos y emite un
`{variantOption: {name: 'color', value}}` por tono; al ser todos del mismo
tipo, la API los combina con O. `productMatchesBrand` es la versión en memoria
de lo mismo: lee `producto.colors` (de `normalizeProduct`) o, si no está,
`producto.options`.

**Con I/O:**

```js
getBrandColors(context) → {families: string[], raw: string[]} | null
```
`null` —sin restricción— cuando no hay sesión, el usuario no tiene `gid`, el
Admin API está en stub mode, o el metafield está vacío. Consulta:

```graphql
query customerBrandColors($gid: ID!) {
  customer(id: $gid) {
    metafield(namespace: "custom", key: "colores") { value }
  }
}
```

Requiere el scope `read_customers`, que ya está en uso para
`getCustomerAdvisor`.

```js
getColorVocabulary(context) → Array<{label, count}>
```
Los tonos crudos que existen en la tienda, de la faceta de color de
`search(query: "*", first: 1)`. Hace falta porque expandir "Rojo" a
`ROJO / VINO / TINTO / GUINDA` exige saber qué tonos existen, y
`/collections/:handle` y `/search` no tienen ninguna pre-consulta de facetas de
donde sacarlos.

### Las cachés

`getBrandColors` haría un round trip de Admin API en casi toda la aplicación.
Tres capas, de la más barata a la más cara:

1. **Memo por request.** `context.__brandColors ||= promesa`, sobre el objeto
   de contexto que ya se crea por request en `app/lib/context.js`. El loader de
   `root` y el de la ruta corren en paralelo; sin memo, cada página paga dos
   llamadas idénticas.
2. **`createWithCache`**, cableado en `app/lib/context.js` vía
   `additionalContext` — es el patrón oficial de Hydrogen y son unas tres
   líneas; `createWithCache` ya viene exportado por
   `@shopify/hydrogen@2026.4.2`, pero `createHydrogenContext` no lo pone en el
   contexto por sí solo. Key por `gid`, TTL corto (5 min). Una llamada cada
   varios minutos por cliente, no una por página.
3. **`getColorVocabulary` con `CacheLong`.** El vocabulario de la tienda cambia
   con el catálogo, no con el cliente; es una sola entrada compartida.

## Superficie por superficie

Nativo — la API filtra, la paginación y los conteos salen exactos:

| Superficie | Archivo | Trabajo |
|---|---|---|
| `/catalogo` búsqueda | `app/routes/catalogo.jsx` | El hueco de `productFilters` ya existe |
| `/catalogo` categoría | `app/routes/catalogo.jsx` | Ídem, vía `GI_CATALOG_COLLECTION_QUERY` |
| `/collections/:handle` | `app/routes/collections.$handle.jsx` | Añadir `$filters` a `COLLECTION_QUERY` |
| `/search` normal | `app/routes/search.jsx` | Añadir `$productFilters` al bloque `products:` |

Post-filtro en memoria — la API no acepta facetas ahí, y son listas cortas
donde no rompe paginación ni conteos:

| Superficie | Archivo | Nota |
|---|---|---|
| Búsqueda predictiva | `app/routes/search.jsx` | Hay que pedir `options` en `PREDICTIVE_SEARCH_QUERY_FRAGMENT` |
| Similares de la PDP | `app/routes/products.$handle.jsx` | `productRecommendations`; ya trae `options` |
| Favoritos | `app/routes/account.favoritos.jsx` | Hay que añadir `options` a `FAVORITOS_QUERY` |
| Home, 16 best sellers | `app/routes/_index.jsx` | Sobre-pedir y recortar — ver abajo |
| Vistos recientemente | `app/components/gi/RecentlyViewed.jsx` | En cliente; el snapshot de localStorage ya guarda `colors` |

**El home no puede migrar a `search`.** Era la intención inicial, pero
`SearchSortKeys` sólo expone `PRICE` y `RELEVANCE` —verificado contra
`storefront.schema.json`—, así que cambiar `products(query:)` por `search` para
ganar las facetas destruiría en silencio el orden `BEST_SELLING` de la tira de
más vendidos. Se queda con `GI_PRODUCTS_QUERY` y `sortKey: BEST_SELLING`,
pidiendo `first: 60` en vez de 16 y recortando a 16 después del post-filtro. Es
una tira fija sin paginación, así que sobre-pedir no rompe nada; con una paleta
muy estrecha la tira mostrará menos de 16, que es correcto.

Para el filtrado en cliente, `root.jsx` añade `brandColors` a su payload y
`AppProvider` lo expone como `useApp().brandColors`.

## Cambio en código existente: fuera la pre-consulta de vocabulario

`catalogo.jsx:85-100` hace hoy una consulta extra —el "huevo y la gallina"— sólo
para averiguar qué tonos existen antes de poder expandir una familia. Con
`getColorVocabulary` cacheado, esa pre-consulta sobra: se borra, y el catálogo
pasa de dos consultas a una cuando hay colores aplicados.

**Cambio de comportamiento, aceptado explícitamente.** Hoy, si se pide por URL
`?color=verde` sobre una colección sin ningún verde, la familia no aporta tonos
y el filtro **se ignora en silencio** (ver el comentario en
`filters.js:buildProductFilters`). Con el vocabulario global sí aporta tonos y
el resultado será **0 productos**. Es la respuesta honesta, y para un cliente
con paleta es justo la que queremos: "aquí no hay nada en tus colores". La
interfaz nunca ofrece una familia ausente, así que sólo cambia para URLs
escritas a mano.

## Interfaz

### Panel de filtros

La faceta de color se intersecta con las familias de la marca: un cliente
Rojo/Negro sólo ve esos dos swatches. La paleta **no** se pinta como chip
removible en `activeChips` — es el suelo del catálogo, no un filtro aplicado, y
un chip con una "x" que no quita nada sería mentir.

Estado vacío propio, distinto del "Sin resultados" genérico: *"No hay productos
en los colores de tu marca con estos filtros"*, con el botón de limpiar
filtros.

### Ficha de producto

`products.$handle.jsx` resuelve la marca en el loader:

- Producto **sin ningún** tono de la marca: banda de aviso arriba. Se ve y se
  cotiza igual — llega por link de su ejecutiva o por favoritos guardados.
- En el selector de color, los tonos fuera de la paleta se marcan como tales
  pero **no se bloquean**, coherente con la decisión de "avisar" en vez de
  cerrar.

## Degradación

Cada modo de fallo tiene una salida definida, y ninguna deja al cliente con un
catálogo vacío sin explicación:

| Situación | Comportamiento |
|---|---|
| Sin sesión, o usuario sin `gid` | Sin restricción |
| Admin API en stub mode (sin `PRIVATE_ADMIN_API_TOKEN`) | Sin restricción |
| Metafield ausente o `[]` | Sin restricción |
| La llamada al Admin API falla o expira | Sin restricción, `console.error`. Nunca tumba la ruta |
| El metafield trae **sólo** valores irreconocibles (`Pantone 186C`, `#c2352c`) | **Fail-open**: sin restricción y `console.warn` con el valor crudo y el gid. Una errata en el admin no debe vaciarle el catálogo a un cliente |
| Algunos valores reconocibles y otros no | Se usan los reconocibles; los demás se descartan en silencio |
| Una familia de la marca sin ningún tono en la tienda | No aporta filtros; si ninguna aporta, el resultado es 0 productos, que es la verdad |

## Aislamiento entre clientes

El catálogo pasa a depender de quién lo mira, así que hay que descartar fugas:

- **No hay caché pública de HTML.** `server.js` y `app/entry.server.jsx` no
  emiten `Cache-Control` de página; sólo hay cachés de subrequest de la
  Storefront API.
- **La caché de subrequest es por consulta + variables**, y las variables ahora
  incluyen los `productFilters` de la marca. Dos clientes con paletas distintas
  no comparten entrada.
- **La caché de `getBrandColors` va con key por `gid`.**
- Un test de aislamiento cierra el punto: dos loaders con snapshots de sesión
  distintos producen filtros distintos.

## Pruebas

Vitest, archivos junto al fuente, como el resto del repositorio.

`app/lib/brand-colors.test.js`
- `parseBrandColors`: valor válido, `null`, `''`, JSON roto, array vacío, valor
  que no es array, valores irreconocibles, mezcla de reconocibles e
  irreconocibles, duplicados que colapsan a una familia (`["Rojo","Vino"]` →
  `['rojo']`).
- `effectiveColorFamilies`: sin marca, marca sin selección, intersección,
  intersección vacía, y `?color=` con basura.
- `brandProductFilters`: expansión a tonos, familia sin tonos, lista vacía →
  `null`.
- `productMatchesBrand`: semántica ANY, producto con `colors`, producto sólo
  con `options`, producto con `UNICO` / `TRANSPARENTE` (no coincide).

`app/lib/filters.test.js` — casos añadidos
- La paleta de marca no genera chips removibles.
- `appliedFilters` deja fuera los colores pedidos que no son de la marca.

`app/routes/catalogo.brandColors.test.js`
- Los `productFilters` de la marca llegan de verdad a la consulta.
- Un cliente sin marca produce exactamente la consulta de hoy (sin regresión).
- Dos sesiones distintas producen filtros distintos (aislamiento).
- El Admin API caído no tumba la ruta y no restringe.

## Diagnóstico previo

Antes de encender la función hay que medir el recorte real. Un script en
`scripts/` que, por cada familia de `COLOR_FAMILIES`, informe cuántos productos
activos del catálogo sobrevivirían, y cuántos productos no tienen **ningún**
tono clasificable (los `UNICO` / `TRANSPARENTE` / `MARMOLEADO`, que
desaparecerían para todos los clientes con paleta).

Es la salvaguarda de la decisión "los productos sin color reconocible se
ocultan": si el número resulta grande, se revisa esa decisión antes de que la
vea un cliente, no después.

## Fuera de alcance

- Poblar `custom.colores` en los customers. Se sigue editando a mano en el
  admin de Shopify.
- Una interfaz para que el propio cliente edite su paleta.
- Restringir el color en la cotización o en la draft order. El filtro es de
  descubrimiento; lo que se cotiza no cambia.
- Cambiar el vocabulario de color de la tienda o añadir `validations.choices`
  al metafield. El diseño se adapta al texto libre que hay hoy.
