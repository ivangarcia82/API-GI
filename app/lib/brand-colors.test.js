import {describe, it, expect} from 'vitest';
import {
  parseBrandColors,
  effectiveColorFamilies,
  visibleColorSelection,
  brandProductFilters,
  productMatchesBrand,
  keepBrandProducts,
} from './brand-colors.js';

/* El metafield es list.single_line_text_field SIN validación de choices: es
   texto libre que escribe una persona en el admin. Todo lo que sigue son
   valores que de verdad puede traer. */
describe('parseBrandColors', () => {
  it('traduce el valor real de la tienda a familias', () => {
    expect(parseBrandColors('["Rojo","Negro"]')).toEqual(['rojo', 'negro']);
  });

  it('clasifica tonos compuestos por su familia', () => {
    expect(parseBrandColors('["AZUL MARINO","Verde Pistacho"]')).toEqual(['azul', 'verde']);
  });

  it('colapsa los que caen en la misma familia', () => {
    expect(parseBrandColors('["Rojo","Vino","Guinda"]')).toEqual(['rojo']);
  });

  it('descarta lo que no es un color y conserva lo que sí', () => {
    expect(parseBrandColors('["Pantone 186C","Negro"]')).toEqual(['negro']);
  });

  /* Fail-open: una errata en el admin no puede vaciarle el catálogo a un
     cliente. Sin familias reconocibles, no se filtra. */
  it('devuelve vacío si nada es reconocible', () => {
    expect(parseBrandColors('["Pantone 186C","#c2352c"]')).toEqual([]);
  });

  it.each([
    ['null', null],
    ['cadena vacía', ''],
    ['JSON roto', '["Rojo"'],
    ['no es un array', '{"color":"Rojo"}'],
    ['array vacío', '[]'],
  ])('devuelve vacío con %s', (_, valor) => {
    expect(parseBrandColors(valor)).toEqual([]);
  });
});

describe('effectiveColorFamilies', () => {
  it('sin marca respeta la selección del usuario', () => {
    expect(effectiveColorFamilies(['verde'], [])).toEqual(['verde']);
  });

  it('con marca y sin selección devuelve la paleta entera', () => {
    expect(effectiveColorFamilies([], ['rojo', 'negro'])).toEqual(['rojo', 'negro']);
  });

  it('con marca y selección devuelve la intersección', () => {
    expect(effectiveColorFamilies(['rojo', 'verde'], ['rojo', 'negro'])).toEqual(['rojo']);
  });

  /* Nadie se sale de su paleta editando la URL a mano. */
  it('vuelve a la paleta si la selección queda fuera de ella', () => {
    expect(effectiveColorFamilies(['verde'], ['rojo', 'negro'])).toEqual(['rojo', 'negro']);
  });
});

describe('visibleColorSelection', () => {
  it('sin marca es la selección tal cual', () => {
    expect(visibleColorSelection(['verde'], [])).toEqual(['verde']);
  });

  /* Los chips sólo pueden prometer lo que la consulta está aplicando: un chip
     "Verde" con una x que no quita nada sería mentir. */
  it('con marca borra lo que no es de la paleta', () => {
    expect(visibleColorSelection(['rojo', 'verde'], ['rojo', 'negro'])).toEqual(['rojo']);
  });
});

const VOCABULARIO = [
  {label: 'ROJO', count: 66},
  {label: 'VINO', count: 5},
  {label: 'NEGRO', count: 61},
  {label: 'AZUL MARINO', count: 15},
  {label: 'UNICO', count: 2},
];

describe('brandProductFilters', () => {
  it('expande cada familia a todos sus tonos del catálogo', () => {
    expect(brandProductFilters(['rojo'], VOCABULARIO)).toEqual([
      {variantOption: {name: 'color', value: 'ROJO'}},
      {variantOption: {name: 'color', value: 'VINO'}},
    ]);
  });

  it('sin marca no filtra', () => {
    expect(brandProductFilters([], VOCABULARIO)).toBeNull();
  });

  /* Fail-closed, el único caso: la marca es morada y la tienda no vende nada
     morado. La verdad es "no hay nada para ti aquí", no "toma el catálogo
     entero". Un valor imposible es cómo se le dice eso a la API sin que cada
     loader tenga que ramificar. */
  it('devuelve un filtro imposible si ninguna familia existe en el catálogo', () => {
    const out = brandProductFilters(['morado'], VOCABULARIO);
    expect(out).toHaveLength(1);
    expect(out[0].variantOption.value).toBe('GI-SIN-COINCIDENCIA');
  });
});

describe('productMatchesBrand', () => {
  const producto = {colors: ['ROJO', 'AZUL MARINO', 'UNICO']};

  it('sin marca pasa todo', () => {
    expect(productMatchesBrand(producto, [])).toBe(true);
  });

  /* ANY: basta con que se pueda pedir en uno de sus colores. */
  it('basta con que coincida un tono', () => {
    expect(productMatchesBrand(producto, ['rojo'])).toBe(true);
  });

  it('no coincide si ningún tono es de la paleta', () => {
    expect(productMatchesBrand(producto, ['verde'])).toBe(false);
  });

  it('lee la opción de variante cuando no viene normalizado', () => {
    const crudo = {options: [{name: 'Color', optionValues: [{name: 'NEGRO'}]}]};
    expect(productMatchesBrand(crudo, ['negro'])).toBe(true);
  });

  /* UNICO / TRANSPARENTE / MARMOLEADO no son colores: no pertenecen a ninguna
     familia y por tanto no salvan a un producto. */
  it('un producto sólo en tonos no clasificables no coincide con nada', () => {
    expect(productMatchesBrand({colors: ['UNICO', 'TRANSPARENTE']}, ['rojo'])).toBe(false);
  });

  it('un producto sin colores no coincide', () => {
    expect(productMatchesBrand({colors: []}, ['rojo'])).toBe(false);
  });
});

describe('keepBrandProducts', () => {
  const lista = [{id: 1, colors: ['ROJO']}, {id: 2, colors: ['VERDE']}];

  it('sin marca devuelve la lista intacta', () => {
    expect(keepBrandProducts(lista, [])).toBe(lista);
  });

  it('con marca deja sólo los que coinciden', () => {
    expect(keepBrandProducts(lista, ['rojo']).map((p) => p.id)).toEqual([1]);
  });
});
