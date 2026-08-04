import {describe, it, expect} from 'vitest';
import {formatSpecValue, buildProductSpecs} from './specs';

/* ------------------------------------------------------------------ *
 * Qué se considera "sin valor" y por tanto no se pinta                *
 * ------------------------------------------------------------------ */

describe('formatSpecValue — casos que se ocultan', () => {
  it('descarta nulo, indefinido y cadena vacía', () => {
    expect(formatSpecValue(null)).toBeNull();
    expect(formatSpecValue(undefined)).toBeNull();
    expect(formatSpecValue('')).toBeNull();
    expect(formatSpecValue('   ')).toBeNull();
  });

  it('descarta el cero en sus formas habituales', () => {
    expect(formatSpecValue('0')).toBeNull();
    expect(formatSpecValue(0)).toBeNull();
    expect(formatSpecValue('0.0')).toBeNull();
    expect(formatSpecValue('0,00')).toBeNull();
    expect(formatSpecValue('0 cm')).toBeNull();
  });

  it('descarta medidas en cero escritas de cualquier manera', () => {
    expect(formatSpecValue('0x0x0')).toBeNull();
    expect(formatSpecValue('0 x 0 x 0')).toBeNull();
    expect(formatSpecValue('0X0X0')).toBeNull();
    expect(formatSpecValue('0×0×0')).toBeNull();
    expect(formatSpecValue('0x0')).toBeNull();
    expect(formatSpecValue('0 x 0 x 0 cm')).toBeNull();
    expect(formatSpecValue('0.0 x 0.0 x 0.0')).toBeNull();
  });

  it('descarta marcadores de "sin dato"', () => {
    expect(formatSpecValue('N/A')).toBeNull();
    expect(formatSpecValue('n/a')).toBeNull();
    expect(formatSpecValue('-')).toBeNull();
    expect(formatSpecValue('--')).toBeNull();
  });

  it('descarta un metafield de dimensión con valor cero', () => {
    // Los metafields tipo `dimension` llegan como JSON, no como texto.
    expect(formatSpecValue('{"value":0,"unit":"CENTIMETERS"}')).toBeNull();
  });

  it('descarta listas vacías o de puros ceros', () => {
    expect(formatSpecValue('[]')).toBeNull();
    expect(formatSpecValue('["0","0"]')).toBeNull();
  });
});

describe('formatSpecValue — casos que sí se muestran', () => {
  it('deja pasar el texto normal', () => {
    expect(formatSpecValue('Acero inoxidable')).toBe('Acero inoxidable');
    expect(formatSpecValue('  Poliéster 600D  ')).toBe('Poliéster 600D');
  });

  it('deja pasar medidas reales', () => {
    expect(formatSpecValue('8x8x21')).toBe('8x8x21');
    expect(formatSpecValue('8 x 8 x 21 cm')).toBe('8 x 8 x 21 cm');
  });

  it('conserva las medidas sin ceros tal cual', () => {
    expect(formatSpecValue('0.5')).toBe('0.5');
    expect(formatSpecValue('20x30')).toBe('20x30');
    expect(formatSpecValue('8 x 21 cm')).toBe('8 x 21 cm');
  });

  it('recorta el componente en cero y conserva el resto', () => {
    // Un tercio del catálogo son cilindros medidos como "alto x diámetro x 0".
    expect(formatSpecValue('22.5 x 7.7 x 0 cm')).toBe('22.5 x 7.7 cm');
    expect(formatSpecValue('24 x 7.5 x 0 cm')).toBe('24 x 7.5 cm');
    expect(formatSpecValue('21 x 14 x 0 cm')).toBe('21 x 14 cm');
    expect(formatSpecValue('10x0x5')).toBe('10x5');
    expect(formatSpecValue('0 x 5 x 3 cm')).toBe('5 x 3 cm');
  });

  it('respeta el separador y la unidad al recortar', () => {
    expect(formatSpecValue('30x8.5x0 cm')).toBe('30x8.5 cm');
    expect(formatSpecValue('50 X 50 X 0 mm')).toBe('50 X 50 mm');
    expect(formatSpecValue('12 × 4 × 0 cm')).toBe('12 × 4 cm');
  });

  it('oculta la fila si al recortar no queda ninguna medida', () => {
    expect(formatSpecValue('0 x 0 x 0 cm')).toBeNull();
  });

  it('no toca un texto que no es una lista de medidas', () => {
    // "4 x 15 cm / 4 x 8 cm" son dos áreas alternativas: no se recorta nada.
    expect(formatSpecValue('4 x 15 cm / 4 x 8 cm')).toBe('4 x 15 cm / 4 x 8 cm');
    expect(formatSpecValue('Acero inoxidable')).toBe('Acero inoxidable');
  });

  it('formatea un metafield de dimensión con valor real', () => {
    expect(formatSpecValue('{"value":21,"unit":"CENTIMETERS"}')).toBe('21 cm');
    expect(formatSpecValue('{"value":5.5,"unit":"MILLIMETERS"}')).toBe('5.5 mm');
    expect(formatSpecValue('{"value":2,"unit":"INCHES"}')).toBe('2 in');
  });

  it('formatea una lista de valores', () => {
    expect(formatSpecValue('["Serigrafía","Bordado"]')).toBe('Serigrafía · Bordado');
  });

  it('deja pasar un número distinto de cero', () => {
    expect(formatSpecValue(21)).toBe('21');
  });

  it('no confunde un texto que empieza por cero con un cero', () => {
    expect(formatSpecValue('0.5 mm de grosor')).toBe('0.5 mm de grosor');
  });
});

