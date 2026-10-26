/* Campañas por temporada: una colección automática de Shopify por campaña
   (etiqueta `Campaña_…`), con su landing en /temporada/:handle.

   Qué vive dónde:
     - Título, texto y banner: en la colección de Shopify. Mercadotecnia los
       cambia desde el admin sin deploy.
     - Productos: la etiqueta. La pone scripts/campanas.mjs a partir del Excel
       de SKUs (scripts/campanas/skus.json).
     - Qué sale en el home y con qué portada: aquí. Sale toda campaña con
       portada, en el orden de esta lista; sin portada no sale.
     - `tags`: las etiquetas que junta la colección (cualquiera de ellas).
       `tag` es la que pone el script; `tags` suma las que pone el equipo a
       mano en Shopify. Sin `tags`, la colección usa sólo `tag`. */
import variantes from './campanas-variantes.js';

export const CAMPANAS = [
  {
    handle: 'octubre-rosa',
    titulo: 'Octubre Rosa',
    tag: 'Campaña_OctubreRosa',
    portada: '/campanas/octubre-rosa-portada.jpg',
    tema: 'Prevención y detección oportuna',
  },
  {
    handle: 'dia-de-muertos',
    titulo: 'Día de Muertos',
    tag: 'Campaña_DiaDeMuertos',
    portada: null,
    tema: 'Tradición mexicana',
  },
  {
    handle: 'navidad',
    titulo: 'Navidad',
    tag: 'Campaña_Navidad',
    portada: '/campanas/navidad-portada.jpg',
    tema: 'Compartir, agradecer y disfrutar juntos',
  },
  {
    handle: 'ano-nuevo',
    titulo: 'Año Nuevo',
    tag: 'Campaña_AnoNuevo',
    // La del Excel de SKUs y la que usa el equipo en Shopify.
    tags: ['Campaña_AnoNuevo', 'Campaña_Año Nuevo'],
    portada: '/campanas/ano-nuevo-portada.jpg',
    tema: 'Nuevos comienzos',
  },
  {
    handle: 'agendas-2027',
    titulo: 'Agendas 2027',
    tag: 'Campaña_Agendas2027',
    portada: '/campanas/agendas-2027-portada.jpg',
    tema: 'Ideas, planes y nuevos objetivos',
  },
];

/** Las etiquetas que junta la colección de una campaña. */
export const etiquetasDe = (campana) => campana.tags ?? [campana.tag];

export const campanaPorHandle = (handle) =>
  CAMPANAS.find((c) => c.handle === handle) ?? null;

export const campanaHref = (handle) => `/temporada/${handle}`;

/** Las campañas que el home anuncia: todas las que tienen portada. */
export function campanasActivas() {
  return CAMPANAS.filter((c) => c.portada);
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
