/* Blog de Generando Ideas.
 *
 * Cada artículo vive en ./posts y está escrito para poder citarse: título en
 * forma de pregunta, respuesta directa de 40 a 60 palabras (`answer`), un
 * resumen (`takeaways`) y apartados que son preguntas con su respuesta
 * inmediata. Los datos salen del catálogo (./datos), de las notas de la
 * cotización o de lo que confirmó el negocio; blog.test.js ata cada uno a su
 * origen.
 *
 * Bloques de un apartado: {p}, {ul}, {ol} o {table: {cols, rows}}.
 */
import tecnicas from './posts/impresion-tecnicas.js';
import tiempos from './posts/tiempo-de-entrega-promocionales.js';
import calendario from './posts/calendario-promocionales-2027.js';
import certificaciones from './posts/certificaciones-proveedor-promocionales.js';
import kit from './posts/kit-de-bienvenida-empleados.js';
import ecologicos from './posts/promocionales-ecologicos.js';

/** Quien firma los artículos (confirmado por el negocio, nov-2026). */
export const BLOG_AUTHOR = {name: 'Guadalupe Cordoba'};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fechaCorta = (iso) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return `${MESES[mes - 1]} ${dia}, ${anio}`;
};

const textoDeBloque = (b) => {
  if (b.p) return b.p;
  if (b.ul) return b.ul.join(' ');
  if (b.ol) return b.ol.join(' ');
  if (b.table) return [...b.table.cols, ...b.table.rows.flat()].join(' ');
  return '';
};

/** Todo el texto de un artículo, llano: para contar palabras y para probarlo. */
export function textoDe(post) {
  return [
    post.answer,
    ...post.takeaways,
    ...post.sections.flatMap((s) => [s.h, ...s.blocks.map(textoDeBloque)]),
  ].join(' ');
}

const palabras = (texto) => texto.trim().split(/\s+/).length;

/** Fecha legible, autora y tiempo de lectura (a 200 palabras por minuto). */
const completar = (post) => ({
  ...post,
  author: BLOG_AUTHOR,
  date: fechaCorta(post.iso),
  read: `${Math.max(1, Math.round(palabras(textoDe(post)) / 200))} min`,
  words: palabras(textoDe(post)),
});

/** @type {ReturnType<typeof completar>[]} */
export const BLOG_POSTS = [tecnicas, tiempos, calendario, certificaciones, kit, ecologicos].map(completar);

/** Filtro del índice: sólo las categorías que tienen artículos. */
export const BLOG_CATEGORIES = ['Todos', ...new Set(BLOG_POSTS.map((p) => p.cat))];

/* Artículos retirados (nov-2026): compartían el mismo texto y tres afirmaban
   cifras sin respaldo. Sus direcciones llevan al artículo que los reemplaza
   o, si no hay equivalente, al índice. */
export const BLOG_REDIRECTS = {
  'textiles-sustentables': '/blog/promocionales-ecologicos',
  'tendencias-2026': '/blog',
  'fulfillment-escala': '/blog',
  'mundial-2026': '/blog',
  'roi-promocionales': '/blog',
};