/* ------------------------------------------------------------------ *
 * Filas de la ficha técnica                                           *
 * ------------------------------------------------------------------ */

const producto = (campos) => ({
  metafields: Object.entries(campos).map(([key, value]) => ({
    namespace: 'custom',
    key,
    value,
  })),
});

describe('buildProductSpecs', () => {
  it('devuelve las tres filas cuando hay datos', () => {
    const specs = buildProductSpecs(
      producto({
        material_front: 'Acero inoxidable',
        medidas: '8 x 8 x 21 cm',
        area_de_impresion: '5 x 4 cm',
      }),
    );
    expect(specs).toEqual([
      {label: 'Material', value: 'Acero inoxidable'},
      {label: 'Medidas', value: '8 x 8 x 21 cm'},
      {label: 'Área de impresión', value: '5 x 4 cm'},
    ]);
  });

  it('omite las filas vacías o en cero', () => {
    const specs = buildProductSpecs(
      producto({
        material_front: 'Poliéster',
        medidas: '0x0x0',
        area_de_impresion: '',
      }),
    );
    expect(specs).toEqual([{label: 'Material', value: 'Poliéster'}]);
  });

  it('devuelve lista vacía si no hay ningún dato útil', () => {
    expect(buildProductSpecs(producto({material_front: '', medidas: '0 x 0 x 0'}))).toEqual([]);
    expect(buildProductSpecs({metafields: []})).toEqual([]);
    expect(buildProductSpecs(null)).toEqual([]);
  });

  it('mantiene el orden Material, Medidas, Área aunque falten campos', () => {
    const specs = buildProductSpecs(
      producto({area_de_impresion: '5 x 4 cm', material_front: 'Algodón'}),
    );
    expect(specs.map((s) => s.label)).toEqual(['Material', 'Área de impresión']);
  });

  it('ignora metafields de otro namespace', () => {
    const p = {metafields: [{namespace: 'otro', key: 'medidas', value: '8x8'}]};
    expect(buildProductSpecs(p)).toEqual([]);
  });

  it('no se rompe con entradas nulas dentro de metafields', () => {
    // La Storefront API devuelve null en las posiciones no encontradas.
    const p = {metafields: [null, {namespace: 'custom', key: 'medidas', value: '8x8'}]};
    expect(buildProductSpecs(p)).toEqual([{label: 'Medidas', value: '8x8'}]);
  });
});
