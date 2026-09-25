import {describe, it, expect} from 'vitest';
import {buildMochilaEmail, mochilasRecipient, MOCHILAS_DEFAULT_TO} from './email.js';

const line = {id: 'takayama', name: 'Takayama'};
const product = {name: 'Zen'};
const variant = {color: 'Azul / Negro', image: 'https://cdn/zen.png'};
const local = {
  fullName: 'Ana López',
  position: 'Diseño',
  phone: '5512345678',
  variantId: 'v1',
  foraneo: false,
  shipping: null,
};

function build(values = local) {
  return buildMochilaEmail({email: 'ana@generandoideas.com', values, line, product, variant});
}

describe('mochilasRecipient', () => {
  it('usa MOCHILAS_EMAIL o el default', () => {
    expect(MOCHILAS_DEFAULT_TO).toBe('igarcia@generandoideas.com');
    expect(mochilasRecipient({})).toBe('igarcia@generandoideas.com');
    expect(mochilasRecipient({MOCHILAS_EMAIL: 'otra@generandoideas.com'})).toBe(
      'otra@generandoideas.com',
    );
  });
});

describe('buildMochilaEmail', () => {
  it('arma el asunto con la línea', () => {
    expect(build().subject).toBe('Mochila – Ana López – Takayama Zen / Azul / Negro');
  });

  it('incluye los datos y la entrega en oficina', () => {
    const {html} = build();
    expect(html).toContain('ana@generandoideas.com');
    expect(html).toContain('Diseño');
    expect(html).toContain('5512345678');
    expect(html).toContain('Takayama Zen · Azul / Negro');
    expect(html).toContain('Entrega en oficina');
    expect(html).not.toContain('Código postal');
  });

  it('incluye la dirección si es foráneo', () => {
    const {html} = build({
      ...local,
      foraneo: true,
      shipping: {
        street: 'Av. Juárez 10',
        neighborhood: 'Centro',
        zip: '44100',
        city: 'Guadalajara',
        state: 'Jalisco',
        references: '',
        recipient: '',
      },
    });
    expect(html).toContain('Foráneo');
    expect(html).toContain('Av. Juárez 10');
    expect(html).toContain('44100');
    // Sin "quién recibe", recibe el colaborador.
    expect(html).toMatch(/Recibe<\/td><td[^>]*>Ana López/);
  });

  it('asunto en una línea y HTML escapado', () => {
    const {subject, html} = build({...local, fullName: 'Ana\n<b>x</b>'});
    expect(subject).not.toMatch(/[\r\n]/);
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
