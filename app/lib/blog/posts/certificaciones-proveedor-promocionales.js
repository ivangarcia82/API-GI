import {BRAND} from '../../site-content.js';

export default {
  id: 'certificaciones-proveedor-promocionales',
  cat: 'Proveedores',
  title: '¿Qué certificaciones debe tener un proveedor de promocionales?',
  excerpt:
    'SMETA, FAMA de Disney, Principios Rectores de Coca-Cola y ESR: qué avala cada certificación y cómo verificarla en tu proveedor.',
  img: '/servicios/promotional-workshop.jpg',
  imgAlt: 'Técnico operando un equipo de grabado láser junto a una mesa con productos promocionales',
  iso: '2026-11-26',
  answer:
    'Un proveedor de promocionales confiable debe demostrar, con auditorías de terceros, que cumple estándares laborales, éticos, ambientales y de seguridad. Entre las que piden las áreas de compras están SMETA, los Principios Rectores de Coca-Cola y la aprobación FAMA de Disney. Generando Ideas cuenta con las tres, además del distintivo ESR.',
  takeaways: [
    'Una certificación vale por quién la audita: la revisa un tercero, no el propio proveedor.',
    'SMETA revisa cuatro pilares: estándares laborales, salud y seguridad, medio ambiente y ética empresarial.',
    'FAMA es la autorización de Disney para fabricar y distribuir productos con sus licencias.',
    'Generando Ideas cuenta con SMETA, FAMA, Principios Rectores de Coca-Cola, distintivo ESR y nivel oro de Grupo Salinas.',
  ],
  sections: [
    {
      h: '¿Qué avala cada certificación?',
      blocks: [
        {
          p: 'Cada certificación responde a una pregunta distinta sobre el proveedor. SMETA y los Principios Rectores de Coca-Cola revisan cómo trabaja: condiciones laborales, ética y medio ambiente. FAMA autoriza una instalación para producir mercancía con licencia de Disney. El distintivo ESR reconoce la responsabilidad social de una empresa en México.',
        },
        {
          table: {
            cols: ['Certificación', 'Quién la otorga o la exige', 'Qué revisa'],
            rows: [
              [
                'SMETA',
                'Sedex, con auditores externos',
                'Cuatro pilares: estándares laborales, salud y seguridad, medio ambiente y ética empresarial',
              ],
              [
                'Principios Rectores para Proveedores',
                'The Coca-Cola Company, con auditoría externa',
                'Buenas prácticas éticas, laborales y ambientales en la cadena de valor',
              ],
              [
                'FAMA',
                'The Walt Disney Company',
                'Calidad, seguridad y cumplimiento social de la instalación que fabrica o distribuye productos con licencia',
              ],
              [
                'Distintivo ESR',
                'Centro Mexicano para la Filantropía (Cemefi)',
                'Gestión socialmente responsable de la empresa',
              ],
              [
                'Certificación Integral de Empresas',
                'Grupo Salinas',
                'Normas estratégicas, de gobernabilidad y técnicas; el nivel oro indica excelencia operativa',
              ],
              [
                'Círculo de Proveedores',
                'Evaluación de proveedores',
                'Aspectos legales, financieros, operativos y comerciales',
              ],
            ],
          },
        },
      ],
    },
    {
      h: '¿Por qué le importan a un área de compras?',
      blocks: [
        {
          p: 'A un área de compras le importan porque un promocional lleva el logotipo de la empresa, y con él su reputación: lo que haga el proveedor se le atribuye a la marca. Una auditoría de terceros ahorra revisiones propias y, en el caso de las licencias, es un requisito: sin autorización no se produce mercancía licenciada.',
        },
        {
          ul: [
            'Reputación: el artículo lleva la marca de quien lo regala.',
            'Cumplimiento: muchas empresas exigen a sus proveedores los mismos estándares que se aplican a sí mismas.',
            'Licencias: producir artículos con personajes o marcas de terceros requiere una instalación autorizada.',
            'Tiempo: un reporte de auditoría vigente evita repetir la misma revisión con cada proveedor.',
          ],
        },
      ],
    },
    {
      h: '¿Cómo verificar las certificaciones de un proveedor?',
      blocks: [
        {
          p: 'Para verificarlas, pide el certificado o el reporte de auditoría vigente y revisa tres datos: la fecha de la auditoría, la razón social auditada y la instalación que cubre. Una certificación ampara a una empresa y a una instalación concretas, no a cualquier marca comercial que se le parezca.',
        },
        {
          ol: [
            'Pide el documento vigente, no sólo el logotipo de la certificación en una presentación.',
            'Confirma que la razón social del certificado es la misma que te va a facturar.',
            'Revisa la fecha: las auditorías se renuevan y un reporte viejo ya no dice cómo opera hoy el proveedor.',
            'Pregunta qué instalación fue auditada y si es donde se produce tu pedido.',
          ],
        },
        {
          p: `En el caso de Generando Ideas, la razón social es ${BRAND.legalName}, la misma que aparece en cada cotización.`,
        },
      ],
    },
    {
      h: '¿Qué membresías de la industria conviene revisar?',
      blocks: [
        {
          p: 'Además de las certificaciones, conviene revisar si el proveedor pertenece a las asociaciones de su industria. Dos referencias para un comprador en México son PPAI, la asociación internacional de productos promocionales, y AMPPRO, la Asociación Mexicana de Profesionales de la Promoción. Generando Ideas es socio de PPAI y miembro de AMPPRO desde 2013.',
        },
        {
          p: 'En AMPPRO, Generando Ideas participa además en el comité 2025-2026.',
        },
      ],
    },
    {
      h: '¿Qué certificaciones tiene Generando Ideas?',
      blocks: [
        {
          p: 'Generando Ideas cuenta con la certificación de los Principios Rectores de Coca-Cola, la auditoría SMETA y la aprobación FAMA de Disney. Suma cinco años consecutivos con el distintivo ESR, tiene el nivel oro de la Certificación Integral de Empresas de Grupo Salinas y cumple la evaluación del Círculo de Proveedores.',
        },
        {
          p: 'La empresa opera desde 2013, es 100% mexicana y tiene sucursales en Ciudad de México, Yucatán y Sonora.',
        },
      ],
    },
  ],
  next: [
    {label: 'Conocer a Generando Ideas', to: '/conocenos'},
    {label: 'Preguntas frecuentes', to: '/preguntas-frecuentes'},
    {label: 'Hablar con un asesor', to: '/contacto'},
  ],
};
