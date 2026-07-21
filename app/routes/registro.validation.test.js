import {describe, it, expect} from 'vitest';
import {validateStep} from './registro.validation.js';

const base = {
  name: 'Ana', lastName: 'Pérez', email: 'ana@empresa.mx',
  password: 'secreto123', company: 'Acme', volume: 'Menos de $50,000 MXN',
};

describe('validateStep', () => {
  it('acepta un paso 1 completo', () => {
    expect(validateStep(1, base)).toEqual({});
  });

  it('exige nombre y apellido', () => {
    const errs = validateStep(1, {...base, name: '  ', lastName: ''});
    expect(errs.name).toBeTruthy();
    expect(errs.lastName).toBeTruthy();
  });

  it('rechaza un correo mal formado', () => {
    expect(validateStep(1, {...base, email: 'ana@'}).email).toBeTruthy();
  });

  it('exige contraseña de al menos 8 caracteres', () => {
    expect(validateStep(1, {...base, password: 'corta'}).password).toBeTruthy();
  });

  it('acepta un paso 2 completo y exige empresa y volumen', () => {
    expect(validateStep(2, base)).toEqual({});
    const errs = validateStep(2, {...base, company: '', volume: ''});
    expect(errs.company).toBeTruthy();
    expect(errs.volume).toBeTruthy();
  });

  it('no bloquea el paso 3, cuyos campos son opcionales', () => {
    expect(validateStep(3, base)).toEqual({});
  });
});
