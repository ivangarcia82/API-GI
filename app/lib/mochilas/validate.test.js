import {describe, it, expect} from 'vitest';
import {validateMochilaRequest} from './validate.js';

function form(fields) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const BASE = {
  fullName: 'Ana López',
  position: 'Diseño',
  phone: '5512345678',
  initials: 'ALG',
  variantId: 'gid://shopify/ProductVariant/1',
  foraneo: 'no',
};


describe('validateMochilaRequest · iniciales para grabar', () => {
  it.each([
    ['alg', 'ALG'],
    [' a.l.g ', 'ALG'],
    ['ñm', 'ÑM'],
    ['j', 'J'],
  ])('%s se guarda como %s', (entrada, guardado) => {
    expect(validateMochilaRequest(form({...BASE, initials: entrada})).values.initials).toBe(guardado);
  });

  it.each(['ABCD', 'A1', 'A&B'])('rechaza %s', (initials) => {
    expect(validateMochilaRequest(form({...BASE, initials})).errors.initials).toBe(
      'Usa de 1 a 3 letras, sin números ni símbolos.',
    );
  });

  it('son obligatorias', () => {
    expect(validateMochilaRequest(form({...BASE, initials: '  '})).errors.initials).toBe(
      'Escribe las iniciales que se grabarán.',
    );
  });
});

describe('validateMochilaRequest · local', () => {
  it('acepta lo mínimo y no pide dirección', () => {
    expect(validateMochilaRequest(form(BASE))).toEqual({
      ok: true,
      values: {...BASE, foraneo: false, shipping: null},
    });
  });

  it('ignora la sede si no es foráneo', () => {
    expect(validateMochilaRequest(form({...BASE, destino: 'sonora'})).values.shipping).toBeNull();
  });

  it('marca los obligatorios que faltan', () => {
    const r = validateMochilaRequest(form({}));
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(
      ['foraneo', 'fullName', 'initials', 'phone', 'position', 'variantId'].sort(),
    );
  });

  it('recorta espacios', () => {
    expect(validateMochilaRequest(form({...BASE, fullName: '  Ana López  '})).values.fullName).toBe(
      'Ana López',
    );
  });
});

describe('validateMochilaRequest · teléfono', () => {
  it.each(['55 1234 5678', '55-1234-5678', '+52 55 1234-5678', '525512345678'])(
    'normaliza %s',
    (phone) => {
      expect(validateMochilaRequest(form({...BASE, phone})).values.phone).toBe('5512345678');
    },
  );

  it.each(['12345', '551234567890123', 'abc'])('rechaza %s', (phone) => {
    expect(validateMochilaRequest(form({...BASE, phone})).errors.phone).toBeTruthy();
  });
});

describe('validateMochilaRequest · foráneo', () => {
  it('exige elegir una sede, no una dirección', () => {
    const r = validateMochilaRequest(form({...BASE, foraneo: 'si'}));
    expect(Object.keys(r.errors)).toEqual(['destino']);
  });

  it.each([
    ['michoacan', {destino: 'michoacan', estado: 'Michoacán', entrega: 'Gil y Noé'}],
    ['sonora', {destino: 'sonora', estado: 'Sonora', entrega: 'Sucursal'}],
    ['yucatan', {destino: 'yucatan', estado: 'Yucatán', entrega: 'Sucursal'}],
  ])('acepta %s', (destino, shipping) => {
    const r = validateMochilaRequest(form({...BASE, foraneo: 'si', destino}));
    expect(r.ok).toBe(true);
    expect(r.values.shipping).toEqual(shipping);
  });

  it('rechaza una sede que no está en la lista', () => {
    const r = validateMochilaRequest(form({...BASE, foraneo: 'si', destino: 'jalisco'}));
    expect(r.errors.destino).toBe('Elige a qué sede te la enviamos.');
  });

  it('rechaza un valor de foráneo fuera de catálogo', () => {
    expect(validateMochilaRequest(form({...BASE, foraneo: 'tal vez'})).errors.foraneo).toBeTruthy();
  });
});
