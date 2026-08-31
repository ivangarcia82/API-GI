// Server-only. Autorización del portal de ejecutivos.
//
// Se apoya en requireUser (sesión válida y versión al día) y encima comprueba
// el rol contra la BASE, no contra la sesión: una sesión emitida cuando alguien
// era asesor no puede seguir abriendo el portal si ya se le quitó el rol.
import {getDb} from '~/lib/db/client.js';
import {requireUser} from './guard.js';
import {findById} from './users.js';

/** Rol de los ejecutivos de venta. Los compradores son 'quoter'. */
export const ADVISOR_ROLE = 'asesor';

/**
 * @param {Record<string, any>} context
 * @returns {Promise<{id: string, email: string, role: string}>}
 * @throws {Response} 404 si no es asesor; el redirect de requireUser si no hay sesión
 */
export async function requireAdvisor(context) {
  const sesion = await requireUser(context);
  const db = getDb(context.env);
  const user = await findById(db, sesion.userId);

  // 404 y no 403: para un comprador el portal simplemente no existe.
  if (!user || user.role !== ADVISOR_ROLE) {
    throw new Response('No encontrada', {status: 404});
  }

  return {
    ...user,
    // Normalizado porque es la llave contra quotes.advisor_email.
    email: String(user.email ?? '').trim().toLowerCase(),
  };
}
