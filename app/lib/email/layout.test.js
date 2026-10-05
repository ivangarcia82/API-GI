import {describe, it, expect} from 'vitest';
import {brandedEmail, LOGO_PATH} from './layout.js';

const correo = (over = {}) =>
  brandedEmail({
    heading: 'Verifica tu correo',
    bodyHtml: '<p>Gracias por registrarte.</p>',
    cta: {url: 'https://generandoideas.com/auth/verify?token=abc', label: 'Verificar correo'},
    ...over,
  });

describe('diseño común de los correos', () => {
  it('lleva el logo en PNG con dirección absoluta (Gmail y Outlook no muestran SVG)', () => {
    const html = correo();
    expect(LOGO_PATH).toMatch(/\.png$/);
    expect(html).toContain(`src="https://generandoideas.com${LOGO_PATH}"`);
    expect(html).toContain('alt="Generando Ideas"');
  });

  it('toma el dominio del enlace del botón, así en otro entorno apunta a ese entorno', () => {
    const html = correo({cta: {url: 'https://staging.gi.test/auth/reset?token=x', label: 'Ir'}});
    expect(html).toContain(`src="https://staging.gi.test${LOGO_PATH}"`);
  });

  it('sin botón usa el dominio de producción', () => {
    const html = correo({cta: null});
    expect(html).toContain(`src="https://generandoideas.com${LOGO_PATH}"`);
    expect(html).not.toContain('Si el botón no funciona');
  });

  it('el botón es naranja de la marca y trae el enlace de respaldo', () => {
    const html = correo();
    expect(html).toMatch(/background(-color)?:#ff8300/i);
    expect(html).toContain('href="https://generandoideas.com/auth/verify?token=abc"');
    expect(html).toContain('Si el botón no funciona');
  });

  it('cierra con el lema y los datos de la empresa, como el PDF', () => {
    const html = correo();
    expect(html).toContain('YOUR ONE STOP SOLUTION');
    expect(html).toContain('Estrategia en Suministros Internacionales');
  });

  it('escapa el título y el enlace', () => {
    const html = correo({
      heading: 'Hola <b>',
      cta: {url: 'https://gi.com/x?a="b<c', label: 'Ir'},
    });
    expect(html).toContain('Hola &lt;b&gt;');
    expect(html).not.toContain('a="b<c');
  });

  it('usa tablas, que es lo que respetan los clientes de correo', () => {
    expect(correo()).toMatch(/<table[^>]*role="presentation"/);
  });

  it('el texto de vista previa no se ve, pero va primero', () => {
    const html = correo({preheader: 'Confirma tu cuenta en un clic'});
    expect(html.indexOf('Confirma tu cuenta en un clic')).toBeLessThan(html.indexOf('<h1'));
    expect(html).toMatch(/display:none[^>]*>Confirma tu cuenta en un clic/);
  });
});
