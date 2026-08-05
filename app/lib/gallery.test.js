import {describe, it, expect} from 'vitest';
import {resolveVariantImageIndex} from './gallery';

const IMG = (n) => `gid://shopify/ProductImage/${n}`;

const galeria = [
  {id: IMG(1), url: 'frente.jpg'},
  {id: IMG(2), url: 'rojo.jpg'},
  {id: IMG(3), url: 'detalle.jpg'},
];

describe('resolveVariantImageIndex — empareja por id', () => {
  it('devuelve la posición de la foto de la variante', () => {
    expect(resolveVariantImageIndex(galeria, {id: IMG(2)})).toBe(1);
    expect(resolveVariantImageIndex(galeria, {id: IMG(3)})).toBe(2);
  });

  it('empareja también la primera foto de la galería', () => {
    expect(resolveVariantImageIndex(galeria, {id: IMG(1)})).toBe(0);
  });
});

/* En esta tienda sólo algunas variantes tienen imagen asignada, así que el
   fallback no es un caso raro: es el camino habitual de media catálogo. */
describe('resolveVariantImageIndex — cae a la primera foto', () => {
  it('cuando la variante no trae imagen', () => {
    expect(resolveVariantImageIndex(galeria, null)).toBe(0);
    expect(resolveVariantImageIndex(galeria, undefined)).toBe(0);
    expect(resolveVariantImageIndex(galeria, {})).toBe(0);
  });

  it('cuando la imagen de la variante no está en la galería', () => {
    expect(resolveVariantImageIndex(galeria, {id: IMG(99)})).toBe(0);
  });

  it('sin emparejar dos ids nulos entre sí', () => {
    // `Image.id` es nullable en la Storefront API. Sin guardia, findIndex
    // emparejaría null con null y devolvería 1 en vez del fallback.
    const conNulo = [{id: IMG(1), url: 'frente.jpg'}, {id: null, url: 'x.jpg'}];
    expect(resolveVariantImageIndex(conNulo, {id: null})).toBe(0);
  });

  it('cuando la galería viene vacía o no es un arreglo', () => {
    expect(resolveVariantImageIndex([], {id: IMG(2)})).toBe(0);
    expect(resolveVariantImageIndex(undefined, {id: IMG(2)})).toBe(0);
    expect(resolveVariantImageIndex(null, {id: IMG(2)})).toBe(0);
  });
});
