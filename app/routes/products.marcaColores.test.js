import {describe, it, expect} from 'vitest';
import {productMatchesBrand} from '~/lib/brand-colors';
import {esFueraDeMarca, esTonoDeMarca} from './products.$handle.jsx';

const OPCION_COLOR = {
  name: 'Color',
  optionValues: [{name: 'AZUL'}, {name: 'VERDE'}],
};

describe('ficha · fuera de la paleta', () => {
  it('sin paleta nunca avisa', () => {
    expect(esFueraDeMarca(OPCION_COLOR, [])).toBe(false);
  });

  it('avisa cuando ningún tono es de la paleta', () => {
    expect(esFueraDeMarca(OPCION_COLOR, ['rojo'])).toBe(true);
  });

  it('no avisa si alguno sí lo es', () => {
    expect(esFueraDeMarca(OPCION_COLOR, ['azul'])).toBe(false);
  });

  it('un producto sin opción de color no dispara el aviso', () => {
    expect(esFueraDeMarca(undefined, ['rojo'])).toBe(false);
  });
});

describe('ficha · marcado de tonos', () => {
  it('marca los tonos que no son de la paleta', () => {
    expect(esTonoDeMarca('AZUL', ['azul'])).toBe(true);
    expect(esTonoDeMarca('VERDE', ['azul'])).toBe(false);
  });

  it('sin paleta todos los tonos valen', () => {
    expect(esTonoDeMarca('VERDE', [])).toBe(true);
  });
});

/* Coherencia con el resto de la aplicación: si el producto no aparece en
   ninguna lista, la ficha tiene que avisarlo. */
describe('ficha · coherente con los listados', () => {
  it('avisa exactamente cuando el producto no pasaría el post-filtro', () => {
    const producto = {colors: ['AZUL', 'VERDE']};
    expect(esFueraDeMarca(OPCION_COLOR, ['rojo'])).toBe(!productMatchesBrand(producto, ['rojo']));
  });
});
