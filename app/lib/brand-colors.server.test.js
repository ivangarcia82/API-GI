import {describe, it, expect, vi, beforeEach} from 'vitest';

const getCustomerBrandColors = vi.fn();
vi.mock('./admin/operations.js', () => ({
  getCustomerBrandColors: (...a) => getCustomerBrandColors(...a),
}));

const getSessionUser = vi.fn();
vi.mock('./auth/session.js', () => ({
  getSessionUser: (...a) => getSessionUser(...a),
}));

import {getBrandColors} from './brand-colors.server.js';

/* withCache se salta la caché y ejecuta: aquí se prueba la lógica, no Hydrogen. */
const hazContexto = () => ({
  env: {PRIVATE_ADMIN_API_TOKEN: 't'},
  session: {},
  withCache: {run: (_opciones, fn) => fn({addDebugData: () => {}})},
});

beforeEach(() => {
  getCustomerBrandColors.mockReset();
  getSessionUser.mockReset();
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
});
