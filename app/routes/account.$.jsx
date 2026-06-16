import {redirect} from 'react-router';
import {requireUser} from '~/lib/auth/guard';

// fallback wild card for all unauthenticated routes in the account section
/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  await requireUser(context);
  return redirect('/account');
}

/** @typedef {import('./+types/account.$').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
