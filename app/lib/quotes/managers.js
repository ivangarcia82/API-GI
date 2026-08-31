// Puro y sin dependencias: quién es el manager de cada ejecutivo de venta.
//
// La relación no vive en Shopify — el metaobject `ejecutiva_de_venta` sólo
// guarda nombre, correo, teléfono y puesto. Se decidió mantenerla aquí como
// matriz a mano y actualizarla cuando cambie el organigrama.
//
// Se indexa por CORREO, no por handle, porque en el momento del envío
// `getCustomerAdvisor` sólo devuelve el correo del metaobject. Las llaves van
// en minúsculas y sin espacios; `managers.test.js` lo vigila.

/** @type {Record<string, string>} correo del ejecutivo -> correo de su manager */
export const MANAGERS = {
  // Pendiente: vaciar aquí la matriz que entregue Iván.
  // 'laura@generandoideas.com': 'antonio@generandoideas.com',
};

/**
 * Manager de un ejecutivo, o null si no está en la matriz. Nunca lanza: un
 * ejecutivo sin manager simplemente manda su correo sin copia.
 * @param {string|null|undefined} advisorEmail
 * @param {Record<string, string>} [tabla] inyectable para pruebas
 * @returns {string|null}
 */
export function managerFor(advisorEmail, tabla = MANAGERS) {
  const clave = String(advisorEmail ?? '').trim().toLowerCase();
  if (!clave) return null;
  // hasOwnProperty evita que un correo como "constructor" resuelva al
  // prototipo de Object.
  if (!Object.prototype.hasOwnProperty.call(tabla, clave)) return null;
  const manager = String(tabla[clave] ?? '').trim();
  return manager || null;
}
