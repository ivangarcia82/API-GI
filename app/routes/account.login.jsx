import {redirect} from 'react-router';
import {requireUser} from '~/lib/auth/guard';

// Standard Shopify route kept for platform compatibility. This store uses its
// own auth at /login: anonymous visitors are sent there by requireUser; an
// already-authenticated user lands on their account.
/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  await requireUser(context);
  return redirect('/account');
}

/** @typedef {import('./+types/account.login').Route} Route */
