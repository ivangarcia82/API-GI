import {redirect} from 'react-router';
import {requireUser} from '~/lib/auth/guard';

// Standard Shopify route kept for platform compatibility. This is a
// quote-based B2B store with no checkout, so there are no Shopify orders to
// show; the closest equivalent is the customer's quote history.
/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  await requireUser(context);
  return redirect('/account/cotizaciones');
}

/** @typedef {import('./+types/account.orders.$orderId').Route} Route */
