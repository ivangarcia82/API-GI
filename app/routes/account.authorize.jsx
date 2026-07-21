import {redirect} from 'react-router';
import {requireUser} from '~/lib/auth/guard';

// Standard Shopify route kept for platform compatibility. It is the OAuth
// callback for Shopify's Customer Account API, which this store does not use
// (auth is custom, libsql-backed). Behaves like the /account catch-all.
/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  await requireUser(context);
  return redirect('/account');
}

/** @typedef {import('./+types/account.authorize').Route} Route */
