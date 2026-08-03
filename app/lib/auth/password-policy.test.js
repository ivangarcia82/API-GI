import {describe, it, expect} from 'vitest';
import {validatePasswordChange} from './password-policy.js';

describe('validatePasswordChange', () => {
  it('acepta una contraseña nueva válida', () => {
    expect(
      validatePasswordChange({
        current: 'viejaSegura1',
        next: 'nuevaSegura1',
        confirm: 'nuevaSegura1',
      }),
    ).toBeNull();
  });

  it('rechaza menos de 8 caracteres', () => {
    expect(
      validatePasswordChange({current: 'viejaSegura1', next: 'corta', confirm: 'corta'}),
    ).toBe('La contraseña debe tener al menos 8 caracteres.');
  });

  it('acepta exactamente 8 caracteres', () => {
    expect(
      validatePasswordChange({current: 'viejaSegura1', next: '12345678', confirm: '12345678'}),
    ).toBeNull();
  });

  it('rechaza cuando la confirmación no coincide', () => {
    expect(
      validatePasswordChange({
        current: 'viejaSegura1',
        next: 'nuevaSegura1',
        confirm: 'nuevaSegura2',
      }),
    ).toBe('Las contraseñas no coinciden.');
  });

  it('rechaza cuando la nueva es igual a la actual', () => {
    expect(
      validatePasswordChange({
        current: 'mismaClave1',
        next: 'mismaClave1',
        confirm: 'mismaClave1',
      }),
    ).toBe('La nueva contraseña debe ser distinta a la actual.');
  });

  it('reporta la longitud antes que la falta de coincidencia', () => {
    expect(
      validatePasswordChange({current: 'viejaSegura1', next: 'abc', confirm: 'xyz'}),
    ).toBe('La contraseña debe tener al menos 8 caracteres.');
  });

  it('trata entradas ausentes como cadena vacía y falla por longitud', () => {
    expect(validatePasswordChange({})).toBe(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  });
});
