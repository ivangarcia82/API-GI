# Mejoras de header y home — ronda de feedback del 3 de agosto de 2026

Ajustes de copy, jerarquía y color pedidos por el cliente sobre el header y la
página de inicio, más el renombrado de la página de listado de colecciones a
"categorías". No hay cambios de datos ni de lógica de negocio: todo es copy,
layout y tokens visuales.

## Contexto

El home combina dos sistemas de estilo que ya conviven en el proyecto: las
secciones nativas de commerce (`gi-screens.css`) y las secciones portadas del
sitio de marketing (`.gi-mkt` + `gi-marketing.css`). La banda de números es del
segundo grupo; el resto de lo que se toca aquí es del primero. Ningún cambio
cruza esa frontera.

## Cambios

### 1. Header — botón "Crear cuenta" en naranja con texto blanco

El botón ya usa `--accent` (#FF8300, Pantone 151C de la marca). Lo único que
cambia es el color del texto: de `--accent-ink` (#2e3033) a blanco.

Se aplica a los dos botones de crear cuenta —el del appbar en desktop y el del
menú móvil— para que no queden en dos tonos distintos.

**Riesgo aceptado:** blanco sobre #FF8300 rinde ~2.9:1 de contraste, por debajo
del mínimo WCAG AA de 4.5:1 para texto de 13px. El hover (`--accent-deep`,
#d96e00) tampoco alcanza (~3.9:1). Es una decisión de marca explícita del
cliente, documentada aquí y en un comentario del CSS para que un futuro cambio
no la revierta por accidente creyéndola un descuido.

### 2. Hero — "generan" sube de línea y pasa a negritas

De:

```
Promocionales
que generan
memoria.
```

a:

```
Promocionales que generan
memoria.
```

`generan` conserva el degradado naranja de marca pero cambia de itálica delgada
(`font-style: italic; font-weight: 400`) a negritas rectas (`font-weight: 700`),
igual que el resto del título.

**Consecuencia de layout.** La línea larga pasa de 13 a 25 caracteres. Medida en
el navegador ocupa 11.77em, y la columna de texto del hero medía 627px: el
título no habría pasado de **53px**, contra los 124px actuales. Se evaluaron
tres salidas y se eligió la tercera:

| | Título | Coste |
|---|---|---|
| Dejar el layout como está | 52px | El hero pierde más de la mitad de su peso tipográfico |
| Título a todo el ancho, collage debajo | 104px | Recompone el hero y lo alarga bastante |
| **Ensanchar la columna de texto** | **64px** | El collage baja de 560px a 470px |

La elegida reparte la retícula del hero como `1.62fr / 1fr` en vez de
`1.05fr / 1fr`, lo que lleva la columna de texto a 757px y permite 64px de
título en una sola línea conservando la composición y la altura del hero.

### 3. Banda de números — más compacta, números más grandes

**Los números nunca se estaban viendo grandes.** El rótulo de cada celda usaba
el selector `.gi-mkt .impact-cell span`, que también atrapaba el `<span>` que
`<CountUp>` renderiza dentro del `<strong>`: la cifra se pintaba a **12px, en
mayúsculas y en gris**, anulando el tamaño grande del `<strong>`. Es la causa
de fondo de "crecer notable los números". Se corrige acotando el rótulo a hijo
directo (`.impact-cell > span`), lo que devuelve la cifra a su tamaño real.

Con eso resuelto, la banda se compacta y la cifra se calibra al espacio
disponible:

| | Antes | Después |
|---|---|---|
| Padding de sección | 120px | 64px |
| Margen del encabezado | 60px | 32px |
| Padding de celda | 40px 28px 8px | 24px 20px 8px |
| Tamaño real del número | 12px (por el bug) | hasta 72px |

El techo de 72px no es arbitrario: el valor más largo, `+67,000`, ocupa 3.62em
medidos en el navegador, y la celda deja 264px útiles en el ancho máximo. El
tramo fluido (`5vw` en cuatro columnas, `8.5vw` en dos) está calculado para que
tampoco desborde en el punto más apretado de cada retícula.

Los overrides se aplican con la clase `.impact` que la sección ya tiene, para no
alterar el resto de secciones `.gi-mkt`.

### 4. Categorías — una sola fila de cuatro

- Se elimina el eyebrow `// Catálogo · 01`.
- De seis tarjetas en dos filas a cuatro en una: Bebidas, Bienestar, Ecológicos
  y Hogar (las cuatro primeras del orden ya configurado en `HOME_CATEGORIES`).
- El CTA pasa de "Ver más categorías" → `/catalogo` a **"Ver todas las
  categorías"** → `/collections`, que es la vista que lista todas las familias.
- La condición que muestra el CTA pasa de `length > 6` a `length > 4`.

### 5. Servicios — acento naranja y sin subrayado

- Se elimina el eyebrow `// Servicios`.
- El título pasa a `Cinco servicios, ` + `una sola relación.` en naranja
  (`.text-accent`, la misma utilidad que ya usa el resto del home).
- Las tarjetas dejan de subrayarse al pasar el cursor o al hacer clic.

El subrayado no lo pone la tarjeta: viene de una regla global `a:hover {
text-decoration: underline }` en `reset.css`, que `gi-tokens.css` no anula
porque su `a { text-decoration: none }` tiene menor especificidad. Se corrige
sólo en `.svc-strip-card` y sus descendientes, no globalmente — tocar la regla
global cambiaría el comportamiento de enlaces en páginas que no están en el
alcance de este feedback.

### 6. Colecciones destacadas — dos tarjetas del tamaño de una categoría

- Se elimina el eyebrow `// Colecciones · 03`.
- El título pasa de "Líneas para campañas precisas." a `Colecciones` (en
  naranja) + ` para campañas precisas.`
- De tres colecciones (Mundial, Nuevos, Ofertas) a dos: **Nuevos** y
  **Ofertas**.
- Las tarjetas se sirven en la misma retícula de cuatro columnas que las
  categorías y con proporción de imagen cuadrada, así que ocupan el mismo
  ancho y un alto comparable. Se retira la variante `coll-card-large` de la
  primera tarjeta.
- El CTA pasa de "Ver todas las colecciones" → `/collections` a **"Ver todo el
  catálogo"** → `/catalogo`, porque `/collections` deja de presentarse como una
  página de colecciones (ver punto 7).

`FEATURED_COLLECTIONS` en `app/lib/gi.js` **no** se recorta: `catalogo.jsx`
también la consume para sus chips de filtro. La selección de dos handles se
declara aparte, específica del home.

### 7. `/collections` se presenta como "Categorías"

El cliente llama categorías a lo que Shopify modela como colecciones. La ruta
`/collections` es la de Shopify y no cambia; lo que cambia es cómo se lee:
título del documento, meta description, eyebrow, H1, párrafo de entrada y
estado vacío pasan de "colecciones" a "categorías".

## Verificación

- `npm test` en verde: 245 pruebas, 51 archivos.
- `npm run lint` sin errores.
- Revisión visual en el navegador a 1470px: hero, banda de números, categorías,
  servicios (incluido el hover sin subrayado), colecciones y `/collections`.
- Anchos estrechos: comprobados por cálculo contra las métricas tipográficas
  medidas en la página (3.62em para `+67,000`), no renderizados. De 320px a
  1470px ninguna cifra desborda su celda. Queda pendiente una pasada visual en
  un móvil real.

## Fuera de alcance

- Cambiar la URL `/collections`.
- Corregir la regla global de subrayado de `reset.css` fuera de la tira de
  servicios.
- Cualquier ajuste de contraste que contradiga el naranja + blanco pedido.
