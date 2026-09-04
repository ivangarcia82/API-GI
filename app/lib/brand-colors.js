/* Generando Ideas — colores de marca del cliente.
 *
 * Los clientes son marcas, y cada marca tiene su paleta. La tienda la guarda
 * en el metafield de customer `custom.colores`, un list.single_line_text_field
 * SIN validación de choices: texto libre que escribe una persona en el admin.
 * Los valores reales ("Rojo", "Negro") coinciden con las etiquetas de
 * COLOR_FAMILIES, así que aquí se normaliza a familias y no se inventa un
 * vocabulario nuevo.
 *
 * Todo lo de este archivo es puro: lo importa también RecentlyViewed, que es
 * un componente de cliente. El I/O vive en brand-colors.server.js para que el
 * cliente de Admin API no acabe en el bundle del navegador.
 */
import {colorFamilyOf, groupColorValues, SIN_COINCIDENCIA} from './filters.js';

/**
 * Familias de color de la marca, a partir del valor crudo del metafield.
 * Tolerante con todo lo que puede escribirse a mano: JSON roto, un objeto en
 * vez de un array, hexadecimales, códigos Pantone. Devuelve [] —o sea, "no
 * filtres"— en vez de romper.
 * @param {string|null|undefined} raw
 * @returns {string[]} ids de familia, sin repetir, en el orden del metafield
 */
export function parseBrandColors(raw) {
  if (!raw) return [];
  let lista;
  try {
    lista = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(lista)) return [];
  const out = [];
  for (const valor of lista) {
    const familia = colorFamilyOf(valor);
    if (familia && !out.includes(familia)) out.push(familia);
  }
  return out;
}

/**
 * Las familias que de verdad se consultan. Con marca, nunca se sale de la
 * paleta: ni eligiendo en el panel ni editando `?color=` a mano.
 * @param {string[]} seleccion familias elegidas por el usuario
 * @param {string[]} marca familias de su paleta ([] si no tiene)
 */
export function effectiveColorFamilies(seleccion, marca) {
  const paleta = marca || [];
  const elegidas = seleccion || [];
  if (!paleta.length) return elegidas;
  if (!elegidas.length) return paleta;
  const interseccion = elegidas.filter((f) => paleta.includes(f));
  // Pidió sólo colores ajenos a su marca: se le devuelve su paleta, no la nada.
  return interseccion.length ? interseccion : paleta;
}

/**
 * Las familias que se pintan como chip removible. La paleta NO va aquí: es el
 * suelo del catálogo, no un filtro aplicado, y una x que no quita nada mentiría.
 * @param {string[]} seleccion
 * @param {string[]} marca
 */
export function visibleColorSelection(seleccion, marca) {
  const paleta = marca || [];
  const elegidas = seleccion || [];
  if (!paleta.length) return elegidas;
  return elegidas.filter((f) => paleta.includes(f));
}

/**
 * `ProductFilter[]` para las consultas que aceptan facetas. Cada familia se
 * expande a los tonos crudos que existen en la tienda; al ser todos del mismo
 * tipo, la API los combina con O.
 * @param {string[]} familias
 * @param {Array<{label: string, count: number}>} vocabulario tonos del catálogo
 * @returns {Array<object>|null} null cuando no hay marca (no filtrar)
 */
export function brandProductFilters(familias, vocabulario) {
  const paleta = familias || [];
  if (!paleta.length) return null;
  const grupos = groupColorValues(vocabulario || []);
  const out = [];
  for (const id of paleta) {
    const grupo = grupos.find((g) => g.family === id);
    if (!grupo) continue;
    for (const value of grupo.values) out.push({variantOption: {name: 'color', value}});
  }
  return out.length ? out : [SIN_COINCIDENCIA];
}

/** Los tonos de un producto, venga normalizado o crudo de la Storefront API. */
function tonosDe(producto) {
  if (producto?.colors?.length) return producto.colors;
  const opcion = (producto?.options || []).find((o) => /color/i.test(o?.name || ''));
  return (opcion?.optionValues || []).map((v) => (typeof v === 'string' ? v : v?.name));
}

/**
 * ¿Este producto se puede pedir en algún color de la marca? Semántica ANY: un
 * producto en ROJO/NEGRO/AZUL sí sirve a una marca roja, porque lo van a
 * cotizar en rojo.
 * @param {object} producto normalizado (`colors`) o crudo (`options`)
 * @param {string[]} familias
 */
export function productMatchesBrand(producto, familias) {
  const paleta = familias || [];
  if (!paleta.length) return true;
  for (const tono of tonosDe(producto)) {
    const familia = colorFamilyOf(tono);
    if (familia && paleta.includes(familia)) return true;
  }
  return false;
}

/**
 * Post-filtro en memoria, para las consultas que no aceptan facetas
 * (predictiveSearch, productRecommendations, nodes(ids:)). Devuelve la misma
 * referencia cuando no hay marca, para no copiar listas sin motivo.
 * @param {Array<object>} productos
 * @param {string[]} familias
 */
export function keepBrandProducts(productos, familias) {
  const paleta = familias || [];
  if (!paleta.length) return productos;
  return (productos || []).filter((p) => productMatchesBrand(p, paleta));
}
