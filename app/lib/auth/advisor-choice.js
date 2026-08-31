// Pura y sin dependencias: qué ejecutiva de venta dijo el usuario que le
// atiende. NO asigna nada — desde la reunión del lunes (2026-08-30) el alta
// deja al cliente sin asesor y marketing valida la asignación en el admin de
// Shopify, filtrando por el tag `lead-pendiente`.

/** Handle del entry de respaldo. Nunca se ofrece como opción en el select. */
export const MARKETING_HANDLE = 'marketing';

/** Valor centinela de la opción "No conozco a mi asesor asignado". */
export const UNKNOWN_ADVISOR = '__desconocido__';

/**
 * @param {{esCliente?: string, advisor?: string}} form
 * @returns {string|null} handle reclamado, o null si no reclamó a nadie
 */
export function claimedAdvisorHandle({esCliente, advisor} = {}) {
  if (esCliente !== 'si') return null;
  const handle = String(advisor ?? '').trim();
  if (!handle || handle === UNKNOWN_ADVISOR || handle === MARKETING_HANDLE) return null;
  return handle;
}
