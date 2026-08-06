/* El 404 más común llega desde un enlace viejo en un correo del asesor, con el
   handle del producto en la URL. Rescatar ese texto convierte un callejón sin
   salida en una búsqueda. */
import {describe, it, expect} from 'vitest';
import {terminoDesdeRuta} from './root.jsx';

describe('terminoDesdeRuta', () => {
  it('convierte el handle de un producto en términos buscables', () => {
    expect(terminoDesdeRuta('/products/termo-carich-t-367')).toBe('termo carich t 367');
  });

  it('usa el último tramo de la ruta', () => {
    expect(terminoDesdeRuta('/collections/bebidas/mochila-force')).toBe('mochila force');
  });

  it('quita la extensión de archivo', () => {
    expect(terminoDesdeRuta('/catalogos/promocionales-2026.pdf')).toBe('promocionales 2026');
  });

  it('descarta ids y números sueltos, que no sirven de búsqueda', () => {
    expect(terminoDesdeRuta('/products/12345')).toBe('');
    expect(terminoDesdeRuta('/a')).toBe('');
  });

  it('aguanta la raíz y las entradas vacías', () => {
    expect(terminoDesdeRuta('/')).toBe('');
    expect(terminoDesdeRuta('')).toBe('');
    expect(terminoDesdeRuta(undefined)).toBe('');
  });

  it('decodifica acentos escapados en la URL', () => {
    expect(terminoDesdeRuta('/products/bol%C3%ADgrafo-metalico')).toBe('bolígrafo metalico');
  });

  it('ignora la query string', () => {
    expect(terminoDesdeRuta('/products/termo-carich?Color=NEGRO')).toBe('termo carich');
  });
});
