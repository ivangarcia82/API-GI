import {describe, it, expect} from 'vitest';
import {validateStep} from './registro.validation.js';
import {UNKNOWN_ADVISOR} from '~/lib/auth/advisor-choice.js';

const base = {
  name: 'Ana', lastName: 'Pérez', email: 'ana@empresa.mx',
  password: 'secreto123', company: 'Acme', volume: 'Menos de $50,000 MXN',
  esCliente: 'no', advisor: '',
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

  it('exige responder si ya es cliente', () => {
    expect(validateStep(2, {...base, esCliente: ''}).esCliente).toBeTruthy();
  });

  it('exige elegir asesor cuando dice que ya es cliente', () => {
    const errs = validateStep(2, {...base, esCliente: 'si', advisor: ''});
    expect(errs.advisor).toBeTruthy();
  });

  it('acepta "no conozco a mi asesor" como respuesta válida de un cliente', () => {
    expect(validateStep(2, {...base, esCliente: 'si', advisor: UNKNOWN_ADVISOR})).toEqual({});
  });

  it('acepta un cliente que sí eligió a su asesor', () => {
    expect(validateStep(2, {...base, esCliente: 'si', advisor: 'laura-vega'})).toEqual({});
  });

  it('no exige asesor a quien todavía no es cliente', () => {
    expect(validateStep(2, {...base, esCliente: 'no', advisor: ''})).toEqual({});
  });
});
