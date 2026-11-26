import {describe, it, expect} from 'vitest';
import {
  NOTAS_IMPORTANTES,
  CONDICIONES_PAGO,
  TIEMPO_ENTREGA,
  VIGENCIA_COTIZACION,
} from './notasImportantes.js';

describe('NOTAS_IMPORTANTES', () => {
  it('trae las cinco condiciones acordadas', () => {
    expect(NOTAS_IMPORTANTES).toHaveLength(5);
  });

  it('declara contado, 15 días de vigencia y 15 a 20 hábiles de entrega', () => {
    const texto = NOTAS_IMPORTANTES.join(' ');
    expect(texto).toContain('Condiciones de pago: Contado');
    expect(texto).toContain('Vigencia de cotización: 15 días.');
    expect(texto).toContain('Tiempo de entrega: 15 a 20 días hábiles');
  });

  /* El sitio (preguntas frecuentes, ficha) cita estos mismos tres datos: salen
     de constantes para que no puedan decir algo distinto de la cotización. */
  it('expone entrega, pago y vigencia para quien los cite', () => {
    expect(TIEMPO_ENTREGA).toBe('15 a 20 días hábiles');
    expect(CONDICIONES_PAGO).toBe('Contado');
    expect(VIGENCIA_COTIZACION).toBe('15 días');
  });

  it('no promete las 24 horas, que son tiempo de respuesta y no de entrega', () => {
    expect(NOTAS_IMPORTANTES.join(' ')).not.toContain('24 horas');
  });

  it('ninguna nota viene vacía ni con espacios sobrantes', () => {
    for (const n of NOTAS_IMPORTANTES) {
      expect(n).toBe(n.trim());
      expect(n).not.toBe('');
    }
  });
});
