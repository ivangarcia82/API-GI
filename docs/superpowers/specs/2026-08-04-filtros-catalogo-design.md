# Filtros del catálogo — motor facetado y rediseño

Los filtros de `/catalogo` no se combinan entre sí y, en el caso del color, ni
siquiera filtran. Este documento recoge la investigación de causa raíz y el
rediseño acordado: un único motor de búsqueda facetada sobre la Storefront API,
con facetas dinámicas, y una interfaz que refleja lo que está aplicado.

## Causa raíz

Seis defectos, todos verificados contra la tienda real (`development-gi`).

### 1. El color secuestra la búsqueda en vez de filtrar

`catalogo.jsx:209-212` hace `setParam('q', color)` al pulsar un swatch, lo que
**sobrescribe** el término de búsqueda.

Reproducción: `?q=mochila` → clic en Verde → `?q=Verde`. El término se pierde.

### 2. Aunque no lo sobrescribiera, `q` no puede filtrar por color

`q` alimenta `products(query:)`, cuya sintaxis documentada admite `title`,
`tag`, `product_type`, `vendor`, `variants.price` y fechas — **no** valores de
opción de variante. Los colores son justamente eso.

Evidencia: `?q=Verde` devuelve 24 productos de los que **10 no tienen ningún
verde** (p. ej. "BOLSA SIBIU" con AZUL/ROSA/CAFÉ/GRIS/MORADO).

### 3. Categoría y búsqueda se excluyen por construcción

El loader ramifica `if (cat) {...} else {...}`, así que con categoría activa el
parámetro `q` se ignora por completo — pero el input sigue mostrándolo.

Evidencia: `?cat=mochilas-y-maletas&q=termo` → 24 resultados, **0 contienen
"termo"**, y el buscador muestra "termo".

### 4. Categorías y Colecciones comparten el parámetro `cat`

Son dos grupos visuales independientes escribiendo en el mismo slot: elegir en
uno deselecciona el otro sin avisar.

### 5. El precio es sólo de cliente y sólo de la página cargada

`priceFilter` se aplica sobre los `nodes` de la página actual (24 de ~6.956),
no viaja en la URL —se pierde al recargar o compartir— y el contador
"N productos" cuenta esa página filtrada, no el resultado.

### 6. La lista de colores está inventada

El código ofrece ocho colores en *Title Case*
(`Negro, Blanco, Azul, Rojo, Verde, Amarillo, Gris, Plata`). La tienda tiene
**100 valores** en mayúsculas y compuestos: `AZUL MARINO`, `VERDE PISTACHO`,
`PLATA DAMA`, `ROSA PÁLIDO`, `AZUL/NEGRO`…

## Lo que la API sí permite

La tienda ya expone un sistema facetado completo que el código ignoraba. Cada
respuesta trae los valores **con conteos recalculados sobre el resultado
actual**:

| Faceta | Id | Valores |
|---|---|---|
| Color | `filter.v.option.color` | 100 |
| Técnicas de Impresión | `filter.p.m.custom.tecnicas_de_impresion` | 55 |
| Talla | `filter.v.option.talla` | 24 |
| Material | `filter.p.m.custom.material` | 7 |
| Disponibilidad | `filter.v.availability` | 2 |
| Precio | `filter.v.price` | rango |

### Hallazgos que fijan la arquitectura

Verificados con consultas reales, no supuestos:

1. **`search` combina texto y facetas.** `products(query:)` acepta texto pero no
   `filters`; `collection.products(filters:)` acepta facetas pero no texto.
   `search(query:, productFilters:)` acepta **ambos**.
   - `mochila` → 675
   - `mochila` + color VERDE → **36, ninguno sin verde**
   - `mochila` + VERDE + precio ≤300 → 28

2. **La categoría va en la cadena de consulta, no en `productFilters`.** El
   filtro `tag` pasado como `ProductFilter` **se ignora en silencio**: un tag
   inexistente devuelve los mismos 675 resultados que sin filtro. En cambio
   `tag:"..."` dentro de `query` sí funciona:
   - `libreta AND tag:oficina` → 384, todos con el tag
   - `libreta AND tag:oficina` + VERDE → 72

   Los tags corresponden 1:1 con las colecciones (comprobado: 250/250 productos
   de `mochilas-y-maletas` llevan el tag `mochilas y maletas`).

