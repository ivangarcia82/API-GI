import {describe, it, expect} from 'vitest';
import {HOME_CATEGORIES} from './gi.js';

describe('HOME_CATEGORIES', () => {
  it('está ordenada alfabéticamente por nombre', () => {
    const nombres = HOME_CATEGORIES.map((c) => c.name);
    const ordenados = [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
    expect(nombres).toEqual(ordenados);
  });
});

describe('HOME_CATEGORIES y el árbol', () => {
  it('son las 8 categorías principales del árbol aprobado', async () => {
    const {CATEGORY_TREE} = await import('./category-tree.js');
    expect(HOME_CATEGORIES.map((c) => c.handle).sort()).toEqual(CATEGORY_TREE.map((c) => c.handle).sort());
    for (const c of HOME_CATEGORIES) {
      expect(c.name).toBe(CATEGORY_TREE.find((t) => t.handle === c.handle).title);
    }
  });
});
