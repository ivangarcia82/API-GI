import {describe, it, expect} from 'vitest';
import {resumen, separarFrasesPegadas} from './text.js';

describe('separarFrasesPegadas', () => {
  it('separa dos frases pegadas por un punto', () => {
    expect(separarFrasesPegadas('deteriorar tu mesa o escritorio.Canales de ventilación')).toBe(
      'deteriorar tu mesa o escritorio. Canales de ventilación',
    );
  });

  it('respeta decimales', () => {
    expect(separarFrasesPegadas('capacidad de 1.5 litros')).toBe('capacidad de 1.5 litros');
  });

  it('respeta dominios y extensiones', () => {
    expect(separarFrasesPegadas('escribe a hola.Mx')).toBe('escribe a hola. Mx');
    expect(separarFrasesPegadas('ficha.pdf adjunta')).toBe('ficha.pdf adjunta');
  });

  it('no toca un texto ya correcto', () => {
    expect(separarFrasesPegadas('Una frase. Y otra frase.')).toBe('Una frase. Y otra frase.');
  });
});

describe('resumen', () => {
  it('devuelve el texto entero cuando ya es corto', () => {
    expect(resumen('Termo de acero inoxidable.')).toBe('Termo de acero inoxidable.');
  });

  it('aprovecha hasta el último final de frase que cabe en el tope', () => {
    const largo =
      'Tapete de escritorio fabricado en plástico EVA y piel sintética, ideal para proteger cualquier superficie de rayones y manchas. ' +
      'Descubre sus canales de ventilación dispuestos de manera estratégica para disipar el calor. ' +
      'Utiliza el espacio excedente como Mouse Pad.';
    const r = resumen(largo);
    // Cabe hasta "calor." (219 caracteres); la tercera frase ya no.
    expect(r.endsWith('calor.')).toBe(true);
    expect(r).not.toContain('Mouse Pad');
    expect(r.length).toBeLessThanOrEqual(220);
  });

  it('se queda en la primera frase cuando la segunda no cabe', () => {
    const largo =
      'Termo de acero inoxidable con doble pared. ' +
      'Mantiene la temperatura de tus bebidas durante muchas horas seguidas sin condensación por fuera.';
    expect(resumen(largo, 60)).toBe('Termo de acero inoxidable con doble pared.');
  });

  it('corta por palabra y marca elipsis cuando no hay final de frase útil', () => {
    const sinPuntos = 'palabra '.repeat(60).trim();
    const r = resumen(sinPuntos, 50);
    expect(r.endsWith('…')).toBe(true);
    expect(r.length).toBeLessThanOrEqual(51);
    expect(r).not.toContain('palabr…');
  });

  it('normaliza espacios y frases pegadas antes de cortar', () => {
    expect(resumen('Una   frase.Otra frase corta.')).toBe('Una frase. Otra frase corta.');
  });

  it('aguanta entradas vacías', () => {
    expect(resumen('')).toBe('');
    expect(resumen(undefined)).toBe('');
  });
});
