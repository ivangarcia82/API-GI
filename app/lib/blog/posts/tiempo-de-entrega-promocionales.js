import {BRAND, COMPANY_FACTS} from '../../site-content.js';
import {TIEMPO_ENTREGA, VIGENCIA_COTIZACION, CONDICIONES_PAGO} from '../../quotes/notasImportantes.js';
import {DIAS_DE_ANTICIPACION, fechaLarga, sumarDiasHabiles} from '../calendario.js';

const RESPUESTA = COMPANY_FACTS.quoteResponse;
const INICIO = '2027-01-04';

export default {
  id: 'tiempo-de-entrega-promocionales',
  cat: 'Operaciones',
  title: '¿Cuánto tarda un pedido de promocionales personalizados?',
  excerpt:
    'Un pedido de promocionales personalizados se entrega en 15 a 20 días hábiles. Conoce cada etapa, qué lo retrasa y qué hacer si es urgente.',
  img: '/servicios/importaciones.jpg',
  imgAlt: 'Contenedores, camiones de carga y un avión al atardecer en una terminal logística',
  iso: '2026-11-26',
  answer: `Un pedido de promocionales personalizados en Generando Ideas se entrega en ${TIEMPO_ENTREGA}. Antes, la cotización se responde en ${RESPUESTA} y el diseño se aprueba con un virtual. Sumando todo, conviene pedir con un mes de anticipación; si el tiempo no alcanza, existe servicio urgente, que se revisa con tu ejecutivo.`,
  takeaways: [
    `Cotización: respuesta en ${RESPUESTA} para productos de catálogo y en 48 horas hábiles para productos de fabricación.`,
    'Aprobación: siempre con un virtual; la muestra física sólo aplica si se acuerda con tu ejecutivo.',
    `Entrega: ${TIEMPO_ENTREGA}, como dicen las notas de cada cotización.`,
    'Generando Ideas no maneja cantidad mínima de compra: se puede cotizar desde una pieza.',
  ],
  sections: [
    {
      h: '¿Cuáles son las etapas de un pedido y cuánto dura cada una?',
      blocks: [
        {
          p: `Un pedido pasa por tres etapas: cotización, aprobación del arte y entrega. Generando Ideas responde la cotización en ${RESPUESTA}; la aprobación depende de lo que tardes en autorizar tu virtual; y la entrega toma ${TIEMPO_ENTREGA}. En condiciones normales, el proceso completo ocupa poco más de un mes.`,
        },
        {
          table: {
            cols: ['Etapa', 'Qué ocurre', 'Cuánto tarda'],
            rows: [
              [
                'Cotización',
                'Envías tu lista desde el cotizador en línea y un asesor la responde',
                `${RESPUESTA}; 48 horas hábiles en productos de fabricación`,
              ],
              [
                'Aprobación del arte',
                'Recibes un virtual, una vista digital del producto con tu logotipo, y lo autorizas',
                'Lo que tardes en autorizarlo',
              ],
              ['Entrega', 'El pedido se produce y se entrega', TIEMPO_ENTREGA],
            ],
          },
        },
      ],
    },
    {
      h: '¿Cómo se ve un pedido en el calendario?',
      blocks: [
        {
          p: `Un ejemplo con fechas reales: si envías tu cotización el ${fechaLarga(INICIO)}, la respuesta llega a más tardar el ${fechaLarga(sumarDiasHabiles(INICIO, DIAS_DE_ANTICIPACION.respuesta))} y, si autorizas tu virtual ese mismo día, la entrega cae a más tardar el ${fechaLarga(sumarDiasHabiles(INICIO, DIAS_DE_ANTICIPACION.total))}. Son ${DIAS_DE_ANTICIPACION.total} días hábiles con los plazos máximos.`,
        },
        {
          p: 'La cuenta usa sólo días hábiles: de lunes a viernes, sin los descansos obligatorios. El horario de atención de Generando Ideas es de lunes a viernes, de 8:30 a 18:00 horas.',
        },
      ],
    },
    {
      h: '¿Qué puede retrasar un pedido?',
      blocks: [
        {
          p: 'Lo que más retrasa un pedido es la aprobación del arte: en Generando Ideas toda aprobación se hace con un virtual, y sin esa autorización el pedido no avanza. También influyen los cambios al diseño después de aprobarlo y no tener el logotipo listo. Tener el archivo a la mano desde la cotización ahorra días.',
        },
        {
          ul: [
            'Tardar en autorizar el virtual.',
            'Pedir cambios al diseño cuando ya estaba aprobado.',
            'No tener el logotipo en un archivo de buena calidad.',
            'Cotizar productos de fabricación, cuya respuesta toma 48 horas hábiles.',
          ],
        },
      ],
    },
    {
      h: '¿Qué hago si necesito mi pedido antes?',
      blocks: [
        {
          p: `Si necesitas tu pedido antes de ${TIEMPO_ENTREGA}, Generando Ideas tiene servicio urgente, que se atiende directamente con tu ejecutivo. Para ganar tiempo, elige productos de catálogo, que se cotizan más rápido que los de fabricación, y autoriza tu virtual el mismo día en que lo recibas.`,
        },
        {
          p: `Puedes hablar con un asesor al ${BRAND.phone} o escribir a ${BRAND.email}.`,
        },
      ],
    },
    {
      h: '¿Hay cantidad mínima o costo de envío?',
      blocks: [
        {
          p: `Generando Ideas no maneja cantidad mínima de compra: se puede cotizar desde una sola pieza. El precio incluye la entrega en la Ciudad de México sin costo, en un solo punto; los envíos al resto de la República Mexicana se cobran aparte. La cotización tiene una vigencia de ${VIGENCIA_COTIZACION} y las condiciones de pago son de ${CONDICIONES_PAGO.toLowerCase()}.`,
        },
      ],
    },
  ],
  next: [
    {label: 'Ver el catálogo', to: '/catalogo'},
    {label: 'Calendario de temporadas 2027', to: '/blog/calendario-promocionales-2027'},
    {label: 'Hablar con un asesor', to: '/contacto'},
  ],
};
