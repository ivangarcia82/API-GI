import {describe, it, expect} from 'vitest';
import {
  parseBrandColors,
  effectiveColorFamilies,
  visibleColorSelection,
  brandProductFilters,
  hayVocabulario,
  productMatchesBrand,
  keepBrandProducts,
  brandOptionValues,
  brandVariantId,
} from './brand-colors.js';
import {SIN_COINCIDENCIA} from './filters.js';
import {normalizeProduct} from './gi.js';

/* El metafield es list.single_line_text_field SIN validación de choices: es
   texto libre que escribe una persona en el admin. Todo lo que sigue son
   valores que de verdad puede traer. */
describe('parseBrandColors', () => {
  it('traduce el valor real de la tienda a familias', () => {
    expect(parseBrandColors('["Rojo","Negro"]')).toEqual(['rojo', 'negro']);
  });

  it('clasifica tonos compuestos por su familia', () => {
    expect(parseBrandColors('["AZUL MARINO","Verde Pistacho"]')).toEqual(['azul', 'verde']);
  });

  it('colapsa los que caen en la misma familia', () => {
    expect(parseBrandColors('["Rojo","Vino","Guinda"]')).toEqual(['rojo']);
  });

  it('descarta lo que no es un color y conserva lo que sí', () => {
    expect(parseBrandColors('["Pantone 186C","Negro"]')).toEqual(['negro']);
  });

  /* Fail-open: una errata en el admin no puede vaciarle el catálogo a un
     cliente. Sin familias reconocibles, no se filtra. */
  it('devuelve vacío si nada es reconocible', () => {
    expect(parseBrandColors('["Pantone 186C","#c2352c"]')).toEqual([]);
  });

  it.each([
    ['null', null],
    ['cadena vacía', ''],
    ['JSON roto', '["Rojo"'],
    ['no es un array', '{"color":"Rojo"}'],
    ['array vacío', '[]'],
  ])('devuelve vacío con %s', (_, valor) => {
    expect(parseBrandColors(valor)).toEqual([]);
  });
});

describe('effectiveColorFamilies', () => {
  it('sin marca respeta la selección del usuario', () => {
    expect(effectiveColorFamilies(['verde'], [])).toEqual(['verde']);
  });

  it('con marca y sin selección devuelve la paleta entera', () => {
    expect(effectiveColorFamilies([], ['rojo', 'negro'])).toEqual(['rojo', 'negro']);
  });

  it('con marca y selección devuelve la intersección', () => {
    expect(effectiveColorFamilies(['rojo', 'verde'], ['rojo', 'negro'])).toEqual(['rojo']);
  });

  /* Nadie se sale de su paleta editando la URL a mano. */
  it('vuelve a la paleta si la selección queda fuera de ella', () => {
    expect(effectiveColorFamilies(['verde'], ['rojo', 'negro'])).toEqual(['rojo', 'negro']);
  });
});

describe('visibleColorSelection', () => {
  it('sin marca es la selección tal cual', () => {
    expect(visibleColorSelection(['verde'], [])).toEqual(['verde']);
  });

  /* Los chips sólo pueden prometer lo que la consulta está aplicando: un chip
     "Verde" con una x que no quita nada sería mentir. */
  it('con marca borra lo que no es de la paleta', () => {
    expect(visibleColorSelection(['rojo', 'verde'], ['rojo', 'negro'])).toEqual(['rojo']);
  });
});

const VOCABULARIO = [
  {label: 'ROJO', count: 66},
  {label: 'VINO', count: 5},
  {label: 'NEGRO', count: 61},
  {label: 'AZUL MARINO', count: 15},
  {label: 'UNICO', count: 2},
];

describe('brandProductFilters', () => {
  it('expande cada familia a todos sus tonos del catálogo', () => {
    expect(brandProductFilters(['rojo'], VOCABULARIO)).toEqual([
      {variantOption: {name: 'color', value: 'ROJO'}},
      {variantOption: {name: 'color', value: 'VINO'}},
    ]);
  });

  it('sin marca no filtra', () => {
    expect(brandProductFilters([], VOCABULARIO)).toBeNull();
  });

  /* Fail-closed, el único caso: el vocabulario se leyó, la marca es morada y
     la tienda no vende nada morado. La verdad es "no hay nada para ti aquí",
     no "toma el catálogo entero". Un valor imposible es cómo se le dice eso a
     la API sin que cada loader tenga que ramificar. */
  it('devuelve un filtro imposible si ninguna familia existe en el catálogo', () => {
    const out = brandProductFilters(['morado'], VOCABULARIO);
    expect(out).toHaveLength(1);
    expect(out[0].variantOption.value).toBe('GI-SIN-COINCIDENCIA');
  });

  /* Fail-open, la otra rama, y la que importa no confundir: sin vocabulario no
     sabemos qué tonos existen, así que no se puede afirmar que la marca no
     tenga ninguno. El catálogo sin filtrar es el público, no el de otro
     cliente: no hay fuga que evitar, y apagarle la tienda a un cliente que
     paga por un hipo de la faceta sería mucho peor. */
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['lista vacía', []],
  ])('no filtra nada si el vocabulario llega como %s', (_, vocabulario) => {
    expect(brandProductFilters(['rojo'], vocabulario)).toBeNull();
  });

  /* La distinción entera, en una línea: la MISMA paleta da 0 productos con
     vocabulario y el catálogo completo sin él. */
  it('separa "no hay tonos de esa familia" de "no hay vocabulario"', () => {
    expect(brandProductFilters(['morado'], VOCABULARIO)).toEqual([SIN_COINCIDENCIA]);
    expect(brandProductFilters(['morado'], null)).toBeNull();
  });
});

