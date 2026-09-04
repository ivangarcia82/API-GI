import {describe, it, expect} from 'vitest';
import {
  COLOR_FAMILIES,
  colorFamilyOf,
  groupColorValues,
  parseFilterParams,
  buildSearchQuery,
  buildProductFilters,
  resolveCatalogSource,
  appliedFilters,
  toggleMulti,
  activeChips,
  SORTS,
} from './filters';

/* ------------------------------------------------------------------ *
 * Familias de color                                                   *
 * ------------------------------------------------------------------ */

describe('colorFamilyOf', () => {
  it('clasifica el tono base', () => {
    expect(colorFamilyOf('VERDE')).toBe('verde');
    expect(colorFamilyOf('NEGRO')).toBe('negro');
  });

  it('clasifica tonos compuestos por su palabra de familia', () => {
    expect(colorFamilyOf('VERDE PISTACHO')).toBe('verde');
    expect(colorFamilyOf('AZUL MARINO')).toBe('azul');
    expect(colorFamilyOf('ROSA PÁLIDO')).toBe('rosa');
    expect(colorFamilyOf('PLATA DAMA')).toBe('plata');
  });

  it('ignora acentos y mayúsculas', () => {
    expect(colorFamilyOf('café')).toBe('cafe');
    expect(colorFamilyOf('CAFE CLARO')).toBe('cafe');
    expect(colorFamilyOf('MoRaDo')).toBe('morado');
  });

  it('descarta valores que no son colores', () => {
    // La faceta real de la tienda trae basura como "7X4CM"
    expect(colorFamilyOf('7X4CM')).toBeNull();
    expect(colorFamilyOf('')).toBeNull();
    expect(colorFamilyOf(null)).toBeNull();
  });

  it('reconoce multicolor como familia propia', () => {
    expect(colorFamilyOf('Multicolor')).toBe('multicolor');
  });

  it('clasifica por palabra completa, no por substring', () => {
    // "oro" es palabra clave de amarillo, pero "TESORO" no es un color dorado.
    expect(colorFamilyOf('TESORO')).toBeNull();
    // "rosa" es palabra clave, pero no debe dispararse dentro de "ROSAL".
    expect(colorFamilyOf('ROSAL')).toBeNull();
  });

  it('agrupa tonos emparentados en su familia visual', () => {
    // Decisión de producto: turquesa y aqua se compran como azules.
    expect(colorFamilyOf('TURQUESA')).toBe('azul');
    expect(colorFamilyOf('VINO')).toBe('rojo');
    expect(colorFamilyOf('BEIGE')).toBe('cafe');
  });
});

