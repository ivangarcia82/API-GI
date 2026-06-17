import {redirect} from 'react-router';

/**
 * The "all products" grid is consolidated into /catalogo (quote-only model;
 * no public price grid). Redirect any /collections/all hits there.
 * @param {Route.LoaderArgs}
 */
export async function loader() {
  return redirect('/catalogo');
}

export default function Component() {
  return null;
}

/** @typedef {import('./+types/collections.all').Route} Route */
