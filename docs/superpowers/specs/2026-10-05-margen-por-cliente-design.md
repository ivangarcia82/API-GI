# Margen por cliente — precio calculado sobre costo con `custom.margen`

Cada cliente de Generando Ideas puede tener un margen negociado. La tienda lo
guarda en el metafield de customer `custom.margen`. Este documento recoge lo
verificado contra la tienda y el diseño acordado para que un cliente con margen
vea, filtre, ordene y cotice con un precio calculado sobre el costo de cada
producto, en todas las superficies de la aplicación.

## Lo verificado contra la tienda

Todo comprobado el 2026-10-05 contra `development-gi.myshopify.com` por Admin
API `2026-04`.

### El metafield

```
namespace: custom   key: margen   ownerType: CUSTOMER
type: number_decimal
validations: []          ← sin mínimo ni máximo
access.storefront: PUBLIC_READ
```

Se captura como porcentaje: un 30 % es `30`, no `0.30`. Sin `validations`,
nada impide que alguien escriba `0`, `-5`, `100` o `250`; el diseño tiene que
sobrevivir a eso (ver *Degradación*). Al 2026-10-05 ningún customer de la
muestra lo tiene relleno.

### El costo

- El token de Admin ya tiene `read_inventory` (y `read_products`). Se lee como
  `ProductVariant.inventoryItem.unitCost.amount`. Hoy nada en el código lo pide.
- Muestra de 4.000 variantes activas: **115 (~3 %) no tienen costo** (nulo o
  0). Los productos activos son ~7.000 y las variantes pasan de 10.000.

### La relación precio de lista / costo

En 3.885 variantes con costo, `precio / costo` es 3,33–3,34 en todas menos 11
(0,3 %), y esas 11 son casi todas redondeos. Es decir: **el precio de lista es
`costo / 0.30`, un margen bruto del 70 %**, uniforme entre proveedores (Doble
Vela, PromoOpcion, CDO, 4Promo, G4, Innova, DKPS, Impressline). La única
desviación real vista es una variante de Innova a 2,0.

Esto es lo que permite filtrar y ordenar por el precio del cliente sin índice
propio (ver *Filtro y orden por precio*).

## Decisiones

| Pregunta | Decisión |
|---|---|
| Fórmula | Margen bruto: `precio = costo / (1 − margen/100)`. Mismo criterio que el `/0.67` de la decoración. |
| Formato del metafield | Porcentaje: `30` = 30 %. |
| Quien no tiene margen (anónimo, cliente sin metafield) | Precio de lista de Shopify, igual que hoy. |
| Variante sin costo, cliente con margen | Precio de lista. Se puede cotizar. *(Default asumido; cambiable.)* |
| Decoración | No le afecta. Sigue con su `/0.67`. El margen sólo reemplaza el precio base del artículo. |
| Cupón | Sin cambios: % sobre el subtotal, ya calculado con el precio del cliente. |
| Fuente del costo | Admin API al vuelo, con caché compartida. Sin sincronización ni tablas nuevas. |
| Filtro y orden por precio | Se traduce el rango del cliente a rango de lista y se deja a Shopify. |

## Diseño

### 1. Fórmula pura — `app/lib/pricing.js`

Sin red, importable desde servidor y navegador, testeable aislada.

```js
export const LIST_MARGIN = 70; // el precio de lista es costo / 0.30

/** null si el valor no es un margen usable. */
export function parseMargin(raw) // número finito con 0 < m < 100, o null

/** Precio del cliente para una variante. */
export function customerPrice({cost, margin, listPrice})
  // margin null              → listPrice
  // cost nulo, 0 o no finito → listPrice
  // si no                    → round2(cost / (1 − margin/100))

/** Factor para convertir un precio del cliente a precio de lista. */
export function listFactor(margin)
  // (1 − margin/100) / (1 − LIST_MARGIN/100)    ·  margin null → 1

export function toListRange({min, max}, margin)
  // {min: min * listFactor, max: max * listFactor}, nulls preservados.
  // min se redondea hacia abajo y max hacia arriba (a 2 decimales) para que
  // el redondeo nunca deje fuera un artículo que está en el borde.
```

