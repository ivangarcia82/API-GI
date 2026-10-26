import {describe, it, expect, vi} from 'vitest';

/* Sin mock de @shopify/hydrogen: _index.jsx no lo importa directamente, y
   mockearlo a medias rompería a los componentes que sí lo hacen de paso. */
const storefrontQuery = vi.fn(async () => ({}));
const fetchCollectionCards = vi.fn(async (_sf, handles) =>
  handles.map((handle) => ({handle, title: handle, image: `https://cdn/${handle}.jpg`})),
);

vi.mock('~/lib/giFragments', async (original) => ({
  ...(await original()),
  fetchCollectionCards: (...a) => fetchCollectionCards(...a),
}));

import {loader} from './_index.jsx';

const context = {
  storefront: {query: (...a) => storefrontQuery(...a)},
  session: {},
  env: {PUBLIC_STORE_DOMAIN: 'x.myshopify.com'},
};

describe('home · loader', () => {
  /* El hero dejó de mostrar productos (ahora son categorías) y era lo único
     que usaba la tira de más vendidos: pedir 60 productos, su paleta y su
     precio por cliente en cada visita al home sería trabajo tirado. */
  it('no pide productos sueltos', async () => {
    const out = await loader({context});
    expect(out.products).toBeUndefined();
    expect(storefrontQuery).not.toHaveBeenCalled();
  });

  it('trae las imágenes de categoría para el hero', async () => {
    const out = await loader({context});
    expect(out.categoryCards.find((c) => c.handle === 'bebidas').image).toBe('https://cdn/bebidas.jpg');
  });
});
