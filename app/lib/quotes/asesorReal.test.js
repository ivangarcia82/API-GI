import {describe, it, expect} from 'vitest';
import {esAsesorReal} from './asesorReal.js';

describe('esAsesorReal', () => {
  it('acepta a una persona con correo y handle propio', () => {
    expect(esAsesorReal({email: 'lvega@gi.com', handle: 'laura-vega'})).toBe(true);
  });

  it('rechaza el entry de respaldo marketing aunque tenga correo', () => {
    // Tiene correo, pero no es una persona ni tiene cuenta en el portal.
    expect(esAsesorReal({email: 'marketing@gi.com', handle: 'marketing'})).toBe(false);
  });

  it('rechaza cuando no hay correo', () => {
    expect(esAsesorReal({email: null, handle: 'laura-vega'})).toBe(false);
    expect(esAsesorReal({email: '   ', handle: 'laura-vega'})).toBe(false);
  });

  it('rechaza entradas vacías', () => {
    expect(esAsesorReal(null)).toBe(false);
    expect(esAsesorReal(undefined)).toBe(false);
    expect(esAsesorReal({})).toBe(false);
  });

  it('acepta a quien tiene correo pero handle desconocido', () => {
    // Sólo `marketing` es especial; un handle nulo no debe excluir a nadie.
    expect(esAsesorReal({email: 'lvega@gi.com', handle: null})).toBe(true);
  });
});
