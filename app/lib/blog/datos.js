/* Fotografía del catálogo en línea de Generando Ideas, tomada de la tienda
 * (Shopify, productos activos) el 26 de noviembre de 2026. Es lo que hace
 * citables a los artículos del blog: son datos que sólo tiene la empresa.
 *
 * CÓMO SE CONTÓ
 * - tecnicas: productos cuyo metacampo custom.tecnicas_de_impresion incluye
 *   la técnica. Un producto puede admitir varias. "Impresión a todo color" es
 *   la etiqueta FULL COLOR del catálogo.
 * - categorias: productos activos de cada una de las ocho colecciones del
 *   menú. Un producto puede estar en más de una.
 * - tipos: productos cuyo nombre empieza con esa palabra (TERMO, LIBRETA…).
 * - ecologicos.materiales: productos de la categoría Ecológicos cuya ficha
 *   (nombre o descripción) menciona el material. Una ficha puede mencionar
 *   varios.
 *
 * Los números envejecen: al actualizarlos, cambiar también `fecha`. Los
 * artículos dicen siempre de qué fecha son.
 */
export const CATALOGO = {
  fecha: '2026-11-26',
  fechaTexto: '26 de noviembre de 2026',
  activos: 7485,
  conTecnica: 7330,
  sinTecnica: 155,
  /** Productos que admiten dos o más técnicas. */
  variasTecnicas: 3744,
  tecnicas: [
    {nombre: 'Serigrafía', productos: 6716},
    {nombre: 'Grabado láser', productos: 2535},
    {nombre: 'Impresión a todo color', productos: 2233},
    {nombre: 'Bordado', productos: 511},
    {nombre: 'Sublimación', productos: 229},
    {nombre: 'Gota de resina', productos: 86},
  ],
  categorias: [
    {handle: 'oficina', nombre: 'Oficina', productos: 1692},
    {handle: 'textil', nombre: 'Textil', productos: 1531},
    {handle: 'hogar', nombre: 'Hogar', productos: 1249},
    {handle: 'bebidas', nombre: 'Bebidas', productos: 1238},
    {handle: 'tiempo-libre', nombre: 'Tiempo libre', productos: 923},
    {handle: 'tecnologia', nombre: 'Tecnología', productos: 753},
    {handle: 'ecologicos', nombre: 'Ecológicos', productos: 684},
    {handle: 'salud-y-belleza', nombre: 'Salud y belleza', productos: 467},
  ],
  /** Porcentaje de los productos de la categoría que admite la técnica. */
  porCategoria: {
    laserEnBebidas: 54,
    laserEnOficina: 45,
    bordadoEnTextil: 29,
  },
  tipos: {
    boligrafos: 743,
    sets: 563,
    termos: 477,
    mochilas: 400,
    bolsas: 399,
    libretas: 352,
    cilindros: 215,
    tazas: 198,
    vasos: 179,
    bocinas: 124,
    audifonos: 97,
    gorras: 81,
  },
  ecologicos: {
    total: 684,
    tipos: [
      {nombre: 'Bolsas', productos: 150},
      {nombre: 'Libretas', productos: 135},
      {nombre: 'Bolígrafos', productos: 82},
      {nombre: 'Sets', productos: 63},
      {nombre: 'Botellas', productos: 40},
    ],
    materiales: [
      {nombre: 'Papel, cartón o kraft', productos: 208, uso: 'Libretas, blocks, bolsas y empaques'},
      {nombre: 'Algodón', productos: 78, uso: 'Bolsas, morrales y estuches'},
      {nombre: 'Bambú', productos: 77, uso: 'Libretas, bolígrafos, USB y tapas de termos'},
      {nombre: 'Yute', productos: 59, uso: 'Bolsas y portadocumentos'},
      {nombre: 'Fibra de trigo', productos: 40, uso: 'Bolígrafos, vasos y contenedores'},
      {nombre: 'Tela no tejida (non woven)', productos: 32, uso: 'Bolsas reutilizables'},
      {nombre: 'PET reciclado (rPET)', productos: 24, uso: 'Bolsas, mochilas y bolígrafos'},
      {nombre: 'Corcho', productos: 22, uso: 'Libretas, portavasos y llaveros'},
    ],
    /** Porcentaje de los productos ecológicos que admite cada técnica. */
    tecnicas: {serigrafia: 95, todoColor: 39, laser: 29, bordado: 12},
  },
};
