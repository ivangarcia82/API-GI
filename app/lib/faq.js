/* Generando Ideas — preguntas frecuentes.
 *
 * Fuente única de la página /preguntas-frecuentes y de sus datos
 * estructurados (FAQPage). Cada entrada está escrita para poder citarse sola:
 *   - `q`  una pregunta real, como la escribiría un comprador;
 *   - `a`  la respuesta directa, de 40 a 60 palabras, que nombra a la empresa
 *          y no depende de ningún otro texto de la página;
 *   - `steps` / `table`  el detalle, cuando la respuesta es un proceso o una
 *          comparación.
 *
 * REGLA: aquí sólo entran datos que el sitio ya declara en otra parte
 * (Conócenos, Servicios, Contacto, el cotizador, las notas del PDF de
 * cotización) o que el negocio confirmó. El 26-nov-2026 confirmó: sin
 * cantidad mínima, aprobación con virtual, muestra física si se acuerda,
 * factura, envíos a toda la República y los tiempos de respuesta. Sigue sin
 * confirmar la FORMA de pago (transferencia, tarjeta): no se menciona.
 * Tampoco importes: los precios son sólo para clientes con sesión.
 * Las pruebas (faq.test.js) atan cada dato a su origen para que no se
 * despegue.
 */
import {BRAND, COMPANY_FACTS, ROUTES, SERVICE_DETAILS} from './site-content.js';
import {ORGANIZATION_ID} from './seo.js';
import {CONDICIONES_PAGO, TIEMPO_ENTREGA, VIGENCIA_COTIZACION} from './quotes/notasImportantes.js';

const miles = (n) => n.toLocaleString('en-US');
const RESPUESTA = COMPANY_FACTS.quoteResponse;

export const FAQ_PATH = ROUTES.faq;

const PRINT_SHOP = SERVICE_DETAILS['print-shop'].blocks;
const TABLA_TECNICAS = PRINT_SHOP.find((b) => b.table).table;
const PASOS_PERSONALIZAR = PRINT_SHOP.find((b) => b.type === 'process').steps.map((s) => s.t);

/**
 * @typedef {object} FaqItem
 * @property {string} q
 * @property {string} a
 * @property {string[]} [steps]
 * @property {{cols: string[], rows: string[][]}} [table]
 */

