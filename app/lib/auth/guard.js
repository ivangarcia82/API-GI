// Server-only. Reads the session snapshot; throws redirect('/login') if absent.
import {redirect} from 'react-router';
import {getSessionUser} from './session.js';

export async function requireUser(context) {
  const user = getSessionUser(context.session);
  if (!user) {
    throw redirect('/login');
  }
  return user;
}
