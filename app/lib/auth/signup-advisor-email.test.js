import {describe, it, expect} from 'vitest';
import {buildSignupAdvisorEmail} from './signup-advisor-email.js';

const user = {
  email: 'mariana@empresa.mx',
  firstName: 'Mariana',
  lastName: 'Ruiz',
  company: 'Acme Corp',
  phone: '55 1234 5678',
};

function build(over = {}) {
  return buildSignupAdvisorEmail({
    advisorTo: 'agamboa@generandoideas.com',
    advisorName: 'Ailine',
    user,
      ...over,
  });
}


describe('buildSignupAdvisorEmail', () => {
  it('addresses the advisor', () => {
    expect(build().to).toBe('agamboa@generandoideas.com');
  });

  it('names the new customer in the subject', () => {
    expect(build().subject).toBe('Nuevo registro — Mariana Ruiz');
  });

  it('falls back to the email in the subject when there is no name', () => {
    const {subject} = build({user: {...user, firstName: '', lastName: ''}});
    expect(subject).toBe('Nuevo registro — mariana@empresa.mx');
  });

  it('greets the advisor by name', () => {
    expect(build().html).toContain('Hola Ailine');
  });

  it('omits the greeting when the advisor has no name', () => {
    expect(build({advisorName: ''}).html).not.toContain('Hola');
  });

  it('carries the essentials: correo, teléfono y empresa', () => {
    const {html} = build();
    expect(html).toContain('mariana@empresa.mx');
    expect(html).toContain('55 1234 5678');
    expect(html).toContain('Acme Corp');
  });

  it('shows a dash for the fields the person left blank', () => {
    const {html} = build({user: {...user, phone: null, company: null}});
    expect(html).toContain('—');
    expect(html).not.toContain('null');
  });

  it('escapes HTML so a crafted name cannot inject markup', () => {
    const {html} = build({user: {...user, firstName: '<script>alert(1)</script>'}});
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });


  it('omits the Shopify block entirely when there is no customer url', () => {
    expect(build({customerAdminUrl: null}).html).not.toContain('Ver cliente en Shopify');
  });
});

describe('buildSignupAdvisorEmail · reclamo de asesor', () => {
  const base = {
    advisorTo: 'marketing@generandoideas.com',
    user: {email: 'ana@acme.mx', firstName: 'Ana', lastName: 'Pérez', company: 'Acme'},
    };

  it('muestra el asesor que el usuario dijo tener', () => {
    const msg = buildSignupAdvisorEmail({
      ...base,
      claimedAdvisor: 'Laura Vega',
      esCliente: 'si',
    });
    expect(msg.html).toContain('Laura Vega');
  });

  it('dice que ya es cliente cuando lo declaró', () => {
    const msg = buildSignupAdvisorEmail({...base, claimedAdvisor: null, esCliente: 'si'});
    expect(msg.html).toMatch(/Ya es cliente[\s\S]*Sí/);
  });

  it('dice que es nuevo cuando no se declaró cliente', () => {
    const msg = buildSignupAdvisorEmail({...base, claimedAdvisor: null, esCliente: 'no'});
    expect(msg.html).toMatch(/Ya es cliente[\s\S]*No/);
  });

  it('escapa el nombre del asesor reclamado', () => {
    const msg = buildSignupAdvisorEmail({
      ...base,
      claimedAdvisor: '<script>alert(1)</script>',
      esCliente: 'si',
    });
    expect(msg.html).not.toContain('<script>');
  });

  it('se sostiene sin reclamo ni respuesta', () => {
    const msg = buildSignupAdvisorEmail({...base, claimedAdvisor: null, esCliente: null});
    expect(msg.to).toBe('marketing@generandoideas.com');
    expect(msg.html).toContain('—');
  });
});

describe('buildSignupAdvisorEmail · copia al líder', () => {
  const base = {
    advisorTo: 'marketing@generandoideas.com',
    user: {email: 'ana@acme.mx', firstName: 'Ana', lastName: 'Pérez'},
      claimedAdvisor: 'Laura Vega',
    esCliente: 'si',
  };

  it('incluye cc cuando hay líder a quien copiar', () => {
    const msg = buildSignupAdvisorEmail({...base, cc: 'sjimenez@generandoideas.com'});
    expect(msg.cc).toBe('sjimenez@generandoideas.com');
  });

  it('omite la clave cc cuando no hay líder', () => {
    expect('cc' in buildSignupAdvisorEmail({...base, cc: null})).toBe(false);
  });
});

describe('buildSignupAdvisorEmail · sin enlaces a Shopify', () => {
  it('no lleva ningún enlace al admin de Shopify', () => {
    const msg = buildSignupAdvisorEmail({
      advisorTo: 'marketing@generandoideas.com',
      user: {email: 'ana@acme.mx', firstName: 'Ana', company: 'Acme'},
      claimedAdvisor: 'Laura Vega',
      esCliente: 'si',
    });
    expect(msg.html).not.toMatch(/shopify/i);
    expect(msg.html).not.toContain('admin.shopify.com');
  });

  it('conserva en el cuerpo lo que marketing necesita para decidir', () => {
    const msg = buildSignupAdvisorEmail({
      advisorTo: 'marketing@generandoideas.com',
      user: {email: 'ana@acme.mx', firstName: 'Ana', company: 'Acme', phone: '5512345678'},
      claimedAdvisor: 'Laura Vega',
      esCliente: 'si',
    });
    expect(msg.html).toContain('ana@acme.mx');
    expect(msg.html).toContain('Acme');
    expect(msg.html).toContain('5512345678');
    expect(msg.html).toContain('Laura Vega');
  });
});