/** @type {{id: string, title: string, items: FaqItem[]}[]} */
export const FAQ_GROUPS = [
  {
    id: 'empresa',
    title: 'Sobre Generando Ideas',
    items: [
      {
        q: '¿Qué es Generando Ideas?',
        a: `Generando Ideas es una empresa 100% mexicana de artículos promocionales y regalos corporativos personalizados para empresas. Opera desde 2013, atiende a más de ${miles(COMPANY_FACTS.clients)} clientes y más de ${miles(COMPANY_FACTS.users)} usuarios, cuenta con sucursales en Ciudad de México, Yucatán y Sonora, y ofrece cinco servicios: promocionales, Print Shop, Promotional Workshop, Digital Evolution e importaciones.`,
      },
      {
        q: '¿Dónde se ubica Generando Ideas y cuál es su horario?',
        a: 'La sucursal de Ciudad de México de Generando Ideas está en Cda. Antonio Maceo 67, colonia Escandón I Sección, alcaldía Miguel Hidalgo, C.P. 11800. La empresa también opera sucursales en Yucatán y Sonora. El horario de atención es de lunes a viernes, de 8:30 a 18:00 horas.',
      },
      {
        q: '¿Qué certificaciones y membresías tiene Generando Ideas?',
        a: 'Generando Ideas cuenta con la certificación de los Principios Rectores de Coca-Cola, la auditoría SMETA y la aprobación FAMA de Disney. Es socio de PPAI y miembro de AMPPRO desde 2013, suma cinco años consecutivos como Empresa Socialmente Responsable (ESR) y tiene el nivel oro de la Certificación Integral de Empresas de Grupo Salinas.',
      },
    ],
  },
  {
    id: 'cotizacion',
    title: 'Cotización y precios',
    items: [
      {
        q: '¿Cómo cotizo artículos promocionales en línea con Generando Ideas?',
        a: `Para cotizar en línea con Generando Ideas, elige los productos en el catálogo, selecciona color, decorado y cantidad, y agrégalos a tu lista de cotización. Después crea tu cuenta gratuita o inicia sesión y envía la solicitud. Un asesor responde en un plazo de ${RESPUESTA}.`,
        steps: [
          'Explora el catálogo y abre el producto que te interesa.',
          'Elige el color, la técnica de decorado y la cantidad.',
          'Agrégalo a tu lista de cotización; puedes sumar varios productos.',
          'Crea tu cuenta gratuita o inicia sesión.',
          `Envía la solicitud: un asesor te responde en un plazo de ${RESPUESTA}.`,
        ],
      },
      {
        q: '¿Cómo puedo ver los precios de los productos?',
        a: 'Los precios de Generando Ideas se muestran sólo a clientes registrados. Crear la cuenta es gratuito: al iniciar sesión, cada producto muestra su precio por pieza y el total según la cantidad y el decorado elegidos. Los precios están en pesos mexicanos y no incluyen IVA.',
      },
      {
        q: '¿Los precios incluyen IVA?',
        a: 'No. Los precios que muestra Generando Ideas están en pesos mexicanos y no incluyen IVA. La cotización desglosa el subtotal, el IVA del 16% y el total estimado, y el importe final se confirma con tu asesor según el volumen, la técnica de decorado y el plazo de entrega.',
      },
      {
        q: '¿Puedo descargar mi cotización en PDF?',
        a: 'Sí. Cada cotización enviada en generandoideas.com queda guardada en la cuenta del cliente, en la sección Mis cotizaciones, y desde ahí se puede descargar en PDF. El documento incluye los productos, las cantidades, el decorado elegido y el desglose de subtotal, IVA y total.',
      },
      {
        q: '¿En cuánto tiempo responde Generando Ideas una cotización?',
        a: `Generando Ideas responde las cotizaciones de productos de catálogo en un plazo de ${RESPUESTA}, y las de productos de fabricación, que son los que no están en el catálogo, en 48 horas hábiles. La atención es de lunes a viernes, de 8:30 a 18:00 horas.`,
      },
    ],
  },
  {
    id: 'pedidos',
    title: 'Pedidos y entregas',
    items: [
      {
        q: '¿Hay cantidad mínima de compra en Generando Ideas?',
        a: 'No. Generando Ideas no maneja cantidad mínima de compra: puedes cotizar desde una sola pieza. El precio por pieza cambia según la cantidad y la técnica de decorado que elijas, y el cotizador en línea recalcula el precio por pieza y el total cada vez que modificas cualquiera de los dos.',
      },
      {
        q: '¿Cuánto tarda la entrega de un pedido?',
        a: `El tiempo de entrega de un pedido en Generando Ideas es de ${TIEMPO_ENTREGA}, y ese plazo aparece en las notas de cada cotización. Si necesitas tu pedido antes, existe servicio urgente: se atiende directamente con tu ejecutivo, que es quien lo revisa contigo.`,
      },
      {
        q: '¿Puedo ver una muestra antes de producir mi pedido?',
        a: 'Sí. En Generando Ideas toda aprobación se hace con un virtual: una vista digital del producto con tu logotipo, que revisas y autorizas antes de que el pedido entre a producción. La muestra física no es automática: aplica cuando se acuerda con tu ejecutivo.',
      },
      {
        q: '¿Hacen envíos a toda la República Mexicana?',
        a: 'Sí. Generando Ideas envía pedidos a toda la República Mexicana. El precio incluye la entrega en la Ciudad de México sin costo, en un solo punto; los envíos al resto del país se cobran aparte. No incluye servicios de maquila, empaque o entrega especial, salvo que se especifiquen en la cotización.',
      },
      {
        q: '¿Generando Ideas emite factura?',
        a: `Sí. Generando Ideas factura sus pedidos. La empresa opera con la razón social ${BRAND.legalName}, que aparece en cada cotización junto con su RFC. Los precios se expresan en moneda nacional y sin IVA, y la cotización desglosa el subtotal, el IVA del 16% y el total.`,
      },
      {
        q: '¿Cuáles son las condiciones de pago y la vigencia de una cotización?',
        a: `En Generando Ideas las condiciones de pago son de ${CONDICIONES_PAGO.toLowerCase()} y cada cotización tiene una vigencia de ${VIGENCIA_COTIZACION}. Los precios se expresan en moneda nacional y están sujetos a la paridad peso-dólar. Estas condiciones aparecen en las notas de cada cotización, junto con el tiempo de entrega.`,
      },
    ],
  },
  {
    id: 'personalizacion',
    title: 'Personalización',
    items: [
      {
        q: '¿Qué técnicas de personalización maneja Generando Ideas?',
        a: 'Generando Ideas personaliza artículos promocionales con diez técnicas: serigrafía, tampografía, bordado, grabado láser, sublimación, parche sublimado, vinil imprimible y DTF, impresión UV plana a todo color, impresión 360° a todo color y gota de resina. La técnica disponible depende del material y de la forma de cada producto.',
      },
      {
        q: '¿Qué técnica de decorado conviene para cada producto?',
        a: 'En Generando Ideas la técnica se elige según el material y el uso del producto. La tampografía conviene para plumas, termos, llaveros y superficies irregulares; la serigrafía, para playeras, bolsas, libretas y textiles; el grabado láser, para termos metálicos, madera y aluminio; y el bordado, para gorras, camisas, chamarras y mochilas.',
        table: TABLA_TECNICAS,
      },
      {
        q: '¿Cómo es el proceso para personalizar un producto?',
        a: 'El proceso de personalización de Generando Ideas tiene cinco pasos: selección del producto, recepción y validación del arte, recomendación de la técnica adecuada, producción y entrega. Un asesor acompaña cada etapa y el arte se valida con el cliente antes de producir, para que el resultado respete la identidad de la marca.',
        steps: PASOS_PERSONALIZAR,
      },
      {
        q: '¿Qué tipo de artículos promocionales puedo encontrar?',
        a: 'El catálogo de Generando Ideas reúne artículos promocionales personalizables en ocho categorías: bebidas, ecológicos, hogar, oficina, salud y belleza, tecnología, textil y tiempo libre. Incluye termos, libretas, mochilas, bolsas, plumas y regalos corporativos, que se pueden filtrar por color, material, técnica de impresión y talla.',
      },
    ],
  },
  {
    id: 'servicios',
    title: 'Servicios',
    items: [
      {
        q: '¿Qué servicios ofrece Generando Ideas además de promocionales?',
        a: 'Además de artículos promocionales, Generando Ideas ofrece cuatro servicios: Print Shop, con decorado de materiales promocionales y corporativos; Promotional Workshop, con showrooms interactivos y demostraciones en vivo; Digital Evolution, con tiendas corporativas, cotizadores y portales de obsequios; e Importaciones, con gestión integral para proyectos personalizados y a gran escala.',
      },
    ],
  },
  {
    id: 'contacto',
    title: 'Contacto',
    items: [
      {
        q: '¿Cómo contacto a un asesor de Generando Ideas?',
        a: `Para hablar con un asesor de Generando Ideas, llama al ${BRAND.phone}, escribe a ${BRAND.email} o llena el formulario de contacto en generandoideas.com/contacto. La atención es de lunes a viernes, de 8:30 a 18:00 horas, y también hay un chat de WhatsApp disponible desde el sitio.`,
      },
    ],
  },
];

