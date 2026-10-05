import {describe, it, expect} from 'vitest';
import {CATEGORY_TREE, flattenTree, typeTagFor, normalizeTitle} from './category-tree.js';

const nodos = flattenTree();
const sub = (handle) => nodos.find((n) => n.handle === handle && n.level === 2);

describe('árbol de categorías', () => {
  it('tiene 8 categorías, con 3 niveles como máximo', () => {
    expect(CATEGORY_TREE.map((c) => c.title)).toEqual([
      'Bebidas', 'Oficina', 'Textil', 'Hogar', 'Salud y belleza', 'Tecnología', 'Tiempo libre', 'Ecológicos',
    ]);
    expect(Math.max(...nodos.map((n) => n.level))).toBe(3);
  });

  it('cada colección aparece una sola vez', () => {
    const handles = nodos.map((n) => n.handle);
    expect(handles.length).toBe(new Set(handles).size);
  });

  it('cada tipo (nivel 3) tiene su propia etiqueta y una forma de asignarla', () => {
    const tipos = nodos.filter((n) => n.level === 3);
    const etiquetas = tipos.map((t) => t.tags[0]);
    expect(etiquetas.length).toBe(new Set(etiquetas).size);
    for (const t of tipos) {
      expect(t.tags, t.handle).toHaveLength(1);
      expect(Boolean(t.match) !== Boolean(t.fromTag), `${t.handle}: match o fromTag, no ambos`).toBe(true);
      if (t.match) expect(() => new RegExp(t.match), t.handle).not.toThrow();
    }
  });

  it('las etiquetas van en minúsculas y sin acentos, como las de los proveedores', () => {
    for (const n of nodos) for (const t of n.tags) expect(t, n.handle).toBe(normalizeTitle(t).toLowerCase());
  });
});

describe('typeTagFor', () => {
  const p = (title, tags = []) => ({title, tags});

  it('asigna el tipo por palabras del título, en orden', () => {
    expect(typeTagFor(sub('tazas'), p('TARRO CERVECERO VIKINGO'))).toBe('tarros');
    expect(typeTagFor(sub('tazas'), p('Taza mágica para sublimación'))).toBe('tazas para sublimar');
    expect(typeTagFor(sub('tazas'), p('TAZA DE CERÁMICA BICOLOR'))).toBe('tazas de ceramica');
    expect(typeTagFor(sub('termos'), p('MUG TÉRMICO ACERO'))).toBe('mugs de viaje');
    expect(typeTagFor(sub('mochilas-y-maletas'), p('MALETA DE VIAJE BEIJING A2967'))).toBe('maletas y trolleys');
  });

  it('usa la etiqueta del proveedor cuando el tipo ya existe', () => {
    expect(typeTagFor(sub('boligrafos'), p('BOLÍGRAFO X', ['boligrafos de metal']))).toBe('boligrafos de metal');
  });

  it('devuelve null si ninguna regla coincide', () => {
    expect(typeTagFor(sub('cocina'), p('DELANTAL DE CHEF'))).toBeNull();
  });

  it('no confunde palabras que contienen la regla ("LUNCH" no es "LON")', () => {
    expect(typeTagFor(sub('hieleras-y-loncheras'), p('BOLSA LONDRES'))).toBeNull();
  });
});
