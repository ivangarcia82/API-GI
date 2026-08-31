import {describe, it, expect} from 'vitest';
import {
  buildSignupAdvisorEmail,
  shopifyCustomerAdminUrl,
} from './signup-advisor-email.js';

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
    customerAdminUrl: null,
    ...over,
  });
}

describe('shopifyCustomerAdminUrl', () => {
  it('builds the admin deep link from the store domain and customer gid', () => {
    expect(
      shopifyCustomerAdminUrl('development-gi.myshopify.com', 'gid://shopify/Customer/123'),
    ).toBe('https://admin.shopify.com/store/development-gi/customers/123');
  });

  it('returns null without a customer gid', () => {
    expect(shopifyCustomerAdminUrl('development-gi.myshopify.com', null)).toBeNull();
  });

  it('returns null without a store domain', () => {
    expect(shopifyCustomerAdminUrl('', 'gid://shopify/Customer/123')).toBeNull();
  });

  it('returns null for a gid that is not a customer', () => {
    expect(
      shopifyCustomerAdminUrl('development-gi.myshopify.com', 'gid://shopify/Order/9'),
    ).toBeNull();
  });
});

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

  it('links to the customer in Shopify when the url is known', () => {
    const url = 'https://admin.shopify.com/store/development-gi/customers/123';
    const {html} = build({customerAdminUrl: url});
    expect(html).toContain(url);
    expect(html).toContain('Ver cliente en Shopify');
  });

  it('omits the Shopify block entirely when there is no customer url', () => {
    expect(build({customerAdminUrl: null}).html).not.toContain('Ver cliente en Shopify');
  });
});

describe('buildSignupAdvisorEmail · reclamo de asesor', () => {
  const base = {
    advisorTo: 'marketing@generandoideas.com',
    user: {email: 'ana@acme.mx', firstName: 'Ana', lastName: 'Pérez', company: 'Acme'},
    customerAdminUrl: null,
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
