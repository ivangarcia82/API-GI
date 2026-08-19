import {describe, it, expect} from 'vitest';
import {buildCustomerEmail} from './customerEmail.js';

const QUOTE = {id: 'q-123', notes: 'Entrega urgente', deadline: null};
const USER = {
  email: 'cliente@empresa.mx',
  firstName: 'Juan',
  lastName: 'Pérez',
  company: 'Empresa SA',
};
const ITEMS = [
  {title: 'Taza clásica', qty: 300, technique: 'SERIGRAFÍA', size: '4 x 4', effectiveUnitPrice: 29.97},
  {title: 'Pluma', qty: 50, technique: 'Sin decorado', size: null, effectiveUnitPrice: 12},
];
const URL_COTIZACION = 'https://generandoideas.com/account/cotizaciones/q-123';

describe('buildCustomerEmail', () => {
  it('addresses the buyer and puts the folio in the subject', () => {
    const msg = buildCustomerEmail({
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      quoteUrl: URL_COTIZACION,
    });
    expect(msg.to).toBe('cliente@empresa.mx');
    expect(msg.subject).toContain('q-123');
  });

  it('greets the buyer by first name', () => {
    const msg = buildCustomerEmail({
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      quoteUrl: URL_COTIZACION,
    });
    expect(msg.html).toContain('Hola Juan');
  });

  it('lists every item with its decoration, quantity and estimated total', () => {
    const msg = buildCustomerEmail({
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      quoteUrl: URL_COTIZACION,
    });
    expect(msg.html).toContain('Taza clásica');
    expect(msg.html).toContain('SERIGRAFÍA 4 x 4');
    expect(msg.html).toContain('300');
    expect(msg.html).toContain('Sin decorado');
    // total = 300*29.97 + 50*12 = 9591.00
    expect(msg.html).toContain('9,591.00');
  });

  it('links to the buyer account copy of the quote', () => {
    const msg = buildCustomerEmail({
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      quoteUrl: URL_COTIZACION,
    });
    expect(msg.html).toContain(URL_COTIZACION);
  });

  it('states that prices are estimates pending advisor confirmation', () => {
    const msg = buildCustomerEmail({
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      quoteUrl: URL_COTIZACION,
    });
    expect(msg.html).toMatch(/estimad/i);
  });

  it('renders the target deadline when present and omits it otherwise', () => {
    const withDeadline = buildCustomerEmail({
      quote: {...QUOTE, deadline: '2026-07-15'},
      user: USER,
      items: ITEMS,
      quoteUrl: URL_COTIZACION,
    });
    expect(withDeadline.html).toContain('Fecha objetivo');
    expect(withDeadline.html).toContain('2026-07-15');

    const withoutDeadline = buildCustomerEmail({
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      quoteUrl: URL_COTIZACION,
    });
    expect(withoutDeadline.html).not.toContain('Fecha objetivo');
  });

  it('falls back to the email address when the buyer has no first name', () => {
    const msg = buildCustomerEmail({
      quote: QUOTE,
      user: {email: 'cliente@empresa.mx'},
      items: ITEMS,
      quoteUrl: URL_COTIZACION,
    });
    expect(msg.html).toContain('Hola cliente@empresa.mx');
  });

  it('escapes HTML in buyer-supplied values', () => {
    const msg = buildCustomerEmail({
      quote: {id: 'q-1', notes: null, deadline: null},
      user: {...USER, firstName: '<script>alert(1)</script>', lastName: ''},
      items: [{...ITEMS[0], title: 'A & B <Co>'}],
      quoteUrl: URL_COTIZACION,
    });
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('&lt;script&gt;');
    expect(msg.html).toContain('A &amp; B &lt;Co&gt;');
  });
});
