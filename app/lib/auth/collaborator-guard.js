// Server-only. Puerta de las páginas internas para colaboradores. A diferencia
// de requireUser, quien no tiene sesión vuelve a la página tras entrar: el aviso
// a los colaboradores lleva el enlace directo y no deben perderse en /account.
import {redirect} from 'react-router';
import {getSessionUser} from './session.js';
import {requireUser} from './guard.js';
import {findById} from './users.js';
import {getDb} from '~/lib/db/client.js';
import {isCollaboratorEmail} from './collaborator.js';

function loginFor(returnTo) {
  return `/login?redirectTo=${encodeURIComponent(returnTo)}`;
}

/**
 * @param {any} context  contexto de Hydrogen (session, env)
 * @param {string} returnTo  ruta interna a la que se vuelve tras el login
 * @returns {Promise<{user: any, allowed: boolean}>}
 */
export async function loadCollaborator(context, returnTo) {
  if (!getSessionUser(context.session)) throw redirect(loginFor(returnTo));

  let sessionUser;
  try {
    // Reutiliza la validación de session_version (y el borrado del cookie).
    sessionUser = await requireUser(context);
  } catch (err) {
    if (err instanceof Response && err.status >= 300 && err.status < 400) {
      throw redirect(loginFor(returnTo));
    }
    throw err;
  }

  const user = await findById(getDb(context.env), sessionUser.userId);
  if (!user) throw redirect(loginFor(returnTo));

  return {user, allowed: isCollaboratorEmail(user.email)};
}
