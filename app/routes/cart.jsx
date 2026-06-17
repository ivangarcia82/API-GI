import {redirect} from 'react-router';

/**
 * Quote-only storefront: there is no purchasable cart or checkout. Products are
 * added to the quote drawer (see QuoteDrawer / /api/quote). This route is kept
 * only to neutralize the old `/cart` URL by redirecting to the catalog.
 * @type {Route.MetaFunction}
 */
export const meta = () => [{title: 'Catálogo · Generando Ideas'}];

export async function loader() {
  return redirect('/catalogo');
}

export default function Cart() {
  return null;
}

/** @typedef {import('./+types/cart').Route} Route */
