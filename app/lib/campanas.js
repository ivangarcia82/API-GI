/* Campañas por temporada: una colección automática de Shopify por campaña
   (etiqueta `Campaña_…`), con su landing en /temporada/:handle.

   Qué vive dónde:
     - Título, texto y banner: en la colección de Shopify. Mercadotecnia los
       cambia desde el admin sin deploy.
     - Productos: la etiqueta. La pone scripts/campanas.mjs a partir del Excel
       de SKUs (scripts/campanas/skus.json).
     - Cuándo sale en el home y con qué portada: aquí. Sin portada no sale.

   Las fechas son mes-día (MM-DD) en hora de México y se repiten cada año. Una
   ventana que cruza el año (12-26 → 01-15) también vale. La landing sigue
   abierta fuera de su ventana: sólo deja de anunciarse en el home. */
import variantes from './campanas-variantes.js';

export const CAMPANAS = [
  {
    handle: 'octubre-rosa',
    titulo: 'Octubre Rosa',
    tag: 'Campaña_OctubreRosa',
    desde: '10-01',
    hasta: '10-31',
    portada: '/campanas/octubre-rosa-portada.jpg',
    tema: 'Prevención y detección oportuna',
  },
  {
    handle: 'dia-de-muertos',
    titulo: 'Día de Muertos',
    tag: 'Campaña_DiaDeMuertos',
    desde: '10-15',
    hasta: '11-02',
    portada: null,
    tema: 'Tradición mexicana',
  },
  {
    handle: 'navidad',
    titulo: 'Navidad',
    tag: 'Campaña_Navidad',
    desde: '11-15',
    hasta: '12-25',
    portada: null,
    tema: 'Regalos de fin de año',
  },
  {
    handle: 'ano-nuevo',
    titulo: 'Año Nuevo',
    tag: 'Campaña_AnoNuevo',
    desde: '12-26',
    hasta: '01-15',
    portada: null,
    tema: 'Arranque de año',
  },
];

export const campanaPorHandle = (handle) =>
  CAMPANAS.find((c) => c.handle === handle) ?? null;

export const campanaHref = (handle) => `/temporada/${handle}`;

/** "MM-DD" de una fecha, en hora de México (el servidor corre en UTC). */
export function mesDia(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const v = (t) => partes.find((p) => p.type === t).value;
  return `${v('month')}-${v('day')}`;
}

/** ¿Cae `md` (MM-DD) en la ventana? Las cadenas MM-DD se comparan en orden. */
export function enVentana({desde, hasta}, md) {
  return desde <= hasta
    ? md >= desde && md <= hasta
    : md >= desde || md <= hasta;
}

/** Las campañas que el home anuncia hoy: con portada y dentro de su ventana. */
export function campanasActivas(fecha = new Date()) {
  const md = mesDia(fecha);
  return CAMPANAS.filter((c) => c.portada && enVentana(c, md));
}

/**
 * En la landing, cada producto se enseña en el color que pidió la campaña
 * (A2148.05 es la variante rosa): su foto, su variante para cotizar y un
 * enlace que abre la ficha ya en ese color. Lo que no tiene variante fijada
 * se queda como venía.
 *
 * `variantes` (campanas-variantes.js) lo genera scripts/campanas.mjs: {campaña: {handle: {...}}}.
 * @param {string} campana handle de la campaña
 * @param {object} producto ya normalizado
 */
export function enColorDeCampana(campana, producto, mapa = variantes) {
  const v = mapa?.[campana]?.[producto?.handle];
  if (!v) return producto;
  const params = new URLSearchParams(v.opciones.map((o) => [o.name, o.value]));
  return {
    ...producto,
    image: v.imagen || producto.image,
    firstVariantId: v.variantId || producto.firstVariantId,
    sku: v.sku || producto.sku,
    url: `/products/${producto.handle}?${params}`,
  };
}