`round2` se reutiliza de `app/lib/decoration/engine.js`.

### 2. Lectura en servidor — `app/lib/pricing.server.js`

Mismo patrón que `brand-colors.server.js`.

- **`getCustomerMargin(context)`**: sesión → `gid` → metafield `custom.margen`
  por Admin API, con `withCache` (clave `['gi-margin', gid]`, `CacheShort` 300 s
  + SWR 300 s) y memo por request (el loader de root y el de la ruta no pagan
  dos veces). Sin `gid` no toca la red y devuelve `null`. Cualquier fallo de
  red → `null` (precio de lista), registrado en consola.
- **`getVariantCosts(context, variantIds)`**: una consulta `nodes(ids:)` en
  lote → `Map<variantId, number|null>`. Caché compartida entre clientes (el
  costo no depende de quién mira), `CacheShort`, clave con los ids ordenados.
  Lotes de 250 ids como máximo. Fallo → mapa vacío (precio de lista).
- **`priceVariants(context, variants)`**: atajo para los loaders. Si
  `getCustomerMargin` es `null`, devuelve las variantes tal cual **sin pedir
  costos** — el visitante anónimo y el cliente sin margen no pagan ninguna
  consulta extra. Si hay margen, pide los costos y reescribe `price.amount` de
  cada variante con `customerPrice`.

El costo **nunca** sale al navegador: los loaders devuelven sólo el precio ya
calculado.

Operación nueva en `app/lib/admin/operations.js`: `getCustomerMargin(env, gid)`
y `getVariantCosts(env, ids)`, null-safe en modo stub como sus vecinas, con su
caso en el stub de `admin/client.js`.

### 3. Superficies que muestran precio

Todas reciben el precio ya calculado desde su loader; los componentes no
cambian.

| Superficie | Dónde se aplica |
|---|---|
| Tarjetas (home, catálogo, colecciones, favoritos, recomendaciones del PDP) | En cada loader, sobre la variante que ya viene en `GiProductCard` (`variants(first:1)`), antes de `normalizeProduct`. Se usa el precio de esa variante, no `priceRange.minVariantPrice`, para que tarjeta y costo hablen de la misma variante. |
| PDP | El loader calcula el precio de la variante seleccionada y de cada `firstSelectableVariant` de las opciones, que son las que hoy llegan al navegador y se usan al cambiar de variante. `compareAtPrice` se oculta para clientes con margen (comparar contra la lista no tiene sentido). |
| Búsqueda predictiva (`SearchModal`, `SearchResultsPredictive`) | En el loader de predictiva de `search.jsx`. |
| Cajón, cotizaciones de cuenta y asesor, PDF, correos, draft order | Sin cambios: leen el `effectiveUnitPrice` guardado por línea. |

Para que los loaders no repitan la consulta de costos, `priceVariants` recibe
de una vez todas las variantes de la página.

### 4. Cotización — la fuente de verdad

`recomputeItemPricing` no cambia: sigue recibiendo `baseUnitPrice`. Lo que
cambia es quién lo calcula. Un helper `resolveBaseUnitPrice(context,
{variantId, listPrice})` usa `getCustomerMargin` + `getVariantCosts` +
`customerPrice`.

| Ruta | Hoy | Con margen |
|---|---|---|
| `api.quote.add` | `variant.price` de Storefront | `resolveBaseUnitPrice` |
| `api.quote.merge` (carrito de invitado al iniciar sesión) | `variant.price` en lote | `resolveBaseUnitPrice` en lote: el precio de invitado se corrige solo |
| `api.quote.update` (cambio de cantidad) | `baseUnitPrice` guardado | Sin cambios |
| `api.quote.reorder` | `baseUnitPrice` **viejo** guardado | Vuelve a pedir el precio de lista y pasa por `resolveBaseUnitPrice` |
| `api.quote.submit` | Usa lo guardado | **Reprecia todas las líneas** antes de armar el draft order, por si el margen o el costo cambiaron mientras la cotización estaba en borrador. Persiste los precios nuevos. |

