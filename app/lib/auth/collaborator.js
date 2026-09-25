// Colaboradores de Generando Ideas: cuentas cuyo correo es del dominio
// corporativo. Sin imports para que lo usen igual el registro que las páginas
// internas (y los scripts de Node, como roles.js).
export const COLLABORATOR_DOMAIN = 'generandoideas.com';

/**
 * @param {unknown} email
 * @returns {boolean} true sólo para `algo@generandoideas.com`, exacto
 */
export function isCollaboratorEmail(email) {
  const e = String(email ?? '').trim().toLowerCase();
  const at = e.indexOf('@');
  // Una sola arroba y algo antes de ella.
  if (at <= 0 || at !== e.lastIndexOf('@')) return false;
  return e.slice(at + 1) === COLLABORATOR_DOMAIN;
}
