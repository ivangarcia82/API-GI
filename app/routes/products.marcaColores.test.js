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
   ninguna lista, la ficha tiene que avisarlo — y viceversa.
   Importante: los booleanos esperados (`avisa`, `pasaListado`) están escritos
   a mano en cada caso, nunca calculados llamando a esFueraDeMarca ni a
   productMatchesBrand. Comparar el resultado de una función contra el
   resultado de la otra es `X === X`: pasaría igual aunque la lógica de
   ambas estuviera rota de la misma forma. Comparando contra un literal fijo
   se prueban las dos rutas de verdad, y por separado. */
describe('ficha · coherente con los listados', () => {
  it('tonos fuera de la paleta: avisa, y el post-filtro lo dejaría fuera', () => {
    const tonos = ['AZUL', 'VERDE'];
    const marca = ['rojo'];
    expect(esFueraDeMarca({name: 'Color', optionValues: tonos.map((name) => ({name}))}, marca)).toBe(
      true,
    );
    expect(productMatchesBrand({colors: tonos}, marca)).toBe(false);
  });

  it('un tono sí es de la paleta: no avisa, y el post-filtro lo dejaría pasar', () => {
    const tonos = ['AZUL', 'ROJO'];
    const marca = ['rojo'];
    expect(esFueraDeMarca({name: 'Color', optionValues: tonos.map((name) => ({name}))}, marca)).toBe(
      false,
    );
    expect(productMatchesBrand({colors: tonos}, marca)).toBe(true);
  });

  it('sólo tonos no clasificables (UNICO/TRANSPARENTE): avisa, y el post-filtro lo dejaría fuera', () => {
    const tonos = ['UNICO', 'TRANSPARENTE'];
    const marca = ['rojo'];
    expect(esFueraDeMarca({name: 'Color', optionValues: tonos.map((name) => ({name}))}, marca)).toBe(
      true,
    );
    expect(productMatchesBrand({colors: tonos}, marca)).toBe(false);
  });
});
