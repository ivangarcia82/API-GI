import {describe, it, expect, vi} from 'vitest';
import {
  LINES,
  CATALOG_SEARCH,
  modelName,
  colorName,
  tidyDescription,
  normalizeCatalog,
  findVariant,
  fetchCatalog,
} from './catalog.js';

const img = (url) => ({url, altText: null});

function node(over = {}) {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'g4-moc-zen',
    title: 'MOCHILA TAKAYAMA ZEN MOC-ZEN',
    description: 'Mochila ligera.',
    tags: ['mochila-takayama', 'textil'],
    featuredImage: img('https://cdn/zen.png'),
    variants: {nodes: [{id: 'v1', title: 'NEGRO', availableForSale: true, image: null}]},
    ...over,
  };
}

const wagner = (over = {}) =>
  node({
    id: 'gid://shopify/Product/9',
    handle: 'g4-moc-arx',
    title: 'MOCHILA WAGNER ARMOR MAX MOC-ARX',
    tags: ['mochila-wagner'],
    variants: {nodes: [{id: 'w1', title: 'NEGRO/GRIS', availableForSale: true, image: null}]},
    ...over,
  });

describe('LINES', () => {
  it('declara Takayama y Wagner en ese orden', () => {
    expect(LINES).toEqual([
      {id: 'takayama', name: 'Takayama', tag: 'mochila-takayama'},
      {id: 'wagner', name: 'Wagner', tag: 'mochila-wagner'},
    ]);
    expect(CATALOG_SEARCH).toBe('tag:mochila-takayama OR tag:mochila-wagner');
  });
});

describe('nombres', () => {
  it('limpia el título según la línea', () => {
    expect(modelName('MOCHILA TAKAYAMA ZEN MOC-ZEN', 'Takayama')).toBe('Zen');
    expect(modelName('MOCHILA TAKAYAMA TAKTIK TROLLEY MOC-TAT', 'Takayama')).toBe('Taktik Trolley');
    expect(modelName('MOCHILA WAGNER ARMOR MAX MOC-ARX', 'Wagner')).toBe('Armor Max');
  });

  it('formatea colores compuestos', () => {
    expect(colorName('NEGRO/GRIS')).toBe('Negro / Gris');
    expect(colorName('NEGRO')).toBe('Negro');
  });

  it('separa oraciones pegadas en la descripción', () => {
    expect(tidyDescription('resistente al aguaFabricada con telas')).toBe(
      'resistente al agua. Fabricada con telas',
    );
  });
});

describe('normalizeCatalog', () => {
  it('agrupa por línea en el orden de LINES', () => {
    const out = normalizeCatalog([wagner(), node()]);
    expect(out.map((l) => l.id)).toEqual(['takayama', 'wagner']);
    expect(out[0]).toEqual({
      id: 'takayama',
      name: 'Takayama',
      products: [
        {
          id: 'gid://shopify/Product/1',
          handle: 'g4-moc-zen',
          name: 'Zen',
          description: 'Mochila ligera.',
          variants: [{id: 'v1', color: 'Negro', image: 'https://cdn/zen.png', imageAlt: null}],
        },
      ],
    });
    expect(out[1].products[0]).toMatchObject({name: 'Armor Max', variants: [{color: 'Negro / Gris'}]});
  });

  it('prefiere la imagen de la variante', () => {
    const [line] = normalizeCatalog([
      node({
        variants: {
          nodes: [{id: 'v1', title: 'ROJO', availableForSale: true, image: img('https://cdn/rojo.png')}],
        },
      }),
    ]);
    expect(line.products[0].variants[0].image).toBe('https://cdn/rojo.png');
  });

  it('descarta variantes y productos sin inventario', () => {
    const out = normalizeCatalog([
      node({
        id: 'p1',
        variants: {
          nodes: [
            {id: 'a', title: 'AZUL/NEGRO', availableForSale: false, image: null},
            {id: 'b', title: 'GRIS/NEGRO', availableForSale: true, image: null},
          ],
        },
      }),
      node({
        id: 'p2',
        title: 'MOCHILA TAKAYAMA MAIKO MOC-MAI',
        variants: {nodes: [{id: 'c', title: 'GRIS', availableForSale: false, image: null}]},
      }),
    ]);
    expect(out[0].products.map((p) => p.id)).toEqual(['p1']);
    expect(out[0].products[0].variants.map((v) => v.id)).toEqual(['b']);
  });

  it('descarta productos sin tag de campaña y omite líneas vacías', () => {
    const out = normalizeCatalog([node({tags: ['textil']}), wagner()]);
    expect(out.map((l) => l.id)).toEqual(['wagner']);
  });

  it('ordena los modelos por nombre dentro de cada línea', () => {
    const out = normalizeCatalog([
      node({id: 'z', title: 'MOCHILA TAKAYAMA ZEN MOC-ZEN'}),
      node({id: 'a', title: 'MOCHILA TAKAYAMA EVO MOC-EVO'}),
    ]);
    expect(out[0].products.map((p) => p.name)).toEqual(['Evo', 'Zen']);
  });

  it('tolera null', () => {
    expect(normalizeCatalog(null)).toEqual([]);
  });
});

describe('findVariant', () => {
  const lines = normalizeCatalog([node(), wagner()]);
  it('encuentra la variante con su producto y su línea', () => {
    expect(findVariant(lines, 'w1')).toMatchObject({
      line: {id: 'wagner', name: 'Wagner'},
      product: {name: 'Armor Max'},
      variant: {color: 'Negro / Gris'},
    });
  });
  it('null si no existe', () => {
    expect(findVariant(lines, 'otra')).toBeNull();
  });
});

describe('fetchCatalog', () => {
  it('consulta ambos tags y normaliza', async () => {
    const storefront = {
      query: vi.fn().mockResolvedValue({products: {nodes: [node(), wagner()]}}),
      CacheShort: () => 'short',
    };
    const out = await fetchCatalog(storefront);
    expect(storefront.query.mock.calls[0][1]).toEqual({
      variables: {query: 'tag:mochila-takayama OR tag:mochila-wagner'},
      cache: 'short',
    });
    expect(out).toHaveLength(2);
  });
});