describe('hayVocabulario', () => {
  it('sólo una lista con valores cuenta como vocabulario leído', () => {
    expect(hayVocabulario(VOCABULARIO)).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['lista vacía', []],
    ['algo que no es lista', {ROJO: 1}],
  ])('%s es "no lo sé", no "no hay ninguno"', (_, valor) => {
    expect(hayVocabulario(valor)).toBe(false);
  });
});

describe('productMatchesBrand', () => {
  const producto = {colors: ['ROJO', 'AZUL MARINO', 'UNICO']};

  it('sin marca pasa todo', () => {
    expect(productMatchesBrand(producto, [])).toBe(true);
  });

  /* ANY: basta con que se pueda pedir en uno de sus colores. */
  it('basta con que coincida un tono', () => {
    expect(productMatchesBrand(producto, ['rojo'])).toBe(true);
  });

  it('no coincide si ningún tono es de la paleta', () => {
    expect(productMatchesBrand(producto, ['verde'])).toBe(false);
  });

  it('lee la opción de variante cuando no viene normalizado', () => {
    const crudo = {options: [{name: 'Color', optionValues: [{name: 'NEGRO'}]}]};
    expect(productMatchesBrand(crudo, ['negro'])).toBe(true);
  });

  /* UNICO / TRANSPARENTE / MARMOLEADO no son colores: no pertenecen a ninguna
     familia y por tanto no salvan a un producto. */
  it('un producto sólo en tonos no clasificables no coincide con nada', () => {
    expect(productMatchesBrand({colors: ['UNICO', 'TRANSPARENTE']}, ['rojo'])).toBe(false);
  });

  it('un producto sin colores no coincide', () => {
    expect(productMatchesBrand({colors: []}, ['rojo'])).toBe(false);
  });
});

/* El catálogo, las colecciones y la búsqueda filtran en la API sobre TODOS los
   tonos del producto; el home, los favoritos, los similares y los vistos
   recientemente post-filtran en memoria sobre el producto ya normalizado. Si
   normalizeProduct recorta `colors`, las dos vías dejan de coincidir y el
   cliente marca un favorito desde el catálogo que después no aparece en su
   lista. Medido contra la tienda el 2026-09-04: 177 productos tienen más de
   ocho valores de color, y con la paleta real ["Rojo","Negro"] eran 3 los que
   se veían en el catálogo y desaparecían de favoritos. */
describe('coherencia con normalizeProduct', () => {
  // VASO DE PLÁSTICO DE 450 ML CONGA A3172: trae ROJO y NEGRO en las
  // posiciones 9 y 10 de su opción de color.
  const TONOS = [
    'AZUL',
    'AZUL CIELO',
    'BLANCO',
    'GRIS',
    'MORADO',
    'NARANJA',
    'AMARILLO',
    'VERDE',
    'ROJO',
    'NEGRO',
  ];
  const crudo = {
    id: 'gid://shopify/Product/1',
    handle: 'vaso-conga',
    title: 'VASO DE PLÁSTICO DE 450 ML CONGA A3172',
    featuredImage: {url: 'https://img/vaso.jpg'},
    priceRange: {minVariantPrice: {amount: '25.0', currencyCode: 'MXN'}},
    options: [{name: 'color', optionValues: TONOS.map((name) => ({name}))}],
  };
  const marca = ['rojo', 'negro'];

  it('normalizeProduct conserva todos los tonos', () => {
    expect(normalizeProduct(crudo).colors).toEqual(TONOS);
  });

  it('el mismo producto coincide crudo y normalizado', () => {
    expect(productMatchesBrand(crudo, marca)).toBe(true);
    expect(productMatchesBrand(normalizeProduct(crudo), marca)).toBe(true);
  });

  it('y sigue sin coincidir con una paleta que no trae', () => {
    expect(productMatchesBrand(normalizeProduct(crudo), ['cafe'])).toBe(false);
  });
});