3. **Mismo tipo de filtro = O; tipos distintos = Y.**
   - VERDE → 36, ROJO → 104, VERDE+ROJO → **116** (unión, con solape)
   - VERDE + precio ≤200 → 21 (intersección)

   Esto es lo que hace viable agrupar colores en familias.

4. **`*` sirve de consulta base.** `search(query: "*")` devuelve el catálogo
   completo (6.956) y respeta los `productFilters` (`*` + VERDE → 731, ninguno
   sin verde).

5. **`SearchSortKeys` sólo tiene `RELEVANCE` y `PRICE`.** No hay equivalente a
   `BEST_SELLING` ni `CREATED_AT`.

## Diseño

### Motor

Una sola consulta `search(types: PRODUCT)` por carga:

- **`query`**: texto libre y `tag:"<categoría>"` unidos por `AND`; `*` cuando no
  hay ninguno de los dos.
- **`productFilters`**: color (un `variantOption` por tono de la familia),
  precio (`price`), disponibilidad (`available`), material y técnica
  (`productMetafield`), talla (`variantOption`).
- **`sortKey`** + `reverse`: relevancia o precio.
- `unavailableProducts: LAST` para que lo agotado no encabece.

De la respuesta se usan `totalCount` (contador real) y `productFilters`
(facetas con conteos) para pintar el panel.

### Familias de color

No se hardcodean los 100 valores. En cada carga se toman los que devuelve la
faceta y se clasifican normalizando acentos y mayúsculas contra una tabla de
palabras clave por familia (12 familias). Seleccionar una familia expande a un
`OR` de sus tonos.

Consecuencias buscadas: un tono nuevo (`VERDE OLIVO`) cae solo en su familia sin
tocar código, y los valores que no son colores —la faceta trae un `7X4CM`— no
mapean a ninguna familia y se descartan.

### Estado en la URL

`?q` `cat` `color` `precio` `disp` `material` `tecnica` `talla` `sort`, los
multivalor separados por coma. Todo el estado es compartible y sobrevive a
recargas y al botón atrás; hoy el precio no.

### Ordenación y accesos rápidos

El selector queda en Relevancia · Precio ↑ · Precio ↓, que es lo que la API
soporta. "Más vendidos" y "Nuevos primero" **se pierden como orden** y se
recuperan como filtros combinables: chips de **Novedades** (`tag:nuevo`) y
**Ofertas** (`tag:oferta`), que la tienda ya etiqueta.

### Interfaz

- Cabecera con el total real de resultados.
- Chips de filtros aplicados, cada uno con su ✕, más "limpiar todo".
- Grupos plegables con conteo por opción; un grupo sin valores en el resultado
  actual no se pinta (así "Talla" desaparece sola fuera de textil).
- Swatches por familia de color, con estado activo visible y deseleccionable —
  hoy no hay forma de quitar un color.
- Precio con mín/máx, aplicado en servidor.
- Panel deslizante en móvil.

### Archivos

| Archivo | Papel |
|---|---|
| `app/lib/filters.js` | Nuevo. Lógica pura: URL ↔ estado, familias de color, construcción de `query` y `productFilters`. Es donde vive la parte testeable. |
| `app/components/gi/CatalogFilters.jsx` | Nuevo. Panel de filtros y chips. Se escribe reutilizable para que las páginas de colección puedan adoptarlo después. |
| `app/lib/giFragments.js` | Consulta `search` con facetas. |
| `app/routes/catalogo.jsx` | Loader y conexión con el panel. |
| `app/styles/gi-screens.css` | Estilos del panel, chips y drawer. |

## Verificación

- Tests unitarios de `app/lib/filters.js`: parseo de URL, expansión de familias
  de color, construcción de la consulta y de los filtros, y el caso concreto de
  este informe (texto + color + precio conviviendo).
- `npm test` y `npm run lint` en verde.
- Comprobación en navegador del caso reportado: buscar "mochila", añadir verde y
  confirmar que el término se conserva y los resultados son mochilas verdes.

## Fuera de alcance

- Llevar el panel a `/collections/$handle` y `/search` (hoy no tienen filtros).
- Limpiar los valores de color anómalos en Shopify; se descartan al mapear.
