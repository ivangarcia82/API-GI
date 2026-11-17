/* La página de resultados de /search era la lista sin estilo de la plantilla
   base: miniaturas de 50px, un título debajo de otro, sin tarjetas ni filtros.
   El catálogo ya enseña esos mismos resultados con el diseño del sitio
   (/catalogo?q=…), así que la búsqueda completa vive ahí y /search sólo
   atiende al buscador instantáneo. */
import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: async () => null,
  getColorVocabulary: async () => null,
}));

import {loader} from './search.jsx';

const storefrontQuery = vi.fn();
const context = {
  env: {},
  session: {get: () => undefined},
  storefront: {query: (...a) => storefrontQuery(...a)},
};

/** El loader redirige lanzando o devolviendo la Response: se aceptan ambas. */
async function pedir(ruta) {
  try {
    return await loader({context, request: new Request(`https://gi.test${ruta}`)});
  } catch (lanzado) {
    return lanzado;
  }
}

beforeEach(() => storefrontQuery.mockReset());

describe('/search manda la búsqueda completa al catálogo', () => {
  it('con término, al catálogo con ese término', async () => {
    const res = await pedir('/search?q=termo');
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/catalogo?q=termo');
  });

  it('conserva acentos y espacios del término', async () => {
    const res = await pedir('/search?q=' + encodeURIComponent('café con leche'));
    const destino = new URL(res.headers.get('Location'), 'https://gi.test');
    expect(destino.pathname).toBe('/catalogo');
    expect(destino.searchParams.get('q')).toBe('café con leche');
  });

  it('sin término, al catálogo a secas', async () => {
    const res = await pedir('/search');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/catalogo');
    const vacio = await pedir('/search?q=%20%20');
    expect(vacio.headers.get('Location')).toBe('/catalogo');
  });

  it('no le pide nada a Shopify: los resultados los trae el catálogo', async () => {
    await pedir('/search?q=termo');
    expect(storefrontQuery).not.toHaveBeenCalled();
  });
});

describe('/search sigue atendiendo al buscador instantáneo', () => {
  it('con predictive devuelve resultados, no una redirección', async () => {
    storefrontQuery.mockResolvedValue({
      predictiveSearch: {articles: [], collections: [], pages: [], products: [], queries: []},
    });
    const out = await pedir('/search?q=termo&predictive=true&limit=6');
    expect(out).not.toBeInstanceOf(Response);
    expect(out.type).toBe('predictive');
    expect(out.term).toBe('termo');
  });
});
