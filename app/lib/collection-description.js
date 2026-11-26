/* Descripción de una colección a partir de sus propias facetas.
 *
 * Las colecciones sin texto en Shopify enseñaban todas la misma frase. Aquí
 * cada una se describe con lo que la tienda sabe de ella en el momento de
 * pedirla: cuántos productos tiene, de qué material son y qué técnicas de
 * decorado admiten. No se guarda ni se escribe nada a mano, así que no
 * envejece: si la colección cambia, la descripción cambia con ella.
 *
 * Si mercadotecnia le escribe un texto a la colección en Shopify, ese texto
 * manda y esto no se usa (ver collections.$handle.jsx).
 *
 * Sólo afirma lo que las facetas respaldan. El total es la suma de la faceta
 * de material (un producto tiene un solo material); como a alguno puede
 * faltarle, se dice "más de" y se redondea hacia abajo. Con pocos productos o
 * sin facetas no se da ninguna cifra.
 */
import {groupTechniqueValues} from './filters.js';
import {TIEMPO_ENTREGA} from './quotes/notasImportantes.js';

const FACETA_MATERIAL = 'filter.p.m.custom.material';
const FACETA_TECNICA = 'filter.p.m.custom.tecnicas_de_impresion';

/** Debajo de esto no se presume un número: "más de 10" no dice nada. */
const MINIMO_PARA_CONTAR = 20;
/** Un material "es la mayoría" a partir de esta parte de la colección. */
const MAYORIA = 0.7;
/** Una técnica que admite menos de esto no se menciona. */
const TECNICA_MINIMA = 5;
const LARGO_META = 160;

const sinAcentos = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/* Cómo se escribe cada material del catálogo dentro de una frase. */
const MATERIALES = {
  PLASTICO: 'plástico',
  TEXTIL: 'textil',
  METAL: 'metal',
  MADERA: 'madera',
  VIDRIO: 'vidrio',
  CERAMICA: 'cerámica',
  RUBBER: 'hule',
};
const material = (label) =>
  MATERIALES[sinAcentos(label).trim().toUpperCase()] ?? String(label).trim().toLowerCase();

/* La etiqueta FULL COLOR del catálogo, por su nombre en español. */
const tecnica = (label) => (/full color/i.test(label) ? 'impresión a todo color' : label.toLowerCase());

/* Las técnicas con su artículo, para cuando son el sujeto de la frase. */
const conArticulo = (nombre) => (/^(grabado|bordado)/.test(nombre) ? `el ${nombre}` : `la ${nombre}`);
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const miles = (n) => n.toLocaleString('en-US');
/** La decena inferior, para que "más de N" sea cierto. */
const decenaInferior = (n) => Math.floor((n - 1) / 10) * 10;

const valoresDe = (facetas, id) =>
  ((facetas || []).find((f) => f.id === id)?.values || []).filter((v) => v.count > 0);

/**
 * @param {object} args
 * @param {string} args.titulo título de la colección
 * @param {Array<{id: string, values: Array<{label: string, count: number}>}>} [args.facetas]
 *   las facetas de `collection.products.filters`
 * @returns {{texto: string, meta: string}} el párrafo de la página y la
 *   descripción para buscadores (160 caracteres como máximo)
 */
export function describirColeccion({titulo, facetas}) {
  const materiales = valoresDe(facetas, FACETA_MATERIAL).sort((a, b) => b.count - a.count);
  const total = materiales.reduce((suma, m) => suma + m.count, 0);
  const hayCifra = total >= MINIMO_PARA_CONTAR;
  const cuantos = hayCifra ? `más de ${miles(decenaInferior(total))} ` : '';

  const tecnicas = total
    ? groupTechniqueValues(valoresDe(facetas, FACETA_TECNICA))
        .map((t) => ({nombre: tecnica(t.label), parte: Math.min(100, Math.round((t.count / total) * 100))}))
        .filter((t) => t.parte >= TECNICA_MINIMA)
        .slice(0, 2)
    : [];

  const frases = [
    `La colección ${titulo} de Generando Ideas reúne ${cuantos}artículos promocionales personalizables.`,
  ];

  // "La colección Textil… La mayoría son de textil" no dice nada: si el
  // material ya es el nombre de la colección, la frase se omite.
  const yaLoDiceElTitulo =
    materiales.length > 0 &&
    sinAcentos(titulo).toLowerCase().includes(sinAcentos(material(materiales[0].label)));

  if (materiales.length && !yaLoDiceElTitulo) {
    const [primero, segundo] = materiales;
    if (primero.count / total >= MAYORIA || !segundo) {
      frases.push(`La mayoría son de ${material(primero.label)}.`);
    } else {
      frases.push(`Predominan los de ${material(primero.label)} y ${material(segundo.label)}.`);
    }
  }

  const [t1, t2] = tecnicas;
  /* "Todos admiten…" en lugar de "El 100% admite…". */
  const admite = (t) => (t.parte === 100 ? `Todos admiten ${t.nombre}` : `El ${t.parte}% admite ${t.nombre}`);

  if (t2 && t1.parte === t2.parte) {
    // Mismo porcentaje: se dice una vez, sin afirmar que sean los mismos
    // productos. "Cada una" sólo si las dos técnicas son femeninas.
    const sujeto = `${mayuscula(conArticulo(t1.nombre))} y ${conArticulo(t2.nombre)}`;
    const cada = [t1, t2].every((t) => conArticulo(t.nombre).startsWith('la ')) ? 'cada una' : 'cada uno';
    frases.push(
      t1.parte === 100
        ? `${sujeto} se pueden aplicar en todos los productos.`
        : `${sujeto} se pueden aplicar, ${cada}, en el ${t1.parte}% de los productos.`,
    );
  } else if (t2) {
    frases.push(`${admite(t1)} y el ${t2.parte}%, ${t2.nombre}.`);
  } else if (t1) {
    frases.push(`${admite(t1)}.`);
  } else {
    frases.push('Cada producto muestra los colores y las técnicas de decorado que admite.');
  }

  frases.push(`Se cotizan en línea sin cantidad mínima y se entregan en ${TIEMPO_ENTREGA}.`);

  return {texto: frases.join(' '), meta: metaDe({titulo, cuantos, tecnicas})};
}

/* De la más completa a la más corta: se usa la primera que quepa. */
function metaDe({titulo, cuantos, tecnicas}) {
  const cierre = ' Cotiza en línea sin cantidad mínima.';
  const inicio = cuantos ? `M${cuantos.slice(1)}artículos` : 'Artículos';
  const con = tecnicas.map((t) => t.nombre);
  const candidatas = [
    con.length === 2 && `${inicio} promocionales de ${titulo}, personalizables con ${con[0]} o ${con[1]}.${cierre}`,
    con.length >= 1 && `${inicio} promocionales de ${titulo}, personalizables con ${con[0]}.${cierre}`,
    `${inicio} promocionales de ${titulo} personalizables con tu marca.${cierre}`,
    `Artículos promocionales de ${titulo} personalizables con tu marca.`,
  ].filter(Boolean);
  const cabe = candidatas.find((c) => c.length <= LARGO_META);
  return cabe ?? `${candidatas.at(-1).slice(0, LARGO_META - 1)}…`;
}