Al repreciar en el envío, el cliente podría enviar una cotización con un total
distinto al que vio en el cajón. Se acepta: el envío devuelve los items
actualizados y el cajón los pinta; la cotización enviada y el draft order
siempre coinciden con lo guardado.

### 5. Filtro y orden por precio

Como el precio de lista es `costo / 0.30` en el 99,7 % del catálogo, el precio
del cliente es proporcional al de lista:

```
precio_cliente = precio_lista × 0.30 / (1 − m/100)
precio_lista   = precio_cliente × (1 − m/100) / 0.30
```

- **Filtro**: en `buildProductFilters` (`app/lib/filters.js`), el rango
  `{precioMin, precioMax}` que escribe el cliente se pasa por `toListRange`
  antes de mandarlo a Shopify. El chip y los campos siguen mostrando lo que el
  cliente escribió. Ejemplo: margen 40, rango $0–$100 → Shopify recibe
  $0–$200.
- **Orden**: `PRICE` sigue igual. Como la relación es monótona, el orden por
  precio de lista *es* el orden por precio del cliente.
- Paginación, conteos de facetas y rendimiento: idénticos a hoy. Es la misma
  consulta con otros números.
- `buildProductFilters` recibe el margen como opción nueva; sin margen,
  `listFactor` es 1 y el resultado es idéntico al actual.
- Las rutas que usan el filtro (`catalogo.jsx`) pasan `getCustomerMargin` a
  `buildProductFilters`.

**Imprecisión aceptada**: el 0,3 % de variantes que no cumple la proporción
puede entrar o quedar fuera por poco en el borde del rango. El precio que el
cliente *ve* siempre sale de su costo real.

### 6. Degradación

Nunca se rompe una página por el margen. Ante cualquier duda, precio de lista.

| Situación | Resultado |
|---|---|
| Sin sesión o sin `gid` en sesión | Precio de lista, sin consultas extra |
| Metafield vacío, no numérico, ≤ 0 o ≥ 100 | Precio de lista |
| Variante sin costo (nulo o 0) | Precio de lista para esa variante |
| Fallo de Admin API al leer margen o costos | Precio de lista, `console.error` |
| Modo stub (sin token, desarrollo) | Precio de lista |

*Hueco conocido, fuera de alcance*: `api.quote.submit` puede escribir el `gid`
en la base de datos sin refrescar la sesión, así que ese cliente ve precio de
lista hasta su siguiente inicio de sesión. Es el mismo hueco que ya tiene
`custom.colores`.

## Fuera de alcance

- Margen distinto por producto, colección o proveedor.
- Que el margen afecte a la decoración.
- Bloquear la cotización de variantes sin costo.
- Cargar los costos faltantes (es tarea de datos; se puede sacar la lista).
- Corregir precios guardados en el navegador antes de iniciar sesión
  (vistos recientemente, carrito de invitado): se corrigen solos al iniciar
  sesión o al cotizar.
- Cotizaciones ya enviadas: conservan el precio con el que se enviaron.

## Pruebas

- **`pricing.test.js`** (puro): fórmula con márgenes típicos (30 → `costo /
  0.70`), `parseMargin` con `0`, negativos, `100`, `250`, texto, `null`;
  variante sin costo; `listFactor` y `toListRange` con nulls y redondeo hacia
  afuera; que `customerPrice` con margen 70 reproduzca el precio de lista de la
  muestra real.
- **`pricing.server.test.js`**: Admin simulado. Sin `gid` no hay consultas;
  con margen nulo no se piden costos; fallos de red → lista; memo por request;
  lotes de más de 250 ids.
- **`filters.test.js`**: `buildProductFilters` sin margen idéntico a hoy; con
  margen traduce el rango.
- **Rutas de cotización**: `add`, `merge` y `reorder` guardan el precio con
  margen; `submit` reprecia y persiste antes del draft order; `update` no pide
  costos.
- **Loaders**: el catálogo y el PDP devuelven precio con margen y nunca
  `unitCost`.
