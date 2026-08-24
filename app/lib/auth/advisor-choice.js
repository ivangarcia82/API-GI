// Pura y sin dependencias: traduce lo que eligió el usuario en el registro al
// handle del metaobject `ejecutiva_de_venta` que se le asignará en Shopify.
//
// Regla: solo un cliente existente que además señala a alguien concreto se
// queda con ese asesor. Todo lo demás (cliente nuevo, "no conozco a mi asesor",
// select vacío, o la pregunta sin responder) cae en `marketing`.

/** Handle del entry de respaldo. Nunca se ofrece como opción en el select. */
export const MARKETING_HANDLE = 'marketing';

/** Valor centinela de la opción "No conozco a mi asesor asignado". */
export const UNKNOWN_ADVISOR = '__desconocido__';

/**
 * @param {{esCliente?: string, advisor?: string}} form
 * @returns {string} handle del metaobject a asignar
 */
export function advisorHandleFromForm({esCliente, advisor} = {}) {
  if (esCliente !== 'si') return MARKETING_HANDLE;
  const handle = String(advisor ?? '').trim();
  if (!handle || handle === UNKNOWN_ADVISOR) return MARKETING_HANDLE;
  return handle;
}
