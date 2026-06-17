import {redirect} from 'react-router';

/**
 * Quote-only storefront: the cart/checkout deep-link is disabled. Any
 * `/cart/<variant>:<qty>` link funnels shoppers back into the catalog so they
 * build a quote instead of going to a Shopify checkout.
 * @param {Route.LoaderArgs}
 */
export async function loader() {
  return redirect('/catalogo');
}

export default function Component() {
  return null;
}

/** @typedef {import('./+types/cart.$lines').Route} Route */
