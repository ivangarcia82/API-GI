// Server-only. Reads the session snapshot and validates it against the DB's
// current session_version, so a password reset / admin action (which bumps
// session_version) actually invalidates every older cookie. Throws
// redirect('/login') — and clears the stale cookie — when there is no session
// or the snapshot version is stale.
import {redirect} from 'react-router';
import {getSessionUser, logoutSession} from './session.js';
import {getDb} from '~/lib/db/client.js';
import {getSessionVersion} from './users.js';

export async function requireUser(context) {
  const user = getSessionUser(context.session);
  if (!user) {
    throw redirect('/login');
  }
  const db = getDb(context.env);
  const currentVersion = await getSessionVersion(db, user.userId);
  if (currentVersion == null || currentVersion !== user.sessionVersion) {
    // Stale (password reset / admin invalidation) or the user was deleted.
    logoutSession(context.session);
    throw redirect('/login');
  }
  return user;
}
