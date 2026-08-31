// Regla acordada el 2026-08-31: NINGÚN correo manda al usuario a Shopify.
// Todo se ve en la plataforma. Esta prueba vigila los cuatro constructores de
// correo a la vez, para que reintroducir un enlace sea un fallo ruidoso y no
// algo que se descubre cuando alguien recibe un 404.
import {describe, it, expect} from 'vitest';
import {buildAdvisorEmail} from '../quotes/advisorEmail.js';
import {buildCustomerEmail} from '../quotes/customerEmail.js';
import {buildSignupAdvisorEmail} from '../auth/signup-advisor-email.js';

const quote = {id: 'q1', folio: 'GIV.CDMX.20260007', notes: null, deadline: null};
const user = {email: 'ana@acme.mx', firstName: 'Ana', lastName: 'Ruiz', company: 'Acme'};
const items = [{title: 'Taza', qty: 10, effectiveUnitPrice: 30}];

const CORREOS = [
  [
    'cotización al ejecutivo',
    () =>
      buildAdvisorEmail({
        advisorEmail: 'lvega@generandoideas.com',
        managerEmail: 'sjimenez@generandoideas.com',
        quote,
        user,
        items,
        portalUrl: 'https://gi.test/asesor/cotizaciones/q1',
      }),
  ],
  [
    'cotización al comprador',
    () => buildCustomerEmail({quote, user, items, quoteUrl: 'https://gi.test/account/cotizaciones/q1'}),
  ],
  [
    'registro a marketing',
    () =>
      buildSignupAdvisorEmail({
        advisorTo: 'marketing@generandoideas.com',
        user,
        claimedAdvisor: 'Laura Vega',
        esCliente: 'si',
      }),
  ],
];

describe('ningún correo manda a Shopify', () => {
  for (const [nombre, construir] of CORREOS) {
    it(`${nombre}: sin dominios de Shopify`, () => {
      const {html} = construir();
      expect(html).not.toMatch(/admin\.shopify\.com/);
      expect(html).not.toMatch(/myshopify\.com/);
      expect(html).not.toMatch(/shopify/i);
    });

    it(`${nombre}: todo enlace apunta a generandoideas o a una ruta propia`, () => {
      const {html} = construir();
      const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      for (const h of hrefs) {
        const propio =
          h.startsWith('/') ||
          h.startsWith('mailto:') ||
          h.includes('generandoideas.com') ||
          h.startsWith('https://gi.test/');
        expect(propio, `enlace ajeno: ${h}`).toBe(true);
      }
    });
  }
});
