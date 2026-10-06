import {describe, it, expect} from 'vitest';
import {opcionesDeVariante, textoOpciones, leerOpciones, guardarOpciones} from './variantOptions';

describe('opciones de la variante cotizada', () => {
  it('descarta el "Default Title" de un producto sin opciones', () => {
    expect(opcionesDeVariante([{name: 'Title', value: 'Default Title'}])).toEqual([]);
    expect(guardarOpciones([{name: 'Title', value: 'Default Title'}])).toBeNull();
  });

  it('se lee como "Color: ROSA · Talla: M"', () => {
    expect(
      textoOpciones([
        {name: 'Color', value: 'ROSA'},
        {name: 'Talla', value: 'M'},
      ]),
    ).toBe('Color: ROSA · Talla: M');
    expect(textoOpciones(null)).toBe('');
  });

  it('va y vuelve de la columna sin perder nada, y tolera basura', () => {
    const o = [{name: 'Color', value: 'NEGRO'}];
    expect(leerOpciones(guardarOpciones(o))).toEqual(o);
    expect(leerOpciones(null)).toEqual([]);
    expect(leerOpciones('{no es json')).toEqual([]);
  });
});
