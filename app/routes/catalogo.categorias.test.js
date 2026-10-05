import {describe, it, expect, vi} from 'vitest';

vi.mock('@shopify/hydrogen', () => ({
  getPaginationVariables: () => ({first: 24, endCursor: null}),
  Pagination: () => null,
}));

import {encabezadoCatalogo} from './catalogo.jsx';

describe('encabezado del catálogo con el árbol de categorías', () => {
  it('un tipo (nivel 3) lleva su nombre y la ruta de sus padres', () => {
    const e = encabezadoCatalogo({cat: 'tarros', q: ''});
    expect(e.titulo).toBe('Tarros');
    expect(e.ruta.map((n) => n.title)).toEqual(['Bebidas', 'Tazas y tarros']);
    expect(e.raiz).toBe('bebidas');
  });

  it('una categoría principal no lleva ruta', () => {
    const e = encabezadoCatalogo({cat: 'tiempo-libre', q: ''});
    expect(e.titulo).toBe('Tiempo libre');
    expect(e.ruta).toEqual([]);
    expect(e.raiz).toBe('tiempo-libre');
  });

  it('sin categoría, o con una colección fuera del árbol', () => {
    expect(encabezadoCatalogo({cat: '', q: ''}).titulo).toBe('Todos los productos');
    expect(encabezadoCatalogo({cat: 'mundial', q: ''}).titulo).toBe('Todos los productos');
  });

  it('la búsqueda manda sobre la categoría', () => {
    expect(encabezadoCatalogo({cat: 'tarros', q: 'vikingo'}).titulo).toBe('Resultados · “vikingo”');
  });
});
