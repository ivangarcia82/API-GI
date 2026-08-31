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
  // Equipo de Sandra Jiménez
  'gamaro@generandoideas.com': 'sjimenez@generandoideas.com',
  'lvega@generandoideas.com': 'sjimenez@generandoideas.com',
  'mromero@generandoideas.com': 'sjimenez@generandoideas.com',
  'mperez@generandoideas.com': 'sjimenez@generandoideas.com',

  // Equipo de A. Quiroz
  'areynoso@generandoideas.com': 'aquiroz@generandoideas.com',
  'tguirre@generandoideas.com': 'aquiroz@generandoideas.com',
  'nanchez@generandoideas.com': 'aquiroz@generandoideas.com',

  // Equipo de J. Ríos
  'wgarcia@generandoideas.com': 'jrios@generandoideas.com',
  'zchino@generandoideas.com': 'jrios@generandoideas.com',
  'sperez@generandoideas.com': 'jrios@generandoideas.com',
  // Llegó como "Mquintanilla@"; la llave va en minúsculas porque la búsqueda
  // normaliza antes de comparar (ver managerFor y su prueba de normalización).
  'mquintanilla@generandoideas.com': 'jrios@generandoideas.com',
  'agamboa@generandoideas.com': 'jrios@generandoideas.com',
  'aespinosa@generandoideas.com': 'jrios@generandoideas.com',
  'emorales@generandoideas.com': 'jrios@generandoideas.com',
  'eaguilar@generandoideas.com': 'jrios@generandoideas.com',
  'gapia@generandoideas.com': 'jrios@generandoideas.com',
  'cbernal@generandoideas.com': 'jrios@generandoideas.com',
  'bcedillo@generandoideas.com': 'jrios@generandoideas.com',

  // Mérida
  'merida3@generandoideas.com': 'merida2@generandoideas.com',

  // Sonora
  'sonora2@generandoideas.com': 'sonora@generandoideas.com',
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
