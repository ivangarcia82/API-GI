# Campañas por temporada

Cada campaña es una colección automática de Shopify con la etiqueta
`Campaña_…` y una landing en `/temporada/<handle>`. La landing tiene el banner,
el título y el texto de la campaña, y debajo el catálogo de la colección con
sus filtros.

| Campaña        | Handle           | Etiqueta               | En el home   |
|----------------|------------------|------------------------|--------------|
| Octubre Rosa   | `octubre-rosa`   | `Campaña_OctubreRosa`  | Sí           |
| Día de Muertos | `dia-de-muertos` | `Campaña_DiaDeMuertos` | No (sin portada) |
| Navidad        | `navidad`        | `Campaña_Navidad`      | Sí           |
| Año Nuevo      | `ano-nuevo`      | `Campaña_AnoNuevo` o `Campaña_Año Nuevo` | Sí           |
| Agendas 2027   | `agendas-2027`   | `Campaña_Agendas2027`  | Sí           |

El home anuncia toda campaña que tenga portada, sin fechas. Para retirarla del
home, quitarle la portada en `app/lib/campanas.js`.

## Qué se cambia dónde

- **Título, texto y banner:** en la colección de Shopify (Productos →
  Colecciones). Se ven en la landing al momento, sin deploy.
- **Productos:** la etiqueta de la campaña. Se puede poner a mano en Shopify o
  con el script (abajo). Si el equipo usa otra etiqueta, se agrega en `tags`
  de `app/lib/campanas.js` y el script se la suma a la colección.
- **Portada del home:** en `app/lib/campanas.js`. Una campaña sin `portada`
  no sale en el home. Requiere deploy.

## Agregar productos desde el Excel de SKUs

1. Pasar los SKUs a `scripts/campanas/skus.json`, bajo el handle de la
   campaña. Un SKU con sufijo de color (`A2148.05`) hace que la landing
   enseñe ese color.
2. Si hay banner nuevo, guardarlo como `scripts/campanas/<handle>-banner.jpg`.
   Sólo se sube si la colección todavía no tiene imagen.
3. Correr:

   ```bash
   set -a; . ./.env; set +a; PUBLIC_STORE_DOMAIN=development-gi.myshopify.com node scripts/campanas.mjs --solo octubre-rosa
   ```

   Con `--dry-run` sólo informa. El script regenera
   `app/lib/campanas-variantes.js`. Ese archivo va en el siguiente deploy.

Ojo: si la sincronización con proveedores reemplaza todas las etiquetas, la de
campaña se pierde y hay que volver a correr el script.
