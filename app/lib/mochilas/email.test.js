import {describe, it, expect} from 'vitest';
import {buildMochilaEmail, mochilasRecipient, MOCHILAS_DEFAULT_TO} from './email.js';

const line = {id: 'takayama', name: 'Takayama'};
const product = {name: 'Zen'};
const variant = {color: 'Azul / Negro', image: 'https://cdn/zen.png'};
const local = {
  fullName: 'Ana López',
  position: 'Diseño',
  phone: '5512345678',
  initials: 'ALG',
  variantId: 'v1',
  foraneo: false,
  shipping: null,
};

function build(values = local) {
  return buildMochilaEmail({email: 'ana@generandoideas.com', values, line, product, variant});
}

describe('mochilasRecipient', () => {
  it('usa MOCHILAS_EMAIL o el default', () => {
    expect(MOCHILAS_DEFAULT_TO).toBe('ycastillo@generandoideas.com');
    expect(mochilasRecipient({})).toBe('ycastillo@generandoideas.com');
    expect(mochilasRecipient({MOCHILAS_EMAIL: 'otra@generandoideas.com'})).toBe(
      'otra@generandoideas.com',
    );
  });
});

describe('buildMochilaEmail', () => {
  it('lleva las iniciales a grabar', () => {
    expect(build().html).toContain('Iniciales a grabar');
    expect(build().html).toContain('ALG');
  });

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
    expect(html).not.toContain('Sede');
  });

  it('incluye la sede si es foráneo', () => {
    const {html} = build({
      ...local,
      foraneo: true,
      shipping: {destino: 'michoacan', estado: 'Michoacán', entrega: 'Gil y Noé'},
    });
    expect(html).toContain('Foráneo · Michoacán (Gil y Noé)');
    expect(html).toMatch(/Sede<\/td><td[^>]*>Michoacán/);
    expect(html).toMatch(/Entrega a<\/td><td[^>]*>Gil y Noé/);
  });

  it('asunto en una línea y HTML escapado', () => {
    const {subject, html} = build({...local, fullName: 'Ana\n<b>x</b>'});
    expect(subject).not.toMatch(/[\r\n]/);
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('buildMochilaEmail · marca', () => {
  it('usa el diseño de la marca y conserva la elección', async () => {
    const {LOGO_PATH} = await import('../email/layout.js');
    const {html} = buildMochilaEmail({email: 'ana@generandoideas.com', values: local, line, product, variant});
    expect(html).toContain(LOGO_PATH);
    expect(html).toContain('YOUR ONE STOP SOLUTION');
    expect(html).toContain('Nueva elección de mochila');
    expect(html).toContain('Takayama Zen');
  });
});
