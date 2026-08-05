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
