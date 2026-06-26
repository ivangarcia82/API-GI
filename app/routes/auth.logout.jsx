import {redirect} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';

/**
 * @param {import('./+types/auth.logout').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);
  // destroy() returns the Set-Cookie that EXPIRES the cookie. It does NOT flip
  // isPending, so server.js won't emit it for us — we must attach it ourselves,
  // otherwise the session cookie survives and the user stays logged in.
  const expiredCookie = await context.session.destroy();
  return redirect('/', {headers: {'Set-Cookie': expiredCookie}});
}

// GET /auth/logout should not act; bounce to home.
export async function loader() {
  return redirect('/');
}
