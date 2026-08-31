// Puro: ¿este "asesor" es una persona con cuenta en el portal?
//
// El metaobject `ejecutiva_de_venta` tiene un entry de respaldo, `marketing`,
// que sí trae correo pero NO es un ejecutivo: nunca se ofrece en el registro y
// scripts/crear-asesores.mjs lo excluye, así que no tiene cuenta. Mandarle el
// enlace del portal daba un 404.
import {MARKETING_HANDLE} from '../auth/advisor-choice.js';

/**
 * @param {{email?: string|null, handle?: string|null}|null|undefined} advisor
 * @returns {boolean}
 */
export function esAsesorReal(advisor) {
  if (!advisor) return false;
  const correo = String(advisor.email ?? '').trim();
  if (!correo) return false;
  return String(advisor.handle ?? '').trim() !== MARKETING_HANDLE;
}
