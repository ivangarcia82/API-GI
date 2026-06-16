import {redirect} from 'react-router';
import {assertSameOrigin} from '~/lib/http/csrf';

/**
 * @param {import('./+types/auth.logout').Route.ActionArgs} args
 */
export async function action({request, context}) {
  assertSameOrigin(request);
  // destroy() (not unset) emits a Set-Cookie that expires the cookie.
  await context.session.destroy();
  return redirect('/');
}

// GET /auth/logout should not act; bounce to home.
export async function loader() {
  return redirect('/');
}