/** Todas las preguntas, en el orden en que se leen. */
export function faqItems() {
  return FAQ_GROUPS.flatMap((g) => g.items);
}

/**
 * La respuesta completa en texto llano, como va en los datos estructurados:
 * la respuesta directa y, si los hay, los pasos numerados o la tabla.
 * @param {FaqItem} item
 */
export function faqAnswerText(item) {
  const partes = [item.a];
  if (item.steps?.length) {
    partes.push(item.steps.map((paso, i) => `${i + 1}. ${paso}`).join(' '));
  }
  if (item.table) {
    partes.push(item.table.rows.map(([nombre, uso]) => `${nombre}: ${uso}.`).join(' '));
  }
  return partes.join(' ');
}

/**
 * Nodo FAQPage (sin @context: quien lo publica lo mete en su @graph).
 * @param {string} origin p. ej. https://generandoideas.com
 */
export function faqSchema(origin) {
  return {
    '@type': 'FAQPage',
    '@id': `${origin}${FAQ_PATH}#faq`,
    url: `${origin}${FAQ_PATH}`,
    name: 'Preguntas frecuentes de Generando Ideas',
    inLanguage: 'es-MX',
    publisher: {'@id': ORGANIZATION_ID},
    mainEntity: faqItems().map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {'@type': 'Answer', text: faqAnswerText(item)},
    })),
  };
}
