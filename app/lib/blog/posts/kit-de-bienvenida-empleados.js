import {CATALOGO} from '../datos.js';
import {COMPANY_FACTS, SERVICE_DETAILS} from '../../site-content.js';
import {TIEMPO_ENTREGA} from '../../quotes/notasImportantes.js';

const miles = (n) => n.toLocaleString('en-US');
/* "Más de N": la decena inferior, para que la frase siga siendo cierta aunque
   el catálogo se mueva unas piezas. */
const masDe = (n) => miles(Math.floor((n - 1) / 10) * 10);
const T = CATALOGO.tipos;
const TEXTIL = CATALOGO.categorias.find((c) => c.handle === 'textil').productos;
const PRINT_SHOP = SERVICE_DETAILS['print-shop'].blocks.find((b) => b.table).table;
const RESPUESTA = COMPANY_FACTS.quoteResponse;

export default {
  id: 'kit-de-bienvenida-empleados',
  cat: 'Estrategia',
  title: 'Kit de bienvenida para empleados: ¿qué incluir?',
  excerpt:
    'Qué artículos lleva un kit de bienvenida para empleados, cómo personalizarlo y con cuánto tiempo pedirlo, con opciones reales de catálogo.',
  img: '/servicios/promocionales.jpg',
  imgAlt: 'Artículos promocionales acomodados sobre una mesa: prenda, gorra y mochila',
  iso: '2026-11-26',
  answer:
    'Un kit de bienvenida para empleados suele llevar de cuatro a seis artículos útiles con la marca de la empresa: algo para beber, como un termo o una taza; algo para escribir, como libreta y bolígrafo; algo para cargar, como una mochila; y un detalle de tecnología o textil. Lo importante es que se use a diario.',
  takeaways: [
    'Arma el kit por usos: beber, escribir, cargar y un detalle de tecnología o textil.',
    `El catálogo de Generando Ideas tiene más de ${masDe(T.termos)} termos, más de ${masDe(T.libretas)} libretas, más de ${masDe(T.boligrafos)} bolígrafos y más de ${masDe(T.mochilas)} mochilas.`,
    'Generando Ideas no maneja cantidad mínima: puedes pedir kits conforme contratas.',
    `Pide con un mes de anticipación: la entrega toma ${TIEMPO_ENTREGA}.`,
  ],
  sections: [
    {
      h: '¿Qué artículos lleva un kit de bienvenida?',
      blocks: [
        {
          p: 'Un kit de bienvenida se arma por usos, no por productos: una pieza para beber, una para escribir, una para cargar y un detalle que sorprenda. Así se evita regalar cinco cosas que hacen lo mismo. En el catálogo de Generando Ideas hay opciones de sobra en cada uso, además de sets ya armados.',
        },
        {
          table: {
            cols: ['Uso', 'Artículos típicos', 'Opciones en el catálogo'],
            rows: [
              [
                'Beber',
                'Termo, cilindro, taza o vaso',
                `Más de ${masDe(T.termos)} termos, ${masDe(T.cilindros)} cilindros, ${masDe(T.tazas)} tazas y ${masDe(T.vasos)} vasos`,
              ],
              ['Escribir', 'Libreta y bolígrafo', `Más de ${masDe(T.libretas)} libretas y ${masDe(T.boligrafos)} bolígrafos`],
              ['Cargar', 'Mochila o bolsa', `Más de ${masDe(T.mochilas)} mochilas y ${masDe(T.bolsas)} bolsas`],
              ['Tecnología', 'Bocina o audífonos', `Más de ${masDe(T.bocinas)} bocinas y ${masDe(T.audifonos)} audífonos`],
              ['Vestir', 'Gorra o prenda', `Más de ${masDe(T.gorras)} gorras, dentro de ${miles(TEXTIL)} productos textiles`],
              ['Todo en uno', 'Set', `Más de ${masDe(T.sets)} sets`],
            ],
          },
        },
        {
          p: `Conteos del catálogo en línea al ${CATALOGO.fechaTexto}.`,
        },
      ],
    },
    {
      h: '¿Cómo elegir el kit según el tipo de puesto?',
      blocks: [
        {
          p: 'El kit cambia con el lugar donde trabaja la persona. Para oficina funcionan la libreta, el bolígrafo y la taza; para trabajo en campo, el termo, la gorra y la mochila; y para puestos remotos conviene un kit compacto que viaje bien, porque Generando Ideas envía a toda la República Mexicana con cargo aparte.',
        },
        {
          table: {
            cols: ['Tipo de puesto', 'Kit sugerido'],
            rows: [
              ['Oficina', 'Libreta, bolígrafo, taza y mochila'],
              ['Campo o ventas', 'Termo, gorra, mochila y bolígrafo'],
              ['Remoto', 'Termo, libreta, bolígrafo y audífonos'],
            ],
          },
        },
      ],
    },
    {
      h: '¿Cómo se personaliza cada artículo del kit?',
      blocks: [
        {
          p: 'Cada artículo se decora con la técnica que mejor va con su material. Según la guía del Print Shop de Generando Ideas, los termos metálicos llevan grabado láser; las libretas y las bolsas, serigrafía; las mochilas y las gorras, bordado; y las plumas, tampografía. Usar el mismo logotipo en todos da unidad al kit.',
        },
        {table: PRINT_SHOP},
      ],
    },
    {
      h: '¿Cuántos kits hay que pedir y con cuánto tiempo?',
      blocks: [
        {
          p: `Generando Ideas no maneja cantidad mínima de compra, así que puedes pedir los kits conforme contratas en lugar de almacenar de más. La entrega toma ${TIEMPO_ENTREGA}, por lo que conviene pedir con un mes de anticipación a la fecha de ingreso y autorizar el virtual en cuanto lo recibas.`,
        },
      ],
    },
    {
      h: '¿Cómo cotizar un kit de bienvenida en línea?',
      blocks: [
        {
          p: `En el cotizador en línea de Generando Ideas puedes reunir todos los artículos del kit en una sola lista de cotización, cada uno con su color, su técnica de decorado y su cantidad. Al enviarla, un asesor responde en un plazo de ${RESPUESTA}, y la cotización se puede descargar en PDF.`,
        },
        {
          ol: [
            'Abre el catálogo y elige el primer artículo del kit.',
            'Selecciona el color, la técnica de decorado y la cantidad.',
            'Agrégalo a tu lista de cotización y repite con los demás artículos.',
            'Crea tu cuenta gratuita o inicia sesión y envía la solicitud.',
          ],
        },
      ],
    },
  ],
  next: [
    {label: 'Ver el catálogo', to: '/catalogo'},
    {label: 'Buscar sets', to: '/catalogo?q=set'},
    {label: 'Preguntas frecuentes', to: '/preguntas-frecuentes'},
  ],
};