describe('keepBrandProducts', () => {
  const lista = [{id: 1, colors: ['ROJO']}, {id: 2, colors: ['VERDE']}];

  it('sin marca devuelve la lista intacta', () => {
    expect(keepBrandProducts(lista, [])).toBe(lista);
  });

  it('con marca deja sólo los que coinciden', () => {
    expect(keepBrandProducts(lista, ['rojo']).map((p) => p.id)).toEqual([1]);
  });
});

/* Ver los productos de su paleta no basta: dentro de un producto que sí es
   suyo siguen apareciendo los tonos que no lo son, y el botón de cotizar puede
   mandar una variante de cualquier color. Estas dos funciones cierran eso. */

const VALORES_COLOR = [
  {name: 'ROJO'},
  {name: 'AZUL MARINO'},
  {name: 'VINO'},
  {name: 'VERDE'},
];

describe('brandOptionValues', () => {
  it('sin paleta devuelve la lista tal cual', () => {
    expect(brandOptionValues(VALORES_COLOR, [])).toBe(VALORES_COLOR);
  });

  it('con paleta deja sólo los tonos de la marca', () => {
    expect(brandOptionValues(VALORES_COLOR, ['azul']).map((v) => v.name)).toEqual([
      'AZUL MARINO',
    ]);
  });

  /* Por familia, no por texto: "Rojo" en el metafield tiene que traerse VINO. */
  it('recorta por familia y no por coincidencia exacta', () => {
    expect(brandOptionValues(VALORES_COLOR, ['rojo']).map((v) => v.name)).toEqual([
      'ROJO',
      'VINO',
    ]);
  });

  /* Si no hay nada a lo que reducir, no se reduce: un selector de color vacío
     no le dice al cliente en qué colores existe el producto. Es el caso de la
     ficha que sólo se alcanza por link directo. */
  it('devuelve la lista entera si ningún tono es de la marca', () => {
    expect(brandOptionValues(VALORES_COLOR, ['morado'])).toBe(VALORES_COLOR);
  });

  it('tolera una lista vacía', () => {
    expect(brandOptionValues([], ['rojo'])).toEqual([]);
  });

  /* La ficha le pasa los valores de opción de la Storefront API ({name}); la
     tarjeta, los tonos ya normalizados de `product.colors`, que son cadenas
     sueltas. Una sola función para las dos formas, como ya hace tonosDe. */
  it('acepta también una lista de cadenas', () => {
    expect(brandOptionValues(['ROJO', 'AZUL', 'VINO'], ['rojo'])).toEqual(['ROJO', 'VINO']);
  });

  it('devuelve la lista entera de cadenas si ninguna es de la marca', () => {
    const tonos = ['AZUL', 'VERDE'];
    expect(brandOptionValues(tonos, ['rojo'])).toBe(tonos);
  });
});

const PRODUCTO = {
  firstVariantId: 'gid://variant/DEFECTO',
  colorVariants: [
    {name: 'AZUL', variantId: 'gid://variant/AZUL'},
    {name: 'VINO', variantId: 'gid://variant/VINO'},
    {name: 'NEGRO', variantId: 'gid://variant/NEGRO'},
  ],
};

describe('brandVariantId', () => {
  it('sin paleta cotiza la variante por defecto', () => {
    expect(brandVariantId(PRODUCTO, [])).toBe('gid://variant/DEFECTO');
  });

  /* El botón de cotizar del catálogo mandaba `firstVariantId` a secas, que
     puede ser de un color que el cliente no puede pedir. */
  it('con paleta cotiza la primera variante de su color', () => {
    expect(brandVariantId(PRODUCTO, ['rojo'])).toBe('gid://variant/VINO');
  });

  it('respeta el orden de los tonos del producto', () => {
    expect(brandVariantId(PRODUCTO, ['negro', 'azul'])).toBe('gid://variant/AZUL');
  });

  it('salta los tonos que no tienen variante seleccionable', () => {
    const sinVariante = {
      firstVariantId: 'gid://variant/DEFECTO',
      colorVariants: [
        {name: 'VINO', variantId: null},
        {name: 'ROJO', variantId: 'gid://variant/ROJO'},
      ],
    };
    expect(brandVariantId(sinVariante, ['rojo'])).toBe('gid://variant/ROJO');
  });

  it('cae en la variante por defecto si ningún tono es de la marca', () => {
    expect(brandVariantId(PRODUCTO, ['morado'])).toBe('gid://variant/DEFECTO');
  });

  it('cae en la variante por defecto si el producto no trae colorVariants', () => {
    expect(brandVariantId({firstVariantId: 'gid://variant/X'}, ['rojo'])).toBe(
      'gid://variant/X',
    );
  });

  it('devuelve null si no hay ninguna variante que cotizar', () => {
    expect(brandVariantId({}, ['rojo'])).toBeNull();
  });
});
