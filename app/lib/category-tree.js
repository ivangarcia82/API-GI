/* Generando Ideas — árbol de categorías del catálogo (3 niveles).
 *
 * Aprobado el 2026-10-05, con 4promotional.net como referencia
 * (línea → sublínea → tipo). Es la única fuente del árbol: de aquí salen las
 * colecciones de Shopify (scripts/crear-colecciones-arbol.mjs), la lista de
 * etiquetas para la sincronización con proveedores
 * (docs/catalogo/arbol-de-categorias.md) y el menú del sitio.
 *
 * Cada nodo es una colección automática de Shopify:
 *   - `handle`: la colección. Muchas ya existían (las de niveles 1 y 2).
 *   - `tags`: la colección incluye un producto si tiene CUALQUIERA de estas
 *     etiquetas. Casi siempre es una sola; las ramas que agrupan colecciones
 *     existentes (Bolígrafos, Salud y belleza…) listan varias.
 *   - `match` (sólo nivel 3): palabras del título que deciden la etiqueta del
 *     tipo. Dentro de una subcategoría se prueba en orden y gana la primera
 *     regla que coincide; el producto que no coincide con ninguna se queda
 *     sólo en la subcategoría ("Ver todo").
 *   - `fromTag` (sólo nivel 3): el tipo ya existe como etiqueta del
 *     proveedor; no hace falta regla de título.
 *
 * Las reglas de `match` se comparan contra el título en mayúsculas y sin
 * acentos ("Taza de cerámica" → "TAZA DE CERAMICA").
 */

/**
 * @typedef {object} CategoryNode
 * @property {string} title
 * @property {string} handle
 * @property {string[]} tags
 * @property {string} [match] expresión regular (fuente) sobre el título normalizado
 * @property {string} [fromTag]
 * @property {CategoryNode[]} [children]
 */

