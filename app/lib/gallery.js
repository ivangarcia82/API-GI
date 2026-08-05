/* Generando Ideas — galería de la PDP.
 *
 * Shopify permite asignar UNA imagen a cada variante, pero en esta tienda
 * sólo algunas la tienen. Cuando no hay con qué emparejar, se vuelve a la
 * primera foto: es preferible enseñar la imagen genérica del producto a
 * dejar en pantalla la del color anterior mientras el selector dice otro.
 */

import {useState} from 'react';

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
  // `img?.id &&` protege de un elemento nulo dentro de la galería: sin él,
  // un `null` en el arreglo revienta al leer `img.id`. Que la variante traiga
  // id nulo ya lo resolvió el early-return de arriba.
  const i = images.findIndex((img) => img?.id && img.id === id);
  return i >= 0 ? i : 0;
}

/**
 * Índice de la foto activa de la galería, sincronizado con la variante elegida.
 *
 * @param {Array<{id?: string|null}>|null|undefined} images galería del producto
 * @param {{id?: string, image?: {id?: string|null}|null}|null|undefined} selectedVariant
 * @returns {[number, (i: number) => void]} índice activo y su setter
 */
export function useVariantGallery(images, selectedVariant) {
  // Inicializador perezoso: cubre el primer pintado (SSR e hidratación).
  // Entrar directo a ?Color=Rojo debe enseñar la foto roja, no la genérica.
  const [activeImg, setActiveImg] = useState(() =>
    resolveVariantImageIndex(images, selectedVariant?.image),
  );
  const [syncedVariantId, setSyncedVariantId] = useState(selectedVariant?.id);
  /* Ajuste durante el render —no en un useEffect— para que la foto salga en el
     mismo frame que el precio y el SKU; con useEffect habría un frame
     intermedio con la foto anterior. Un clic manual en una miniatura manda
     sobre la variante hasta el siguiente cambio, porque syncedVariantId no se
     mueve. La comparación es por id, no por identidad del objeto. */
  if (selectedVariant?.id !== syncedVariantId) {
    setSyncedVariantId(selectedVariant?.id);
    setActiveImg(resolveVariantImageIndex(images, selectedVariant?.image));
  }
  return [activeImg, setActiveImg];
}
