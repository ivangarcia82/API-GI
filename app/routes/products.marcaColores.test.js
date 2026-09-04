import {describe, it, expect} from 'vitest';
import {productMatchesBrand} from '~/lib/brand-colors';
import {esFueraDeMarca, esTonoDeMarca, opcionesDeMarca} from './products.$handle.jsx';

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

/* Ocultar los tonos ajenos no basta: si la ficha aterriza en una variante que
   el cliente no puede pedir, su foto, su precio y el botón de cotizar apuntan a
   un color que ya no aparece en el selector. Hay que arrancar en uno suyo. */

const variante = (color) => ({
  id: `gid://variant/${color}`,
  selectedOptions: [
    {name: 'Color', value: color},
    {name: 'Talla', value: 'UNICA'},
  ],
});

const producto = (colorActual, tonos = ['AZUL', 'ROJO', 'NEGRO']) => ({
  handle: 'mochila-test',
  options: [
    {
      name: 'Color',
      optionValues: tonos.map((t) => ({name: t, firstSelectableVariant: variante(t)})),
    },
    {name: 'Talla', optionValues: [{name: 'UNICA'}]},
  ],
  selectedOrFirstAvailableVariant: variante(colorActual),
});

describe('ficha · arrancar en un color de la marca', () => {
  it('sin paleta no redirige', () => {
    expect(opcionesDeMarca(producto('AZUL'), [])).toBeNull();
  });

  it('no redirige si la variante resuelta ya es de su color', () => {
    expect(opcionesDeMarca(producto('ROJO'), ['rojo'])).toBeNull();
  });

  it('redirige a la primera variante de su color cuando la resuelta es ajena', () => {
    expect(opcionesDeMarca(producto('AZUL'), ['rojo'])).toEqual([
      {name: 'Color', value: 'ROJO'},
      {name: 'Talla', value: 'UNICA'},
    ]);
  });

  it('respeta el orden en que la tienda declara los tonos', () => {
    expect(opcionesDeMarca(producto('AZUL'), ['negro', 'rojo'])).toEqual([
      {name: 'Color', value: 'ROJO'},
      {name: 'Talla', value: 'UNICA'},
    ]);
  });

  /* El producto que sólo se alcanza por link directo: no hay a dónde llevarle,
     y la ficha ya le enseña todos los tonos con su banda de aviso. */
  it('no redirige si el producto no tiene ningún color de su marca', () => {
    expect(opcionesDeMarca(producto('AZUL', ['AZUL', 'VERDE']), ['rojo'])).toBeNull();
  });

  it('no redirige si el producto no tiene opción de color', () => {
    const sinColor = {
      handle: 'x',
      options: [{name: 'Talla', optionValues: [{name: 'CH'}]}],
      selectedOrFirstAvailableVariant: {id: 'v', selectedOptions: [{name: 'Talla', value: 'CH'}]},
    };
    expect(opcionesDeMarca(sinColor, ['rojo'])).toBeNull();
  });

  /* El fallo clásico de esto es el bucle: se comprueba aplicando la función al
     estado en el que deja la propia redirección. */
  it('no vuelve a redirigir desde el destino al que redirigió', () => {
    const destino = opcionesDeMarca(producto('AZUL'), ['rojo']);
    const color = destino.find((o) => o.name === 'Color').value;
    expect(opcionesDeMarca(producto(color), ['rojo'])).toBeNull();
  });
});
