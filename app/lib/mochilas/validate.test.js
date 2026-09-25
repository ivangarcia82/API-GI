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
  variantId: 'gid://shopify/ProductVariant/1',
  foraneo: 'no',
};

const SHIP = {
  street: 'Av. Juárez 10',
  neighborhood: 'Centro',
  zip: '44100',
  city: 'Guadalajara',
  state: 'Jalisco',
};

describe('validateMochilaRequest · local', () => {
  it('acepta lo mínimo y no pide dirección', () => {
    expect(validateMochilaRequest(form(BASE))).toEqual({
      ok: true,
      values: {...BASE, foraneo: false, shipping: null},
    });
  });

  it('ignora campos de envío si no es foráneo', () => {
    expect(validateMochilaRequest(form({...BASE, ...SHIP})).values.shipping).toBeNull();
  });

  it('marca los obligatorios que faltan', () => {
    const r = validateMochilaRequest(form({}));
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(
      ['foraneo', 'fullName', 'phone', 'position', 'variantId'].sort(),
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
  it('exige la dirección', () => {
    const r = validateMochilaRequest(form({...BASE, foraneo: 'si'}));
    expect(Object.keys(r.errors).sort()).toEqual(
      ['city', 'neighborhood', 'state', 'street', 'zip'].sort(),
    );
  });

  it('valida el código postal', () => {
    const r = validateMochilaRequest(form({...BASE, foraneo: 'si', ...SHIP, zip: '4410'}));
    expect(r.errors.zip).toBeTruthy();
  });

  it('acepta la dirección completa; referencias y quien recibe son opcionales', () => {
    const r = validateMochilaRequest(form({...BASE, foraneo: 'si', ...SHIP}));
    expect(r.ok).toBe(true);
    expect(r.values.foraneo).toBe(true);
    expect(r.values.shipping).toEqual({...SHIP, references: '', recipient: ''});
  });

  it('rechaza un valor de foráneo fuera de catálogo', () => {
    expect(validateMochilaRequest(form({...BASE, foraneo: 'tal vez'})).errors.foraneo).toBeTruthy();
  });
});
