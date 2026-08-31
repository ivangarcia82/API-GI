import {describe, it, expect} from 'vitest';
import {
  COMO_NOS_CONOCISTE,
  COMO_NOS_CONOCISTE_DETALLE,
  componerOrigen,
  esOrigenValido,
} from './registro.catalogos.js';

describe('catálogo de origen en dos niveles', () => {
  it('Buscador y Redes sociales despliegan detalle; las demás no', () => {
    expect(COMO_NOS_CONOCISTE_DETALLE.Buscador).toEqual([
      'Google',
      'Yahoo',
      'App de IA',
      'Otro',
    ]);
    expect(COMO_NOS_CONOCISTE_DETALLE['Redes sociales']).toEqual([
      'LinkedIn',
      'Instagram',
      'Facebook',
    ]);
    expect(COMO_NOS_CONOCISTE_DETALLE['Recomendación']).toBeUndefined();
  });

  it('todo nivel con detalle existe en el catálogo principal', () => {
    for (const nivel of Object.keys(COMO_NOS_CONOCISTE_DETALLE)) {
      expect(COMO_NOS_CONOCISTE).toContain(nivel);
    }
  });
});

describe('componerOrigen', () => {
  it('une nivel y detalle', () => {
    expect(componerOrigen('Buscador', 'Google')).toBe('Buscador › Google');
  });

  it('deja el nivel solo cuando no hay detalle', () => {
    expect(componerOrigen('Recomendación')).toBe('Recomendación');
    expect(componerOrigen('Recomendación', '')).toBe('Recomendación');
  });

  it('devuelve vacío sin nivel', () => {
    expect(componerOrigen('')).toBe('');
    expect(componerOrigen(null, 'Google')).toBe('');
  });
});

describe('esOrigenValido', () => {
  it('acepta una pareja completa', () => {
    expect(esOrigenValido('Buscador › Google')).toBe(true);
    expect(esOrigenValido('Redes sociales › LinkedIn')).toBe(true);
  });

  it('acepta un nivel que no pide detalle', () => {
    expect(esOrigenValido('Recomendación')).toBe(true);
    expect(esOrigenValido('Feria o evento')).toBe(true);
  });

  it('rechaza un nivel que pide detalle y llega sin él', () => {
    expect(esOrigenValido('Buscador')).toBe(false);
    expect(esOrigenValido('Redes sociales')).toBe(false);
  });

  it('rechaza un detalle que no pertenece a su nivel', () => {
    expect(esOrigenValido('Buscador › LinkedIn')).toBe(false);
    expect(esOrigenValido('Redes sociales › Google')).toBe(false);
  });

  it('rechaza niveles inventados y valores vacíos', () => {
    expect(esOrigenValido('Telepatía')).toBe(false);
    expect(esOrigenValido('')).toBe(false);
    expect(esOrigenValido(null)).toBe(false);
  });

  it('rechaza detalle en un nivel que no lo admite', () => {
    expect(esOrigenValido('Recomendación › Google')).toBe(false);
  });
});
