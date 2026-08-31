import {describe, it, expect} from 'vitest';
import {validateStep} from './registro.validation.js';
import {UNKNOWN_ADVISOR} from '~/lib/auth/advisor-choice.js';
import {AREAS, COMO_NOS_CONOCISTE, UBICACIONES} from './registro.catalogos.js';

const base = {
  name: 'Ana', lastName: 'Pérez', email: 'ana@empresa.mx',
  password: 'secreto123', phone: '55 1234 5678',
  company: 'Acme', razonSocial: 'Acme S.A. de C.V.',
  position: 'Compradora', area: AREAS[0], volume: 'Menos de $50,000 MXN',
  esCliente: 'no', advisor: '',
  heardAbout: COMO_NOS_CONOCISTE[0], location: UBICACIONES[0],
  privacy: true, terms: true,
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

describe('validateStep · paso 1 con teléfono obligatorio', () => {
  it('exige teléfono', () => {
    expect(validateStep(1, {...base, phone: ''}).phone).toBeTruthy();
    expect(validateStep(1, {...base, phone: '   '}).phone).toBeTruthy();
  });
});

describe('validateStep · paso 2 con razón social, cargo y área', () => {
  it('exige razón social', () => {
    expect(validateStep(2, {...base, razonSocial: ''}).razonSocial).toBeTruthy();
  });

  it('exige cargo', () => {
    expect(validateStep(2, {...base, position: ''}).position).toBeTruthy();
  });

  it('exige un área del catálogo', () => {
    expect(validateStep(2, {...base, area: ''}).area).toBeTruthy();
    expect(validateStep(2, {...base, area: 'Inventada'}).area).toBeTruthy();
  });
});

describe('validateStep · paso 3', () => {
  it('acepta el paso completo', () => {
    expect(validateStep(3, base)).toEqual({});
  });

  it('exige saber cómo nos conoció, del catálogo', () => {
    expect(validateStep(3, {...base, heardAbout: ''}).heardAbout).toBeTruthy();
    expect(validateStep(3, {...base, heardAbout: 'Inventado'}).heardAbout).toBeTruthy();
  });

  it('exige ubicación, del catálogo', () => {
    expect(validateStep(3, {...base, location: ''}).location).toBeTruthy();
    expect(validateStep(3, {...base, location: 'Narnia'}).location).toBeTruthy();
  });

  it('exige aceptar el aviso de privacidad', () => {
    expect(validateStep(3, {...base, privacy: false}).privacy).toBeTruthy();
  });

  it('exige aceptar los términos', () => {
    expect(validateStep(3, {...base, terms: false}).terms).toBeTruthy();
  });

  it('no exige newsletter', () => {
    expect(validateStep(3, {...base, newsletter: false})).toEqual({});
  });
});

describe('catálogos', () => {
  it('ubicaciones trae los 32 estados más la opción de fuera de México', () => {
    expect(UBICACIONES).toHaveLength(33);
    expect(UBICACIONES).toContain('Fuera de México');
  });

  it('no hay opciones duplicadas ni vacías', () => {
    for (const cat of [AREAS, COMO_NOS_CONOCISTE, UBICACIONES]) {
      expect(new Set(cat).size).toBe(cat.length);
      for (const opcion of cat) expect(opcion.trim()).not.toBe('');
    }
  });
});
