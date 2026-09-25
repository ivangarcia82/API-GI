import {describe, it, expect} from 'vitest';
import {swatchFor} from './colors.js';

describe('swatchFor', () => {
  it('da un tono por color simple', () => {
    expect(swatchFor('Negro')).toEqual({tones: ['#2a2b2e'], known: true});
    expect(swatchFor('Rojo').tones).toHaveLength(1);
  });

  it('parte los colores compuestos en dos tonos', () => {
    expect(swatchFor('Azul / Negro')).toEqual({tones: ['#2d4c7c', '#2a2b2e'], known: true});
  });

  it('ignora mayúsculas y acentos', () => {
    expect(swatchFor('GRIS').tones).toEqual(swatchFor('gris').tones);
  });

  it('marca como desconocido un color sin tono y usa un neutro', () => {
    const s = swatchFor('Turquesa');
    expect(s.known).toBe(false);
    expect(s.tones).toHaveLength(1);
  });
});
