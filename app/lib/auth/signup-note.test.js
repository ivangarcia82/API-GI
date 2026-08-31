import {describe, it, expect} from 'vitest';
import {buildSignupNote} from './signup-note.js';

const user = {
  email: 'mariana@acme.mx',
  company: 'Acme Corp',
  razonSocial: 'Acme S.A. de C.V.',
  phone: '55 1234 5678',
  position: 'Gerente de compras',
  area: 'Compras',
  volume: '$50,000 – $200,000 MXN',
  heardAbout: 'Recomendación',
  location: 'Jalisco',
  esCliente: 'si',
  needs: 'Kit de bienvenida para 200 personas',
  createdAt: '2026-08-31T09:00:00.000Z',
};

describe('buildSignupNote', () => {
  it('incluye cada dato del registro con su etiqueta', () => {
    const nota = buildSignupNote({user, advisorName: 'Laura Vega'});
    expect(nota).toContain('Empresa: Acme Corp');
    expect(nota).toContain('Razón social: Acme S.A. de C.V.');
    expect(nota).toContain('Tel: 55 1234 5678');
    expect(nota).toContain('Cargo: Gerente de compras');
    expect(nota).toContain('Área: Compras');
    expect(nota).toContain('Volumen: $50,000 – $200,000 MXN');
    expect(nota).toContain('Nos conoció por: Recomendación');
    expect(nota).toContain('Ubicación: Jalisco');
    expect(nota).toContain('¿Ya es cliente?: Sí');
    expect(nota).toContain('Asesor que indicó: Laura Vega');
  });

  it('fecha el alta con el día del registro', () => {
    expect(buildSignupNote({user, advisorName: null})).toContain('Alta: 2026-08-31');
  });

  it('cae al handle cuando no se pudo resolver el nombre del asesor', () => {
    const nota = buildSignupNote({user, advisorName: null, advisorHandle: 'laura-vega'});
    expect(nota).toContain('Asesor que indicó: laura-vega');
  });

  it('dice "No" cuando la persona declaró no ser cliente', () => {
    const nota = buildSignupNote({user: {...user, esCliente: 'no'}, advisorName: null});
    expect(nota).toContain('¿Ya es cliente?: No');
  });

  it('omite las líneas de los datos que faltan, en vez de dejarlas vacías', () => {
    const nota = buildSignupNote({
      user: {email: 'solo@correo.mx', createdAt: '2026-08-31T09:00:00.000Z'},
      advisorName: null,
    });
    expect(nota).not.toContain('Empresa:');
    expect(nota).not.toContain('Área:');
    expect(nota).not.toContain('Asesor que indicó:');
    // La fecha siempre está: es lo que ancla la nota en el tiempo.
    expect(nota).toContain('Alta: 2026-08-31');
  });

  it('se sostiene sin fecha de creación', () => {
    expect(() => buildSignupNote({user: {email: 'x@y.mx'}, advisorName: null})).not.toThrow();
  });

  it('es texto plano de varias líneas, no HTML', () => {
    const nota = buildSignupNote({user, advisorName: 'Laura Vega'});
    expect(nota).not.toMatch(/<[a-z]/i);
    expect(nota.split('\n').length).toBeGreaterThan(5);
  });
});