/** @type {CategoryNode[]} */
export const CATEGORY_TREE = [
  {
    title: 'Bebidas',
    handle: 'bebidas',
    tags: ['bebidas'],
    children: [
      {
        title: 'Termos',
        handle: 'termos',
        tags: ['termos'],
        children: [
          {title: 'Mugs de viaje', handle: 'mugs-de-viaje', tags: ['mugs de viaje'], match: '\\bMUG\\b'},
          {title: 'Botellas térmicas', handle: 'botellas-termicas', tags: ['botellas termicas'], match: 'BOTELLA'},
          {title: 'Termos de acero', handle: 'termos-de-acero', tags: ['termos de acero'], match: 'ACERO|INOX|TERMO|TMPS'},
        ],
      },
      {
        title: 'Tazas y tarros',
        handle: 'tazas',
        tags: ['tazas'],
        children: [
          {title: 'Tarros', handle: 'tarros', tags: ['tarros'], match: 'TARRO|CERVECERO'},
          {title: 'Tazas para sublimar', handle: 'tazas-para-sublimar', tags: ['tazas para sublimar'], match: 'SUBLIM|SULIM|\\bSUB\\b|MAGICA'},
          {title: 'Tazas de cerámica', handle: 'tazas-de-ceramica', tags: ['tazas de ceramica'], match: 'TAZA|\\bTAZ\\b'},
        ],
      },
      {
        title: 'Vasos',
        handle: 'vasos',
        tags: ['vasos'],
        children: [
          {title: 'Vasos térmicos', handle: 'vasos-termicos', tags: ['vasos termicos'], match: 'TMPS|DOBLE PARED|TERMIC|ACERO|ALUMINIO'},
          {title: 'Vasos de plástico', handle: 'vasos-de-plastico', tags: ['vasos de plastico'], match: 'VASO|TARRO'},
        ],
      },
      {
        title: 'Cilindros y botellas',
        handle: 'cilindros-y-botellas',
        tags: ['cilindros de plastico', 'cilindros de metal y vidrio'],
        children: [
          {title: 'Cilindros de plástico', handle: 'cilindros-de-plastico', tags: ['cilindros de plastico'], fromTag: 'cilindros de plastico'},
          {title: 'Cilindros de metal y vidrio', handle: 'cilindros-de-metal-y-vidrio', tags: ['cilindros de metal y vidrio'], fromTag: 'cilindros de metal y vidrio'},
        ],
      },
    ],
  },
  {
    title: 'Oficina',
    handle: 'oficina',
    tags: ['oficina'],
    children: [
      {
        title: 'Bolígrafos',
        handle: 'boligrafos',
        tags: ['boligrafos de plastico', 'boligrafos de metal', 'boligrafos ecologicos', 'boligrafos multifuncionales'],
        children: [
          {title: 'Bolígrafos multifuncionales', handle: 'boligrafos-multifuncionales', tags: ['boligrafos multifuncionales'], fromTag: 'boligrafos multifuncionales'},
          {title: 'Bolígrafos ecológicos', handle: 'boligrafos-ecologicos', tags: ['boligrafos ecologicos'], fromTag: 'boligrafos ecologicos'},
          {title: 'Bolígrafos metálicos', handle: 'boligrafos-de-metal', tags: ['boligrafos de metal'], fromTag: 'boligrafos de metal'},
          {title: 'Bolígrafos de plástico', handle: 'boligrafos-de-plastico', tags: ['boligrafos de plastico'], fromTag: 'boligrafos de plastico'},
        ],
      },
      {
        title: 'Libretas y agendas',
        handle: 'libretas-y-carpetas',
        tags: ['libretas y carpetas'],
        children: [
          {title: 'Libretas ecológicas', handle: 'libretas-ecologicas', tags: ['libretas ecologicas'], fromTag: 'libretas ecologicas'},
          {title: 'Agendas', handle: 'agendas', tags: ['agendas'], match: 'AGENDA'},
          {title: 'Carpetas', handle: 'carpetas', tags: ['carpetas'], match: 'CARPETA|PADFOLIO'},
          {title: 'Libretas', handle: 'libretas', tags: ['libretas'], match: 'LIBRETA|\\bLIB\\b|BLOCK|NOTAS'},
        ],
      },
      {
        title: 'Accesorios de oficina',
        handle: 'accesorios-de-oficina',
        tags: ['accesorios de oficina'],
        children: [
          {title: 'Relojes', handle: 'relojes', tags: ['relojes'], match: 'RELOJ'},
          {title: 'Calculadoras', handle: 'calculadoras', tags: ['calculadoras'], match: 'CALCULADORA'},
          {title: 'Tarjeteros y portagafetes', handle: 'tarjeteros-y-portagafetes', tags: ['tarjeteros y portagafetes'], match: 'TARJETERO|PORTAGAFETE|GAFETE|CARTERA'},
          {title: 'Notas y blocks', handle: 'notas-y-blocks', tags: ['notas y blocks'], match: 'NOTAS|BLOCK|POST'},
          {title: 'Escritorio y organizadores', handle: 'escritorio-y-organizadores', tags: ['escritorio y organizadores'], match: 'ESCRITORIO|ORGANIZADOR|PORTA|LAMPARA|MOUSE|CAJA|ESTUCHE'},
        ],
      },
      {
        title: 'Escolares y niños',
        handle: 'ninos',
        tags: ['ninos'],
        children: [
          {title: 'Colores y marcadores', handle: 'colores-y-marcadores', tags: ['colores y marcadores'], match: 'MARCADOR|MARCATEXTO|LAPICERA|CRAYON|COLORES|PINTA'},
          {title: 'Alcancías y peluches', handle: 'alcancias-y-peluches', tags: ['alcancias y peluches'], match: 'ALCANCIA|PELUCHE|MUNECO|\\bOSO\\b'},
        ],
      },
    ],
  },
  {
    title: 'Textil',
    handle: 'textil',
    tags: ['textil'],
    children: [
      {
        title: 'Mochilas y maletas',
        handle: 'mochilas-y-maletas',
        tags: ['mochilas y maletas'],
        children: [
          {title: 'Maletas y trolleys', handle: 'maletas-y-trolleys', tags: ['maletas y trolleys'], match: 'MALETA|\\bMAL\\b|TROLLEY|CARRY'},
          {title: 'Mochilas para laptop', handle: 'mochilas-para-laptop', tags: ['mochilas para laptop'], match: 'LAPTOP|EJECUTIV|BUSINESS'},
          {title: 'Mochilas', handle: 'mochilas', tags: ['mochilas'], match: 'MOCHILA|\\bMOC\\b|BACKPACK'},
        ],
      },
      {
        title: 'Bolsas y morrales',
        handle: 'bolsas-y-morrales',
        tags: ['bolsas y morrales'],
        children: [
          {title: 'Bolsas de algodón y yute', handle: 'bolsas-de-algodon-y-yute', tags: ['bolsas de algodon y yute'], match: 'ALGODON|YUTE|MANTA'},
          {title: 'Bolsas non woven y plegables', handle: 'bolsas-non-woven-y-plegables', tags: ['bolsas non woven y plegables'], match: '\\bNON\\b|NONW|PLEGABLE'},
          {title: 'Morrales y bolsos', handle: 'morrales-y-bolsos', tags: ['morrales y bolsos'], match: 'MORRAL|BOLSO|MOCHILA|JARETA'},
          {title: 'Bolsas promocionales', handle: 'bolsas-promocionales', tags: ['bolsas promocionales'], match: 'BOLSA'},
        ],
      },
      {
        title: 'Hieleras y loncheras',
        handle: 'hieleras-y-loncheras',
        tags: ['hieleras y loncheras'],
        children: [
          {title: 'Hieleras', handle: 'hieleras', tags: ['hieleras'], match: 'HIELERA|COOLER'},
          {title: 'Loncheras', handle: 'loncheras', tags: ['loncheras'], match: 'LONCHERA|\\bLON\\b|LUNCH'},
        ],
      },
      {
        title: 'Gorras y cangureras',
        handle: 'gorras-y-cangureras',
        tags: ['gorras y cangureras'],
        children: [
          {title: 'Gorras y sombreros', handle: 'gorras-y-sombreros', tags: ['gorras y sombreros'], match: 'GORRA|\\bCAP\\b|SOMBRERO|\\bHAT\\b|VISERA'},
          {title: 'Cangureras', handle: 'cangureras', tags: ['cangureras'], match: 'CANGURERA|BANDOLERA'},
        ],
      },
      {
        title: 'Ropa',
        handle: 'ropa',
        tags: ['chamarras y chalecos', 'playeras y camisas'],
        children: [
          {title: 'Chamarras y chalecos', handle: 'chamarras-y-chalecos', tags: ['chamarras y chalecos'], fromTag: 'chamarras y chalecos'},
          {title: 'Playeras y camisas', handle: 'playeras-y-camisas', tags: ['playeras y camisas'], fromTag: 'playeras y camisas'},
        ],
      },
      {
        title: 'Paraguas e impermeables',
        handle: 'paraguas-e-impermeables',
        tags: ['paraguas e impermeables'],
        children: [
          {title: 'Impermeables', handle: 'impermeables', tags: ['impermeables'], match: 'IMPERMEABLE'},
          {title: 'Paraguas', handle: 'paraguas', tags: ['paraguas'], match: 'PARAGUAS|\\bPAR\\b'},
        ],
      },
      {title: 'Portafolios y portalaptop', handle: 'portafolios-y-portalaptop', tags: ['portafolios y portalaptop']},
    ],
  },
  {
    title: 'Hogar',
    handle: 'hogar',
    tags: ['hogar'],
    children: [
      {
        title: 'Cocina',
        handle: 'cocina',
        tags: ['cocina'],
        children: [
          {title: 'Bar y vino', handle: 'bar-y-vino', tags: ['bar y vino'], match: '\\bBAR\\b|DESTAPADOR|LICORERA|VINO|SACACORCHO|COCTEL|SHAKER|CERVEZA'},
          {title: 'BBQ y asadores', handle: 'bbq-y-asadores', tags: ['bbq y asadores'], match: 'BBQ|ASADOR|PARRILL'},
          {title: 'Contenedores y lunch', handle: 'contenedores-y-lunch', tags: ['contenedores y lunch'], match: 'CONTENEDOR|LONCHERA|LUNCH|TOPPER'},
          {title: 'Tablas y utensilios', handle: 'tablas-y-utensilios', tags: ['tablas y utensilios'], match: 'TABLA|QUESO|CUBIERTO|UTENSILIO|CUCHILLO|PRENSA|CAFE|\\bTE\\b'},
        ],
      },
      {
        title: 'Accesorios del hogar',
        handle: 'accesorios-del-hogar',
        tags: ['accesorios del hogar'],
        children: [
          {title: 'Decoración', handle: 'decoracion', tags: ['decoracion'], match: 'VELA|PORTARRETRATO|\\bPRT\\b|DECORATIV|LAMPARA|CESTO'},
          {title: 'Mascotas', handle: 'mascotas', tags: ['mascotas'], match: 'MASCOTA|\\bPET\\b|PERRO|GATO'},
          {title: 'Confort', handle: 'confort', tags: ['confort'], match: 'FRAZADA|HUMIDIFICADOR|COBIJA|ALMOHADA'},
        ],
      },
    ],
  },
  {
    title: 'Salud y belleza',
    handle: 'salud-y-belleza',
    tags: ['belleza', 'salud y bienestar'],
    children: [
      {
        title: 'Belleza',
        handle: 'belleza',
        tags: ['belleza'],
        children: [
          {title: 'Cosmetiqueras y neceseres', handle: 'cosmetiqueras-y-neceseres', tags: ['cosmetiqueras y neceseres'], match: 'COSMETIQUERA|NECESER|NECESSAIRE|\\bDAM\\b|ORGANIZADOR'},
          {title: 'Espejos', handle: 'espejos', tags: ['espejos'], match: 'ESPEJO'},
          {title: 'Sets de manicure y maquillaje', handle: 'sets-de-manicure-y-maquillaje', tags: ['sets de manicure y maquillaje'], match: 'MANICURE|MAQUILLAJE|BROCHA|CEPILLO|ESPONJA|APLICADOR'},
        ],
      },
      {
        title: 'Salud y bienestar',
        handle: 'salud-y-bienestar',
        tags: ['salud y bienestar'],
        children: [
          {title: 'Pastilleros', handle: 'pastilleros', tags: ['pastilleros'], match: 'PASTILLERO'},
          {title: 'Cuidado personal', handle: 'cuidado-personal', tags: ['cuidado personal'], match: '\\bGEL\\b|SANITIZANTE|JABON|TOALLA|CEPILLO|DIENTE|CORPORAL|\\bKIT\\b'},
        ],
      },
    ],
  },
  {
    title: 'Tecnología',
    handle: 'tecnologia',
    tags: ['tecnologia'],
    children: [
      {
        title: 'Accesorios de tecnología',
        handle: 'accesorios-de-tecnologia',
        tags: ['accesorios de tecnologia'],
        children: [
          {title: 'Cargadores y cables', handle: 'cargadores-y-cables', tags: ['cargadores y cables'], match: 'CARGADOR|CABLE|CARGA|\\bUSB\\b|\\bCRG\\b'},
          {title: 'Soportes', handle: 'soportes', tags: ['soportes'], match: 'SOPORTE'},
          {title: 'Mouse y hubs', handle: 'mouse-y-hubs', tags: ['mouse y hubs'], match: 'MOUSE|\\bPAD\\b|\\bHUB\\b|CONCENTRADOR|PUERTO'},
        ],
      },
      {
        title: 'Audio',
        handle: 'audifonos-y-bocinas',
        tags: ['audifonos y bocinas'],
        children: [
          {title: 'Bocinas', handle: 'bocinas', tags: ['bocinas'], match: 'BOCINA'},
          {title: 'Audífonos', handle: 'audifonos', tags: ['audifonos'], match: 'AUDIFONO|\\bAUD\\b|AURICULAR|MANOS LIBRES'},
        ],
      },
      {title: 'Power banks', handle: 'power-banks', tags: ['power banks']},
    ],
  },
  {
    title: 'Tiempo libre',
    handle: 'tiempo-libre',
    tags: ['tiempo libre'],
    children: [
      {
        title: 'Llaveros',
        handle: 'llaveros',
        tags: ['llaveros'],
        children: [
          {title: 'Llaveros multifuncionales', handle: 'llaveros-multifuncionales', tags: ['llaveros multifuncionales'], match: 'DESTAPADOR|FLEXOMETRO|LAMPARA|\\bLUZ\\b|MULTI|HERRAMIENTA'},
          {title: 'Llaveros clásicos', handle: 'llaveros-clasicos', tags: ['llaveros clasicos'], match: '.'},
        ],
      },
      {
        title: 'Viaje',
        handle: 'viaje',
        tags: ['viaje'],
        children: [
          {title: 'Organizadores de viaje', handle: 'organizadores-de-viaje', tags: ['organizadores de viaje'], match: 'ORGANIZADOR|NECESER|PASAPORTE|IDENTIFICADOR|CARTERA|\\bKIT\\b|PORTA'},
          {title: 'Accesorios de viaje', handle: 'accesorios-de-viaje', tags: ['accesorios de viaje'], match: 'ALMOHADA|FRAZADA|SILLA|LENTES|BOLSA|BOLSO'},
        ],
      },
      {
        title: 'Herramientas',
        handle: 'herramientas-de-trabajo',
        tags: ['herramientas de trabajo'],
        children: [
          {title: 'Lámparas y linternas', handle: 'lamparas-y-linternas', tags: ['lamparas y linternas'], match: 'LAMPARA|LINTERNA|\\bLED\\b'},
          {title: 'Navajas y multiherramientas', handle: 'navajas-y-multiherramientas', tags: ['navajas y multiherramientas'], match: 'NAVAJA|MULTI'},
          {title: 'Sets de herramientas', handle: 'sets-de-herramientas', tags: ['sets de herramientas'], match: 'HERRAMIENTA|\\bHER\\b|DESARMADOR|FLEX|PINZA|\\bKIT\\b|JUEGO'},
        ],
      },
      {title: 'Antiestrés', handle: 'antiestres', tags: ['antiestres']},
      {
        title: 'Deportes y entretenimiento',
        handle: 'entretenimiento',
        tags: ['entretenimiento'],
        children: [
          {title: 'Juegos de mesa', handle: 'juegos-de-mesa', tags: ['juegos de mesa'], match: 'JUEGO|DOMINO|POKER|TORRE|CARTAS'},
          {title: 'Deporte', handle: 'deporte', tags: ['deporte'], match: 'BALON|PELOTA|\\bSOC\\b|\\bFUT|DEPORT|\\bSPO\\b|TOALLA|BRAZALETE'},
        ],
      },
      {title: 'Accesorios para auto', handle: 'accesorios-para-auto', tags: ['accesorios para auto']},
    ],
  },
  {
    title: 'Ecológicos',
    handle: 'ecologicos',
    tags: ['ecologicos'],
    children: [
      {title: 'Oficina ecológica', handle: 'oficina-ecologica', tags: ['oficina ecologica']},
      {title: 'Bolsas ecológicas', handle: 'bolsas-ecologicas', tags: ['bolsas ecologicas']},
      {title: 'Hogar ecológico', handle: 'hogar-ecologico', tags: ['hogar ecologico']},
      {title: 'Bebidas ecológicas', handle: 'bebidas-ecologicas', tags: ['bebidas ecologicas']},
    ],
  },
];

/** Título del producto en mayúsculas y sin acentos, como lo leen las reglas. */
export function normalizeTitle(title) {
  return String(title ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

/**
 * Etiqueta de tipo (nivel 3) que le toca a un producto dentro de una
 * subcategoría, o null si ninguna regla coincide.
 * @param {CategoryNode} sub subcategoría (nivel 2)
 * @param {{title: string, tags: string[]}} product
 * @returns {string|null}
 */
export function typeTagFor(sub, product) {
  const titulo = normalizeTitle(product.title);
  for (const tipo of sub.children ?? []) {
    if (tipo.fromTag ? product.tags.includes(tipo.fromTag) : new RegExp(tipo.match).test(titulo)) {
      return tipo.tags[0];
    }
  }
  return null;
}

/** Todos los nodos, en orden, con su nivel (1, 2 o 3). */
export function flattenTree(tree = CATEGORY_TREE) {
  const out = [];
  const walk = (nodes, level, parent) => {
    for (const n of nodes) {
      out.push({...n, level, parent: parent?.handle ?? null});
      if (n.children) walk(n.children, level + 1, n);
    }
  };
  walk(tree, 1, null);
  return out;
}
