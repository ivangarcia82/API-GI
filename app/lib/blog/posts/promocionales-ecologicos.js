import {CATALOGO} from '../datos.js';
import {COMPANY_FACTS} from '../../site-content.js';
import {TIEMPO_ENTREGA} from '../../quotes/notasImportantes.js';

const E = CATALOGO.ecologicos;
const tipo = (nombre) => E.tipos.find((t) => t.nombre === nombre).productos;
const material = (inicio) => E.materiales.find((m) => m.nombre.startsWith(inicio)).productos;
const RESPUESTA = COMPANY_FACTS.quoteResponse;

export default {
  id: 'promocionales-ecologicos',
  cat: 'Sustentabilidad',
  title: 'Promocionales ecológicos: ¿qué materiales hay y cuál elegir?',
  excerpt:
    'Bambú, papel reciclado, algodón, yute, fibra de trigo, corcho y rPET: qué materiales tienen los promocionales ecológicos y cómo elegir.',
  img: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1400&q=80',
  imgAlt: 'Prendas de fibras naturales colgadas en un perchero',
  iso: '2026-11-26',
  answer: `Los promocionales ecológicos más comunes están hechos de papel o cartón, algodón, bambú, yute, fibra de trigo, corcho y PET reciclado (rPET). El catálogo de Generando Ideas tiene ${E.total} productos ecológicos; los más numerosos son bolsas, libretas y bolígrafos. Conviene elegir por uso: el mejor material es el del artículo que más se reutiliza.`,
  takeaways: [
    `La categoría Ecológicos de Generando Ideas tiene ${E.total} productos al ${CATALOGO.fechaTexto}.`,
    `Los tipos más numerosos son bolsas (${tipo('Bolsas')}), libretas (${tipo('Libretas')}) y bolígrafos (${tipo('Bolígrafos')}).`,
    `El material más mencionado es el papel, cartón o kraft (${material('Papel')} productos), seguido de algodón (${material('Algodón')}) y bambú (${material('Bambú')}).`,
    'Un promocional es más sustentable cuanto más se usa: elige por utilidad, no sólo por material.',
  ],
  sections: [
    {
      h: '¿Qué materiales ecológicos hay en promocionales?',
      blocks: [
        {
          p: `Los materiales más frecuentes son el papel, cartón o kraft, el algodón, el bambú, el yute, la fibra de trigo, la tela no tejida, el PET reciclado y el corcho. En la categoría Ecológicos de Generando Ideas, de ${E.total} productos, el papel y el cartón son los más mencionados, con ${material('Papel')} productos.`,
        },
        {
          table: {
            cols: ['Material', 'En qué productos se usa', 'Productos que lo mencionan'],
            rows: E.materiales.map((m) => [m.nombre, m.uso, String(m.productos)]),
          },
        },
        {
          p: `Conteo de las fichas de la categoría Ecológicos al ${CATALOGO.fechaTexto}. Una ficha puede mencionar más de un material.`,
        },
      ],
    },
    {
      h: '¿Qué productos ecológicos hay más en el catálogo?',
      blocks: [
        {
          p: `Los productos ecológicos más numerosos en el catálogo de Generando Ideas son las bolsas, con ${tipo('Bolsas')} modelos, las libretas, con ${tipo('Libretas')}, y los bolígrafos, con ${tipo('Bolígrafos')}. Les siguen los sets, con ${tipo('Sets')}, y las botellas, con ${tipo('Botellas')}. Son artículos de uso diario, que es justo lo que hace sustentable a un promocional.`,
        },
        {
          table: {
            cols: ['Tipo de producto', 'Modelos'],
            rows: E.tipos.map((t) => [t.nombre, String(t.productos)]),
          },
        },
      ],
    },
    {
      h: '¿Cómo se personaliza un promocional ecológico?',
      blocks: [
        {
          p: `Casi todos se pueden decorar con serigrafía: la admite el ${E.tecnicas.serigrafia}% de los productos ecológicos del catálogo de Generando Ideas. El ${E.tecnicas.todoColor}% admite impresión a todo color, el ${E.tecnicas.laser}% grabado láser y el ${E.tecnicas.bordado}% bordado. El grabado láser se aplica en madera y bambú, porque marca el material sin usar tinta.`,
        },
      ],
    },
    {
      h: '¿Cómo elegir un promocional ecológico sin caer en greenwashing?',
      blocks: [
        {
          p: 'Elige primero un artículo que la persona vaya a usar muchas veces y después el material: una bolsa de algodón que se usa cada semana aporta más que un objeto de bambú que se queda en un cajón. Evita afirmaciones absolutas como «100% ecológico» si no puedes respaldarlas con la ficha del producto.',
        },
        {
          ul: [
            'Prefiere artículos reutilizables y de uso diario.',
            'Revisa en la ficha de qué material está hecho cada componente.',
            'Describe el material tal cual (bambú, papel reciclado, rPET) en lugar de usar adjetivos.',
            'Pide sólo las piezas que necesitas: Generando Ideas no maneja cantidad mínima.',
          ],
        },
      ],
    },
    {
      h: '¿Cómo cotizar promocionales ecológicos?',
      blocks: [
        {
          p: `Los promocionales ecológicos de Generando Ideas están en la categoría Ecológicos del catálogo en línea. Desde ahí se agregan a la lista de cotización con su color, técnica y cantidad; un asesor responde en un plazo de ${RESPUESTA} y la entrega toma ${TIEMPO_ENTREGA}. No hay cantidad mínima de compra.`,
        },
      ],
    },
  ],
  next: [
    {label: 'Ver la categoría Ecológicos', to: '/collections/ecologicos'},
    {label: 'Ver el catálogo', to: '/catalogo'},
    {label: 'Preguntas frecuentes', to: '/preguntas-frecuentes'},
  ],
};
