import {describe, it, expect} from 'vitest';
import {HOME_CATEGORIES} from './gi.js';

describe('HOME_CATEGORIES', () => {
  it('está ordenada alfabéticamente por nombre', () => {
    const nombres = HOME_CATEGORIES.map((c) => c.name);
    const ordenados = [...nombres].sort((a, b) => a.localeCompare(b, 'es'));
    expect(nombres).toEqual(ordenados);
  });
});
