import {describe, it, expect} from 'vitest';
import {buildAdvisorEmail} from './advisorEmail.js';

const QUOTE = {id: 'q-123', notes: 'Entrega urgente'};
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

describe('buildAdvisorEmail', () => {
  it('builds subject containing the folio', () => {
    const msg = buildAdvisorEmail({
      advisorEmail: 'maria@generandoideas.com',
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      invoiceUrl: 'https://shop/invoice/1',
    });
    expect(msg.to).toBe('maria@generandoideas.com');
    expect(msg.subject).toContain('q-123');
  });

  it('includes customer identity, items summary and the invoice link in the html', () => {
    const msg = buildAdvisorEmail({
      advisorEmail: 'maria@generandoideas.com',
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      invoiceUrl: 'https://shop/invoice/1',
    });
    expect(msg.html).toContain('Juan Pérez');
    expect(msg.html).toContain('Empresa SA');
    expect(msg.html).toContain('cliente@empresa.mx');
    expect(msg.html).toContain('Taza clásica');
    expect(msg.html).toContain('SERIGRAFÍA 4 x 4');
    expect(msg.html).toContain('300');
    expect(msg.html).toContain('Pluma');
    expect(msg.html).toContain('https://shop/invoice/1');
    // total = 300*29.97 + 50*12 = 9591.00
    expect(msg.html).toContain('9,591.00');
  });

  it('escapes HTML in user-supplied values', () => {
    const msg = buildAdvisorEmail({
      advisorEmail: 'maria@generandoideas.com',
      quote: {id: 'q-1', notes: '<script>alert(1)</script>'},
      user: {...USER, company: 'A & B <Co>'},
      items: ITEMS,
      invoiceUrl: null,
    });
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('&lt;script&gt;');
    expect(msg.html).toContain('A &amp; B &lt;Co&gt;');
  });

  it('renders the target deadline when present and omits it otherwise', () => {
    const withDeadline = buildAdvisorEmail({
      advisorEmail: 'maria@generandoideas.com',
      quote: {id: 'q-9', notes: null, deadline: '2026-07-15'},
      user: USER,
      items: ITEMS,
      invoiceUrl: null,
    });
    expect(withDeadline.html).toContain('Fecha objetivo');
    expect(withDeadline.html).toContain('2026-07-15');

    // QUOTE has no deadline → no "Fecha objetivo" line.
    const withoutDeadline = buildAdvisorEmail({
      advisorEmail: 'maria@generandoideas.com',
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      invoiceUrl: null,
    });
    expect(withoutDeadline.html).not.toContain('Fecha objetivo');
  });

  it('omits the invoice link block when invoiceUrl is null', () => {
    const msg = buildAdvisorEmail({
      advisorEmail: 'maria@generandoideas.com',
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      invoiceUrl: null,
    });
    expect(msg.html).not.toContain('href');
  });
});
