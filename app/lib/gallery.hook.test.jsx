// @vitest-environment jsdom
import {describe, it, expect} from 'vitest';
import {act, renderHook} from '@testing-library/react';
import {useVariantGallery} from './gallery';

const IMG = (n) => `gid://shopify/ProductImage/${n}`;

const galeria = [
  {id: IMG(1), url: 'frente.jpg'},
  {id: IMG(2), url: 'rojo.jpg'},
  {id: IMG(3), url: 'azul.jpg'},
];

/** Variante de prueba: `imagenId` nulo simula la que no tiene foto asignada. */
const variante = (id, imagenId) => ({
  id: `gid://shopify/ProductVariant/${id}`,
  image: imagenId ? {id: IMG(imagenId)} : null,
});

const montar = (v) =>
  renderHook(({variant}) => useVariantGallery(galeria, variant), {
    initialProps: {variant: v},
  });

describe('useVariantGallery — primer pintado', () => {
  it('arranca en la foto de la variante seleccionada', () => {
    const {result} = montar(variante(1, 2));
    expect(result.current[0]).toBe(1);
  });

  it('arranca en la primera foto si la variante no trae imagen', () => {
    const {result} = montar(variante(1, null));
    expect(result.current[0]).toBe(0);
  });
});

describe('useVariantGallery — cambio de variante', () => {
  it('salta a la foto de la variante nueva', () => {
    const {result, rerender} = montar(variante(1, 2));
    expect(result.current[0]).toBe(1);
    rerender({variant: variante(2, 3)});
    expect(result.current[0]).toBe(2);
  });

  it('vuelve a la primera foto si la variante nueva no trae imagen', () => {
    const {result, rerender} = montar(variante(1, 2));
    rerender({variant: variante(2, null)});
    expect(result.current[0]).toBe(0);
  });
});

describe('useVariantGallery — el clic manual manda', () => {
  it('conserva la miniatura elegida a mano mientras no cambie la variante', () => {
    const {result, rerender} = montar(variante(1, 2));
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);
    // Mismo id, objeto distinto: la comparación es por id, no por identidad.
    rerender({variant: variante(1, 2)});
    expect(result.current[0]).toBe(2);
  });

  it('descarta la elección manual al cambiar de variante', () => {
    const {result, rerender} = montar(variante(1, 2));
    act(() => result.current[1](0));
    expect(result.current[0]).toBe(0);
    rerender({variant: variante(2, 3)});
    expect(result.current[0]).toBe(2);
  });
});
