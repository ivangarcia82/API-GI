import {describe, it, expect} from 'vitest';
import {safeRedirectTo} from './redirect-to.js';

/* `redirectTo` llega desde la URL, o sea desde quien sea. Sin filtro, un
   correo con /login?redirectTo=https://sitio-falso/ convierte nuestro login en
   el trampolín de un phishing: el usuario ve el dominio bueno, se autentica y
   sale disparado a otro lado. Sólo se aceptan rutas internas. */
describe('safeRedirectTo', () => {
  it('acepta una ruta interna', () => {
    expect(safeRedirectTo('/products/taza-blanca')).toBe('/products/taza-blanca');
  });

  it('conserva query y fragmento de la ruta interna', () => {
    expect(safeRedirectTo('/catalogo?color=AZUL&page=2')).toBe('/catalogo?color=AZUL&page=2');
  });

  it('rechaza un destino absoluto a otro dominio', () => {
    expect(safeRedirectTo('https://sitio-falso.test/login')).toBe('/account');
  });

  it('rechaza la doble diagonal, que el navegador lee como dominio externo', () => {
    expect(safeRedirectTo('//sitio-falso.test')).toBe('/account');
    expect(safeRedirectTo('/\\sitio-falso.test')).toBe('/account');
  });

  it('rechaza esquemas raros como javascript: o data:', () => {
    expect(safeRedirectTo('javascript:alert(1)')).toBe('/account');
    expect(safeRedirectTo('data:text/html,<script>')).toBe('/account');
  });

  it('cae al destino por defecto cuando no viene nada', () => {
    expect(safeRedirectTo(null)).toBe('/account');
    expect(safeRedirectTo('')).toBe('/account');
    expect(safeRedirectTo('   ')).toBe('/account');
  });

  it('rechaza una ruta relativa sin diagonal inicial', () => {
    expect(safeRedirectTo('account/cotizaciones')).toBe('/account');
  });

  it('permite elegir otro destino por defecto', () => {
    expect(safeRedirectTo('https://sitio-falso.test', '/catalogo')).toBe('/catalogo');
  });
});
