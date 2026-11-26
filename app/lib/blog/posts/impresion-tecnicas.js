import {CATALOGO} from '../datos.js';
import {SERVICE_DETAILS} from '../../site-content.js';

const miles = (n) => n.toLocaleString('en-US');
const parte = (n) => `${Math.round((n / CATALOGO.activos) * 100)}%`;
const de = (nombre) => CATALOGO.tecnicas.find((t) => t.nombre === nombre).productos;
const PRINT_SHOP = SERVICE_DETAILS['print-shop'].blocks.find((b) => b.table).table;

export default {
  id: 'impresion-tecnicas',
  cat: 'Técnicas',
  title: 'Serigrafía, sublimación o DTF: ¿qué técnica conviene para tu promocional?',
  excerpt:
    'Serigrafía, sublimación, DTF, grabado láser y bordado: cuándo conviene cada técnica y cuántos productos del catálogo la admiten.',
  img: '/servicios/print-shop.jpg',
  imgAlt: 'Persona preparando tintas en un taller de serigrafía',
  iso: '2026-11-26',
  answer:
    'La serigrafía conviene para logotipos de pocas tintas en tirajes medianos y grandes; la sublimación, para diseños a todo color sobre poliéster claro o piezas con recubrimiento; y el DTF, para diseños a todo color en textiles de cualquier color y en tirajes cortos. El material del producto es lo que más limita la elección.',
  takeaways: [
    'La técnica se elige por tres cosas: el material del producto, los colores del logotipo y la cantidad de piezas.',
    `En el catálogo de Generando Ideas, ${miles(de('Serigrafía'))} de ${miles(CATALOGO.activos)} productos (${parte(de('Serigrafía'))}) admiten serigrafía: es la técnica más disponible.`,
    `El grabado láser está disponible en ${miles(de('Grabado láser'))} productos (${parte(de('Grabado láser'))}) y no usa tinta: marca el material de forma permanente.`,
    `${miles(CATALOGO.variasTecnicas)} productos, la mitad del catálogo, admiten dos o más técnicas.`,
  ],
  sections: [
    {
      h: '¿En qué se diferencian la serigrafía, la sublimación y el DTF?',
      blocks: [
        {
          p: 'La serigrafía aplica tinta a través de una malla, un color a la vez. La sublimación convierte la tinta en gas con calor y la fija dentro del material. El DTF imprime el diseño en una película que después se transfiere con calor a la prenda. Las tres dan resultados distintos en color, tacto y durabilidad.',
        },
        {
          table: {
            cols: ['Técnica', 'Cómo funciona', 'Conviene cuando', 'Su límite'],
            rows: [
              [
                'Serigrafía',
                'La tinta pasa por una malla, un color a la vez',
                'Logotipos de una a tres tintas planas en tirajes medianos y grandes',
                'Cada color suma un paso; no reproduce fotografías ni degradados',
              ],
              [
                'Sublimación',
                'El calor convierte la tinta en gas y la fija dentro del material',
                'Diseños a todo color en poliéster claro, cerámica o acero con recubrimiento',
                'No funciona sobre algodón ni sobre fondos oscuros',
              ],
              [
                'DTF (directo a película)',
                'El diseño se imprime en una película y se transfiere con calor',
                'Diseños a todo color en textiles de cualquier color y en tirajes cortos',
                'Es un transfer: queda sobre la tela, no dentro de ella',
              ],
            ],
          },
        },
      ],
    },
    {
      h: '¿Qué otras técnicas de decorado existen?',
      blocks: [
        {
          p: 'Además de esas tres, Generando Ideas trabaja con tampografía, grabado láser, bordado, impresión UV plana a todo color, impresión 360° a todo color, parche sublimado, vinil imprimible y gota de resina. Cada una resuelve un caso distinto: superficies curvas, metal, textil grueso o piezas que se decoran en todo su contorno.',
        },
        {
          table: {
            cols: ['Técnica', 'Ideal para'],
            rows: [
              ...PRINT_SHOP.rows.filter(([nombre]) => nombre !== 'Serigrafía'),
              ['Impresión UV plana a todo color', 'Superficies planas de plástico, madera, metal o textil'],
              ['Impresión 360° a todo color', 'Piezas que se decoran en todo su contorno'],
              ['Vinil imprimible y DTF', 'Diseños a todo color sobre textil, plástico, madera o metal'],
              ['Parche sublimado', 'Textiles: el diseño va en un parche que se aplica a la prenda'],
              ['Gota de resina', 'Etiquetas con relieve sobre plástico o metal'],
            ],
          },
        },
      ],
    },
    {
      h: '¿Qué técnicas admiten más productos del catálogo?',
      blocks: [
        {
          p: `La serigrafía es la más disponible: la admiten ${miles(de('Serigrafía'))} de los ${miles(CATALOGO.activos)} productos activos del catálogo de Generando Ideas, el ${parte(de('Serigrafía'))}. Le siguen el grabado láser, con ${miles(de('Grabado láser'))} productos, y la impresión a todo color, con ${miles(de('Impresión a todo color'))}. El bordado, la sublimación y la gota de resina aplican a líneas más específicas.`,
        },
        {
          table: {
            cols: ['Técnica', 'Productos que la admiten', 'Parte del catálogo'],
            rows: CATALOGO.tecnicas.map((t) => [t.nombre, miles(t.productos), parte(t.productos)]),
          },
        },
        {
          p: `El grabado láser pesa más en Bebidas (${CATALOGO.porCategoria.laserEnBebidas}% de sus productos) y en Oficina (${CATALOGO.porCategoria.laserEnOficina}%); el bordado, en Textil (${CATALOGO.porCategoria.bordadoEnTextil}%). Además, ${miles(CATALOGO.variasTecnicas)} productos admiten dos o más técnicas, así que casi siempre hay una alternativa si la primera opción no se ajusta al diseño.`,
        },
        {
          p: `Datos del catálogo en línea al ${CATALOGO.fechaTexto}. Un producto puede admitir varias técnicas, por eso los porcentajes no suman 100. «Impresión a todo color» es la etiqueta que el catálogo usa para los decorados digitales; el proceso exacto (UV plana, 360° o DTF) se define con el asesor según la pieza.`,
        },
      ],
    },
    {
      h: '¿Qué técnica conviene para cada tipo de producto?',
      blocks: [
        {
          p: 'Para plumas, termos, llaveros y superficies irregulares conviene la tampografía; para playeras, bolsas, libretas y textiles, la serigrafía; para termos metálicos, madera, aluminio y regalos ejecutivos, el grabado láser; y para gorras, camisas, chamarras y mochilas, el bordado. Es la guía que usa el Print Shop de Generando Ideas.',
        },
        {table: PRINT_SHOP},
      ],
    },
    {
      h: '¿Cómo elegir la técnica correcta para un pedido?',
      blocks: [
        {
          p: 'Empieza por el material del producto, porque define qué técnicas son posibles. Después cuenta los colores de tu logotipo: pocas tintas planas apuntan a serigrafía; fotografías o degradados, a una técnica a todo color. Por último, considera la cantidad de piezas y el uso que tendrá el artículo.',
        },
        {
          ol: [
            'Revisa el material: el metal y la madera admiten grabado láser; los textiles, serigrafía, bordado o DTF; la cerámica, sublimación.',
            'Cuenta los colores del logotipo: de una a tres tintas planas, serigrafía; a todo color, sublimación, DTF o impresión UV.',
            'Considera la cantidad: en tirajes cortos suele convenir una técnica digital; en tirajes grandes, la serigrafía.',
            'Piensa en el uso: para piezas de lavado frecuente o trato rudo, el bordado y el grabado láser son los más duraderos.',
            'Aprueba el virtual: en Generando Ideas toda aprobación se hace con una vista digital del producto con tu logotipo antes de producir.',
          ],
        },
        {
          p: 'En el cotizador en línea de Generando Ideas cada producto muestra sólo las técnicas que admite, y el precio por pieza se recalcula al cambiar la técnica o la cantidad.',
        },
      ],
    },
  ],
  next: [
    {label: 'Ver el catálogo', to: '/catalogo'},
    {label: 'Conocer Print Shop', to: '/servicios/print-shop'},
    {label: 'Preguntas frecuentes', to: '/preguntas-frecuentes'},
  ],
};
