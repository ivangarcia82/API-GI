import {COMPANY_FACTS} from '../../site-content.js';
import {TIEMPO_ENTREGA} from '../../quotes/notasImportantes.js';
import {
  DIAS_DE_ANTICIPACION,
  TEMPORADAS_2027,
  descansosDe,
  fechaLarga,
  limiteDePedido,
} from '../calendario.js';

const RESPUESTA = COMPANY_FACTS.quoteResponse;
const NAVIDAD = TEMPORADAS_2027.find((t) => t.nombre === 'Navidad');
const D = DIAS_DE_ANTICIPACION;

export default {
  id: 'calendario-promocionales-2027',
  cat: 'Estrategia',
  title: '¿Con cuánta anticipación pedir promocionales para cada temporada de 2027?',
  excerpt:
    'Calendario 2027 con la fecha límite para pedir promocionales en cada temporada, calculada con 22 días hábiles de anticipación.',
  img: '/campanas/agendas-2027-portada.jpg',
  imgAlt: 'Agenda con bolígrafo junto a un reloj de escritorio y una caja de regalo',
  iso: '2026-11-26',
  answer: `Para tener tus promocionales a tiempo, envía tu cotización al menos ${D.total} días hábiles antes de la fecha: ${D.respuesta} para recibir la propuesta y ${D.entrega} de entrega, el plazo máximo de Generando Ideas. Es poco más de un mes. Para la Navidad de 2027, por ejemplo, la fecha límite es el ${fechaLarga(limiteDePedido(NAVIDAD.fecha))}.`,
  takeaways: [
    `La regla: envía tu cotización ${D.total} días hábiles antes de la fecha en que necesitas el producto.`,
    `Son ${D.respuesta} días hábiles para responder la cotización y ${D.entrega} de entrega, el máximo del plazo de ${TIEMPO_ENTREGA}.`,
    'El cálculo no incluye lo que tardes en autorizar tu virtual: conviene sumar unos días.',
    'Si la fecha límite ya pasó, existe servicio urgente con tu ejecutivo.',
  ],
  sections: [
    {
      h: '¿Cuál es la fecha límite para pedir en cada temporada de 2027?',
      blocks: [
        {
          p: `La fecha límite de cada temporada es el último día hábil en que puedes enviar tu cotización a Generando Ideas y recibir tu pedido para esa fecha, contando ${D.total} días hábiles hacia atrás. La tabla usa el plazo máximo de entrega, así que es un cálculo conservador.`,
        },
        {
          table: {
            cols: ['Temporada', 'Fecha en 2027', 'Envía tu cotización a más tardar'],
            rows: TEMPORADAS_2027.map((t) => [t.nombre, fechaLarga(t.fecha), fechaLarga(limiteDePedido(t.fecha))]),
          },
        },
        {
          p: 'Si necesitas el producto unos días antes de la fecha, por ejemplo para repartirlo, resta también esos días.',
        },
      ],
    },
    {
      h: '¿Cómo se calculan los 22 días hábiles?',
      blocks: [
        {
          p: `Los ${D.total} días hábiles suman dos plazos de Generando Ideas: la cotización se responde en ${RESPUESTA}, es decir, hasta ${D.respuesta} días hábiles, y la entrega toma ${TIEMPO_ENTREGA}. Se cuentan de lunes a viernes y se excluyen los descansos obligatorios de México. No se incluye el tiempo de aprobación del virtual.`,
        },
        {
          p: 'Los descansos obligatorios de 2027 que la cuenta se salta son:',
        },
        {
          ul: descansosDe(2027).map((d) => `${fechaLarga(d.fecha)} (${d.motivo}).`),
        },
      ],
    },
    {
      h: '¿Qué temporadas conviene planear con más tiempo?',
      blocks: [
        {
          p: 'Las temporadas de fin de año son las que más conviene adelantar, porque en ellas se juntan los regalos corporativos y las agendas del año siguiente. Generando Ideas publica colecciones de temporada en su sitio, como Navidad, Año Nuevo y agendas, para elegir los productos con tiempo y enviar la cotización antes de la fecha límite.',
        },
      ],
    },
    {
      h: '¿Qué hago si la fecha límite ya pasó?',
      blocks: [
        {
          p: 'Si la fecha límite ya pasó, todavía hay margen: la tabla usa el plazo máximo, y Generando Ideas tiene servicio urgente, que se revisa directamente con tu ejecutivo. Para ganar días, elige productos de catálogo, que se cotizan más rápido que los de fabricación, y autoriza tu virtual en cuanto lo recibas.',
        },
      ],
    },
  ],
  next: [
    {label: 'Ver el catálogo', to: '/catalogo'},
    {label: '¿Cuánto tarda un pedido?', to: '/blog/tiempo-de-entrega-promocionales'},
    {label: 'Hablar con un asesor', to: '/contacto'},
  ],
};
