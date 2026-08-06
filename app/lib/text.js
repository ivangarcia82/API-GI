/* Ayudas de texto para pintar datos que vienen del catálogo. */

/**
 * Mete el espacio que falta después de un punto cuando el catálogo trae dos
 * frases pegadas ("...de deteriorar tu mesa o escritorio.Canales de..."), un
 * caso real y frecuente en las descripciones. No toca decimales (1.5), ni
 * dominios o archivos (.com, .pdf, .mx), ni elipsis.
 *
 * @param {string} texto
 * @returns {string}
 */
export function separarFrasesPegadas(texto = '') {
  return String(texto).replace(
    /([a-záéíóúñü])\.([A-ZÁÉÍÓÚÑÜ])/g,
    (match, antes, despues) => `${antes}. ${despues}`,
  );
}

/**
 * Primer tramo legible de una descripción larga, para el resumen del PDP.
 * Corta en el final de frase más cercano por debajo de `max`; si no hay
 * ninguno, corta por palabra y añade elipsis. El texto completo se sigue
 * mostrando en la pestaña "Descripción", así que aquí sólo hace falta lo
 * suficiente para saber qué es el producto.
 *
 * @param {string} texto
 * @param {number} [max] tope de caracteres del resumen
 * @returns {string}
 */
export function resumen(texto = '', max = 220) {
  const limpio = separarFrasesPegadas(String(texto).trim()).replace(/\s+/g, ' ');
  if (limpio.length <= max) return limpio;

  // Final de frase (. ! ?) seguido de espacio, dentro del tope.
  const ventana = limpio.slice(0, max + 1);
  const finFrase = Math.max(
    ventana.lastIndexOf('. '),
    ventana.lastIndexOf('! '),
    ventana.lastIndexOf('? '),
  );
  // Un corte demasiado temprano deja un resumen inútil; mejor cortar por
  // palabra que devolver cuatro palabras de una descripción de 800 caracteres.
  if (finFrase > max * 0.4) return limpio.slice(0, finFrase + 1);

  const corte = ventana.lastIndexOf(' ');
  return `${limpio.slice(0, corte > 0 ? corte : max).replace(/[,;:.]$/, '')}…`;
}
