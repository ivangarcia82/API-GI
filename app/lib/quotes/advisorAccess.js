// Puro: ¿puede este ejecutivo abrir esta cotización?
//
// La regla del portal de asesores NO es propiedad —la cotización es de un
// cliente, no suya— sino asignación: sólo la ve el ejecutivo cuyo correo quedó
// grabado en la cotización al enviarse.

/**
 * @param {{advisorEmail?: string|null}|null|undefined} quote
 * @param {string|null|undefined} advisorEmail
 * @returns {boolean}
 */
export function advisorCanSee(quote, advisorEmail) {
  const asignado = String((quote && quote.advisorEmail) ?? '').trim().toLowerCase();
  const quien = String(advisorEmail ?? '').trim().toLowerCase();
  // Sin asignación no la ve nadie: si no, un ejecutivo sin correo en la
  // cotización podría abrir las de todos.
  if (!asignado || !quien) return false;
  return asignado === quien;
}
