import {describe, it, expect, vi, beforeEach} from 'vitest';

const getCustomerBrandColors = vi.fn();
vi.mock('./admin/operations.js', () => ({
  getCustomerBrandColors: (...a) => getCustomerBrandColors(...a),
}));

const getSessionUser = vi.fn();
vi.mock('./auth/session.js', () => ({
  getSessionUser: (...a) => getSessionUser(...a),
}));

import {getBrandColors, getColorVocabulary} from './brand-colors.server.js';

/* withCache se salta la caché y ejecuta: aquí se prueba la lógica, no
   Hydrogen. Pero SÍ se guardan las opciones con las que se le llama: la clave
   de caché es lo único que impide que dos clientes con paletas distintas
   compartan entrada, y sin capturarla ningún test lo vigilaba. */
const opcionesDeCache = [];
const storefrontQuery = vi.fn();

const hazContexto = () => ({
  env: {PRIVATE_ADMIN_API_TOKEN: 't'},
  session: {},
  storefront: {query: (...a) => storefrontQuery(...a)},
  withCache: {
    run: (opciones, fn) => {
      opcionesDeCache.push(opciones);
      return fn({addDebugData: () => {}});
    },
  },
});

/** Respuesta de la faceta de color con los tonos indicados. */
const conFaceta = (values) => ({
  search: {productFilters: [{id: 'filter.v.option.color', values}]},
});

beforeEach(() => {
  getCustomerBrandColors.mockReset();
  getSessionUser.mockReset();
  storefrontQuery.mockReset();
  opcionesDeCache.length = 0;
});

describe('getBrandColors', () => {
  it('devuelve las familias del cliente que tiene paleta', async () => {
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://shopify/Customer/1'});
    getCustomerBrandColors.mockResolvedValue('["Rojo","Negro"]');
    const out = await getBrandColors(hazContexto());
    expect(out.families).toEqual(['rojo', 'negro']);
  });

  it('devuelve null sin sesión', async () => {
    getSessionUser.mockReturnValue(null);
    expect(await getBrandColors(hazContexto())).toBeNull();
    expect(getCustomerBrandColors).not.toHaveBeenCalled();
  });

  it('devuelve null si el usuario no está enlazado a Shopify', async () => {
    getSessionUser.mockReturnValue({userId: 'u1', gid: null});
    expect(await getBrandColors(hazContexto())).toBeNull();
    expect(getCustomerBrandColors).not.toHaveBeenCalled();
  });

  it('devuelve null si el metafield está vacío', async () => {
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://x'});
    getCustomerBrandColors.mockResolvedValue(null);
    expect(await getBrandColors(hazContexto())).toBeNull();
  });

  /* Fail-open ruidoso: una errata en el admin no puede vaciarle el catálogo a
     un cliente, pero tiene que quedar rastro para poder corregirla. */
  it('no restringe si ningún valor del metafield es reconocible, y avisa', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://x'});
    getCustomerBrandColors.mockResolvedValue('["Pantone 186C"]');
    expect(await getBrandColors(hazContexto())).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  /* El catálogo no puede caerse porque el Admin API tenga un mal día. */
  it('no restringe ni lanza si el Admin API falla', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://x'});
    getCustomerBrandColors.mockRejectedValue(new Error('502'));
    expect(await getBrandColors(hazContexto())).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  /* El loader de root y el de la ruta corren en paralelo: sin memo, cada
     página pagaría dos llamadas idénticas al Admin API. */
  it('memoiza por request', async () => {
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://x'});
    getCustomerBrandColors.mockResolvedValue('["Rojo"]');
    const context = hazContexto();
    const [a, b] = await Promise.all([getBrandColors(context), getBrandColors(context)]);
    expect(a).toBe(b);
    expect(getCustomerBrandColors).toHaveBeenCalledTimes(1);
  });

  /* Aislamiento: dos clientes distintos en el mismo isolate no comparten
     resultado. */
  it('no comparte el memo entre requests distintas', async () => {
    getSessionUser.mockReturnValueOnce({userId: 'u1', gid: 'gid://1'});
    getCustomerBrandColors.mockResolvedValueOnce('["Rojo"]');
    const uno = await getBrandColors(hazContexto());
    getSessionUser.mockReturnValueOnce({userId: 'u2', gid: 'gid://2'});
    getCustomerBrandColors.mockResolvedValueOnce('["Verde"]');
    const dos = await getBrandColors(hazContexto());
    expect(uno.families).toEqual(['rojo']);
    expect(dos.families).toEqual(['verde']);
  });

  /* La única forma de fuga entre clientes que tiene el diseño: si la clave de
     caché pierde el gid, durante los cinco minutos del TTL todos los clientes
     con sesión reciben la paleta del primero que cargó. */
  it('mete el gid del cliente en la clave de caché', async () => {
    getSessionUser.mockReturnValue({userId: 'u1', gid: 'gid://shopify/Customer/7'});
    getCustomerBrandColors.mockResolvedValue('["Rojo"]');
    await getBrandColors(hazContexto());
    expect(opcionesDeCache).toHaveLength(1);
    expect(opcionesDeCache[0].cacheKey).toContain('gid://shopify/Customer/7');
  });

  it('da claves distintas a clientes distintos', async () => {
    getSessionUser.mockReturnValueOnce({userId: 'u1', gid: 'gid://1'});
    getCustomerBrandColors.mockResolvedValueOnce('["Rojo"]');
    await getBrandColors(hazContexto());
    getSessionUser.mockReturnValueOnce({userId: 'u2', gid: 'gid://2'});
    getCustomerBrandColors.mockResolvedValueOnce('["Verde"]');
    await getBrandColors(hazContexto());
    const [a, b] = opcionesDeCache.map((o) => JSON.stringify(o.cacheKey));
    expect(a).not.toEqual(b);
  });
});

/* El vocabulario es lo que permite expandir "Rojo" a ROJO/VINO/GUINDA. Cuando
   no llega, quien lo consume tiene que poder notarlo: una lista vacía se
   confundiría con "la tienda no vende nada de color" y le apagaría el catálogo
   al cliente con paleta. */
describe('getColorVocabulary', () => {
  it('devuelve los tonos con existencias de la faceta de color', async () => {
    storefrontQuery.mockResolvedValue(
      conFaceta([
        {label: 'ROJO', count: 66},
        {label: 'AZUL MARINO', count: 15},
        {label: 'DESCATALOGADO', count: 0},
      ]),
    );
    expect(await getColorVocabulary(hazContexto())).toEqual([
      {label: 'ROJO', count: 66},
      {label: 'AZUL MARINO', count: 15},
    ]);
  });

  it('devuelve null, y avisa, si la faceta llega vacía', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    storefrontQuery.mockResolvedValue(conFaceta([]));
    expect(await getColorVocabulary(hazContexto())).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  /* El índice de búsqueda degradado del 2026-09-04: la consulta respondía, sin
     una sola faceta. */
  it('devuelve null, y avisa, si la respuesta no trae facetas', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    storefrontQuery.mockResolvedValue({search: {productFilters: []}});
    expect(await getColorVocabulary(hazContexto())).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('devuelve null, y avisa, si la consulta falla', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    storefrontQuery.mockRejectedValue(new Error('502'));
    expect(await getColorVocabulary(hazContexto())).toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('memoiza por request', async () => {
    storefrontQuery.mockResolvedValue(conFaceta([{label: 'ROJO', count: 1}]));
    const context = hazContexto();
    await Promise.all([getColorVocabulary(context), getColorVocabulary(context)]);
    expect(storefrontQuery).toHaveBeenCalledTimes(1);
  });
});