describe('groupColorValues', () => {
  const facetValues = [
    {label: 'VERDE', count: 20, input: '{"variantOption":{"name":"color","value":"VERDE"}}'},
    {label: 'VERDE PISTACHO', count: 5, input: '{}'},
    {label: 'AZUL', count: 100, input: '{}'},
    {label: 'AZUL MARINO', count: 37, input: '{}'},
    {label: '7X4CM', count: 1, input: '{}'},
  ];

  it('agrupa tonos en familias sumando sus conteos', () => {
    const familias = groupColorValues(facetValues);
    const verde = familias.find((f) => f.family === 'verde');
    expect(verde.count).toBe(25);
    expect(verde.values).toEqual(['VERDE', 'VERDE PISTACHO']);
  });

  it('descarta valores que no mapean a ninguna familia', () => {
    const familias = groupColorValues(facetValues);
    expect(familias.flatMap((f) => f.values)).not.toContain('7X4CM');
  });

  it('ordena las familias por número de productos', () => {
    const familias = groupColorValues(facetValues);
    expect(familias[0].family).toBe('azul'); // 137 > 25
  });

  it('devuelve lista vacía sin valores', () => {
    expect(groupColorValues([])).toEqual([]);
    expect(groupColorValues(null)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Lectura de la URL                                                   *
 * ------------------------------------------------------------------ */

describe('parseFilterParams', () => {
  it('lee todos los parámetros', () => {
    const p = new URLSearchParams(
      'q=mochila&cat=oficina&color=verde,azul&precioMin=100&precioMax=300&disp=1&sort=price-asc',
    );
    const f = parseFilterParams(p);
    expect(f.q).toBe('mochila');
    expect(f.cat).toBe('oficina');
    expect(f.color).toEqual(['verde', 'azul']);
    expect(f.precioMin).toBe(100);
    expect(f.precioMax).toBe(300);
    expect(f.soloDisponibles).toBe(true);
    expect(f.sort).toBe('price-asc');
  });

  it('aplica valores por defecto sin parámetros', () => {
    const f = parseFilterParams(new URLSearchParams());
    expect(f.q).toBe('');
    expect(f.cat).toBe('');
    expect(f.color).toEqual([]);
    expect(f.precioMin).toBeNull();
    expect(f.precioMax).toBeNull();
    expect(f.soloDisponibles).toBe(false);
    expect(f.sort).toBe('relevance');
  });

  it('ignora precios no numéricos', () => {
    const f = parseFilterParams(new URLSearchParams('precioMin=abc&precioMax='));
    expect(f.precioMin).toBeNull();
    expect(f.precioMax).toBeNull();
  });

  it('descarta un sort desconocido', () => {
    expect(parseFilterParams(new URLSearchParams('sort=inventado')).sort).toBe('relevance');
  });

  it('no deja entradas vacías en los multivalor', () => {
    const f = parseFilterParams(new URLSearchParams('color=,verde,,'));
    expect(f.color).toEqual(['verde']);
  });
});

/* ------------------------------------------------------------------ *
 * Construcción de la consulta                                         *
 * ------------------------------------------------------------------ */

describe('buildSearchQuery', () => {
  it('usa el comodín sin texto ni categoría', () => {
    expect(buildSearchQuery({q: '', cat: ''})).toBe('*');
  });

  it('pasa el texto libre tal cual', () => {
    expect(buildSearchQuery({q: 'mochila', cat: ''})).toBe('mochila');
  });

  it('ya NO mete la categoría en la búsqueda', () => {
    // `tag:"..."` dentro de query no filtra, sólo pesa en la relevancia: con
    // cualquier otro filtro se colaban productos de otras categorías. La
    // categoría se resuelve ahora por colección.
    expect(buildSearchQuery({q: '', cat: 'mochilas-y-maletas'})).toBe('*');
    expect(buildSearchQuery({q: 'mochila', cat: 'oficina'})).toBe('mochila');
  });

  it('los accesos rápidos tampoco viajan en la búsqueda', () => {
    // Igual que la categoría: tag: no filtra. Van por colección.
    expect(buildSearchQuery({q: 'mochila', cat: '', nuevos: true})).toBe('mochila');
    expect(buildSearchQuery({q: '', cat: '', ofertas: true})).toBe('*');
  });

  it('ni la categoría ni los accesos rápidos ensucian la búsqueda', () => {
    expect(buildSearchQuery({q: '', cat: 'textil', ofertas: true})).toBe('*');
  });

  it('escapa las comillas del texto del usuario', () => {
    expect(buildSearchQuery({q: 'mochila "grande"', cat: ''})).toBe('mochila \\"grande\\"');
  });
});

describe('buildProductFilters', () => {
  const familias = [
    {family: 'verde', values: ['VERDE', 'VERDE PISTACHO']},
    {family: 'azul', values: ['AZUL', 'AZUL MARINO']},
  ];

  it('devuelve null sin ningún filtro', () => {
    expect(buildProductFilters({color: []}, familias)).toBeNull();
  });

  it('expande una familia de color a un filtro por tono (semántica O)', () => {
    const f = buildProductFilters({color: ['verde']}, familias);
    expect(f).toEqual([
      {variantOption: {name: 'color', value: 'VERDE'}},
      {variantOption: {name: 'color', value: 'VERDE PISTACHO'}},
    ]);
  });

  it('expande varias familias', () => {
    const f = buildProductFilters({color: ['verde', 'azul']}, familias);
    expect(f).toHaveLength(4);
  });

  it('ignora familias que no existen en el resultado actual', () => {
    expect(buildProductFilters({color: ['fucsia']}, familias)).toBeNull();
  });

  it('construye el rango de precio', () => {
    expect(buildProductFilters({color: [], precioMin: 100, precioMax: 300}, familias)).toEqual([
      {price: {min: 100, max: 300}},
    ]);
  });

  it('admite un rango de precio abierto por un extremo', () => {
    expect(buildProductFilters({color: [], precioMax: 300}, familias)).toEqual([
      {price: {max: 300}},
    ]);
    expect(buildProductFilters({color: [], precioMin: 100}, familias)).toEqual([
      {price: {min: 100}},
    ]);
  });

  it('añade disponibilidad', () => {
    expect(buildProductFilters({color: [], soloDisponibles: true}, familias)).toEqual([
      {available: true},
    ]);
  });

  it('añade material y técnica como metafields de producto', () => {
    const f = buildProductFilters({color: [], material: ['TEXTIL'], tecnica: ['BORDADO']}, familias);
    expect(f).toContainEqual({
      productMetafield: {namespace: 'custom', key: 'material', value: 'TEXTIL'},
    });
    expect(f).toContainEqual({
      productMetafield: {namespace: 'custom', key: 'tecnicas_de_impresion', value: 'BORDADO'},
    });
  });

  it('añade talla como opción de variante', () => {
    expect(buildProductFilters({color: [], talla: ['M']}, familias)).toEqual([
      {variantOption: {name: 'talla', value: 'M'}},
    ]);
  });

  it('combina color y precio — tipos distintos se cruzan con Y', () => {
    const f = buildProductFilters({color: ['verde'], precioMax: 300}, familias);
    expect(f).toHaveLength(3); // 2 tonos de verde (O) + 1 precio (Y)
    expect(f).toContainEqual({price: {max: 300}});
  });
});

describe('buildProductFilters · colorObligatorio', () => {
  const FAMILIAS = [{family: 'rojo', values: ['ROJO', 'VINO']}];

  it('sin la opción, una familia sin tonos simplemente no filtra', () => {
    expect(buildProductFilters({color: ['morado']}, FAMILIAS)).toBeNull();
  });

  /* Un cliente con paleta no puede caer en "no filtro nada": eso le enseñaría
     el catálogo entero, que es justo lo contrario de lo que se le prometió. */
  it('con la opción, una familia sin tonos devuelve un filtro imposible', () => {
    const out = buildProductFilters({color: ['morado']}, FAMILIAS, {colorObligatorio: true});
    expect(out).toEqual([{variantOption: {name: 'color', value: 'GI-SIN-COINCIDENCIA'}}]);
  });

  it('con la opción y tonos disponibles, filtra normal', () => {
    const out = buildProductFilters({color: ['rojo']}, FAMILIAS, {colorObligatorio: true});
    expect(out).toEqual([
      {variantOption: {name: 'color', value: 'ROJO'}},
      {variantOption: {name: 'color', value: 'VINO'}},
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * Interacción                                                         *
 * ------------------------------------------------------------------ */

describe('toggleMulti', () => {
  it('añade un valor ausente', () => {
    expect(toggleMulti(['verde'], 'azul')).toEqual(['verde', 'azul']);
  });
  it('quita un valor presente', () => {
    expect(toggleMulti(['verde', 'azul'], 'verde')).toEqual(['azul']);
  });
  it('parte de una lista vacía', () => {
    expect(toggleMulti([], 'verde')).toEqual(['verde']);
  });
});

describe('activeChips', () => {
  it('describe cada filtro aplicado', () => {
    const chips = activeChips(
      {q: 'mochila', cat: 'oficina', color: ['verde'], precioMax: 300, soloDisponibles: true},
      {categorias: [{handle: 'oficina', name: 'Oficina'}]},
    );
    const claves = chips.map((c) => c.key);
    expect(claves).toContain('q');
    expect(claves).toContain('cat');
    expect(claves).toContain('color:verde');
    expect(claves).toContain('precio');
    expect(claves).toContain('disp');
  });

  it('usa el nombre legible de la categoría', () => {
    const chips = activeChips({cat: 'oficina', color: []}, {categorias: [{handle: 'oficina', name: 'Oficina'}]});
    expect(chips.find((c) => c.key === 'cat').label).toBe('Oficina');
  });

  it('no devuelve nada sin filtros', () => {
    expect(activeChips({color: []}, {categorias: []})).toEqual([]);
  });

  it('describe el rango de precio según qué extremos haya', () => {
    const soloMax = activeChips({color: [], precioMax: 300}, {categorias: []});
    expect(soloMax[0].label).toBe('Hasta $300');
    const soloMin = activeChips({color: [], precioMin: 100}, {categorias: []});
    expect(soloMin[0].label).toBe('Desde $100');
    const ambos = activeChips({color: [], precioMin: 100, precioMax: 300}, {categorias: []});
    expect(ambos[0].label).toBe('$100 – $300');
  });
});

describe('SORTS', () => {
  it('sólo expone lo que admite el buscador de Shopify', () => {
    // SearchSortKeys no tiene equivalente de BEST_SELLING ni CREATED_AT: si
    // alguien añade "más vendidos" aquí, la consulta fallaría en runtime.
    for (const def of Object.values(SORTS)) {
      expect(['RELEVANCE', 'PRICE']).toContain(def.sortKey);
    }
  });
});

describe('COLOR_FAMILIES', () => {
  it('no repite palabras clave entre familias', () => {
    // Una palabra en dos familias haría la clasificación dependiente del
    // orden de la tabla, que es justo lo que no queremos.
    const vistas = new Set();
    for (const fam of COLOR_FAMILIES) {
      for (const kw of fam.keywords) {
        expect(vistas.has(kw)).toBe(false);
        vistas.add(kw);
      }
    }
  });

  it('toda familia declara id, etiqueta y palabras clave', () => {
    for (const fam of COLOR_FAMILIES) {
      expect(fam.id).toBeTruthy();
      expect(fam.label).toBeTruthy();
      expect(fam.keywords.length).toBeGreaterThan(0);
    }
  });

  it('cada familia se reconoce a sí misma por su etiqueta', () => {
    for (const fam of COLOR_FAMILIES) {
      expect(colorFamilyOf(fam.label)).toBe(fam.id);
    }
  });
});

describe('resolveCatalogSource', () => {
  it('usa la colección cuando hay categoría y no hay texto', () => {
    expect(resolveCatalogSource({cat: 'bebidas', q: ''})).toEqual({
      modo: 'coleccion',
      handle: 'bebidas',
      clave: 'cat',
    });
  });

  it('vuelve a la búsqueda cuando hay texto, aunque haya categoría', () => {
    // La colección no acepta texto libre: uno de los dos tiene que ceder.
    expect(resolveCatalogSource({cat: 'bebidas', q: 'termo'})).toEqual({modo: 'busqueda'});
  });

  it('usa la búsqueda cuando no hay categoría', () => {
    expect(resolveCatalogSource({cat: '', q: ''})).toEqual({modo: 'busqueda'});
    expect(resolveCatalogSource({cat: '', q: 'termo'})).toEqual({modo: 'busqueda'});
  });
});

describe('appliedFilters', () => {
  it('quita la categoría de los chips cuando no se está aplicando', () => {
    // La pantalla nunca debe prometer un filtro que la consulta no aplica.
    const f = {cat: 'bebidas', q: 'termo', color: []};
    expect(appliedFilters(f).cat).toBe('');
  });

  it('conserva la categoría cuando sí se aplica', () => {
    const f = {cat: 'bebidas', q: '', color: []};
    expect(appliedFilters(f).cat).toBe('bebidas');
  });

  it('no toca el resto del estado', () => {
    const f = {cat: 'bebidas', q: 'termo', material: ['PLÁSTICO'], precioMin: 10};
    const out = appliedFilters(f);
    expect(out.material).toEqual(['PLÁSTICO']);
    expect(out.precioMin).toBe(10);
    expect(out.q).toBe('termo');
  });
});

describe('una sola colección a la vez', () => {
  it('Novedades y Ofertas se resuelven por colección', () => {
    expect(resolveCatalogSource({nuevos: true})).toEqual({
      modo: 'coleccion',
      handle: 'nuevos',
      clave: 'nuevos',
    });
    expect(resolveCatalogSource({ofertas: true})).toEqual({
      modo: 'coleccion',
      handle: 'ofertas',
      clave: 'ofertas',
    });
  });

  it('la categoría gana sobre los accesos rápidos', () => {
    // Sólo cabe una colección por consulta: manda la intención más concreta.
    expect(resolveCatalogSource({cat: 'bebidas', nuevos: true, ofertas: true})).toEqual({
      modo: 'coleccion',
      handle: 'bebidas',
      clave: 'cat',
    });
  });

  it('Novedades gana sobre Ofertas cuando se piden las dos', () => {
    expect(resolveCatalogSource({nuevos: true, ofertas: true}).handle).toBe('nuevos');
  });

  it('con texto libre no se aplica ninguna colección', () => {
    expect(resolveCatalogSource({q: 'termo', cat: 'bebidas', nuevos: true})).toEqual({
      modo: 'busqueda',
    });
  });

  it('los chips borran lo que se pidió y no cupo', () => {
    const out = appliedFilters({cat: 'bebidas', nuevos: true, ofertas: true, q: ''});
    expect(out.cat).toBe('bebidas');
    expect(out.nuevos).toBe(false);
    expect(out.ofertas).toBe(false);
  });

  it('con texto libre se borran las tres', () => {
    const out = appliedFilters({cat: 'bebidas', nuevos: true, ofertas: true, q: 'termo'});
    expect(out.cat).toBe('');
    expect(out.nuevos).toBe(false);
    expect(out.ofertas).toBe(false);
    expect(out.q).toBe('termo');
  });

  it('conserva Ofertas cuando es lo único pedido', () => {
    const out = appliedFilters({cat: '', nuevos: false, ofertas: true, q: ''});
    expect(out.ofertas).toBe(true);
  });
});
