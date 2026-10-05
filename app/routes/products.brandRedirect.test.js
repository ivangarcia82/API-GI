/* El loader tiene que APLICAR la decisión de opcionesDeMarca, no sólo saber
   calcularla: "lo computé y se me olvidó usarlo" es el fallo que estos tests
   cazan, y no lo caza el test de la función pura. */
import {describe, it, expect, vi, beforeEach} from 'vitest';

vi.mock('~/lib/pricing.server', () => ({
  applyCustomerPrices: async (_ctx, data) => data,
  getCustomerMargin: async () => null,
}));

const storefrontQuery = vi.fn();
const getBrandColors = vi.fn();
vi.mock('~/lib/brand-colors.server', () => ({
  getBrandColors: (...a) => getBrandColors(...a),
}));
vi.mock('~/lib/admin/operations', () => ({
  getVariantInventory: vi.fn(async () => null),
}));

import {loader} from './products.$handle.jsx';

const variante = (color) => ({
  id: `gid://variant/${color}`,
  selectedOptions: [{name: 'Color', value: color}],
});

const PRODUCTO = (colorActual) => ({
  id: 'gid://shopify/Product/1',
  handle: 'mochila-test',
  options: [
    {
      name: 'Color',
      optionValues: ['AZUL', 'ROJO'].map((t) => ({
        name: t,
        firstSelectableVariant: variante(t),
      })),
    },
  ],
  selectedOrFirstAvailableVariant: variante(colorActual),
});

const context = {storefront: {query: (...a) => storefrontQuery(...a)}, env: {}, session: {}};

const pedir = (url = 'https://gi.test/products/mochila-test') =>
  loader({context, params: {handle: 'mochila-test'}, request: new Request(url)});

/** Lanza la Response de redirección, o null si el loader devolvió datos. */
const redireccion = async (url) => {
  try {
    await pedir(url);
    return null;
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
};

beforeEach(() => {
  storefrontQuery.mockReset();
  storefrontQuery.mockImplementation(async (consulta) =>
    /productRecommendations/.test(consulta)
      ? {productRecommendations: []}
      : {product: PRODUCTO('AZUL')},
  );
  getBrandColors.mockReset();
  getBrandColors.mockResolvedValue(null);
});

describe('ficha · redirección al color de la marca', () => {
  it('sin paleta no redirige', async () => {
    expect(await redireccion()).toBeNull();
  });

  it('redirige cuando la ficha aterrizaría en un color ajeno', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    const res = await redireccion();
    expect(res?.status).toBe(302);
    expect(res.headers.get('location')).toBe('/products/mochila-test?Color=ROJO');
  });

  it('no redirige si ya está en un color suyo', async () => {
    storefrontQuery.mockImplementation(async (consulta) =>
      /productRecommendations/.test(consulta)
        ? {productRecommendations: []}
        : {product: PRODUCTO('ROJO')},
    );
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    expect(await redireccion()).toBeNull();
  });

  /* Los parámetros que ya traía la URL no son nuestros para tirarlos: por ahí
     llegan las campañas y el seguimiento de las ejecutivas. */
  it('conserva el resto de parámetros de la URL', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    const res = await redireccion('https://gi.test/products/mochila-test?utm_source=correo');
    expect(res.headers.get('location')).toBe(
      '/products/mochila-test?utm_source=correo&Color=ROJO',
    );
  });

  /* Redirigir antes de pagar stock y recomendaciones: si nos vamos, esas dos
     consultas se tirarían a la basura. */
  it('no pide las recomendaciones cuando va a redirigir', async () => {
    getBrandColors.mockResolvedValue({families: ['rojo'], raw: '["Rojo"]'});
    await redireccion();
    const consultas = storefrontQuery.mock.calls.map(([c]) => c);
    expect(consultas.some((c) => /productRecommendations/.test(c))).toBe(false);
  });
});
