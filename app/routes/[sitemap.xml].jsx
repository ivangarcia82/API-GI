import {getSitemapIndex} from '@shopify/hydrogen';

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({request, context: {storefront}}) {
  const response = await getSitemapIndex({
    storefront,
    request,
    // This store has no /pages or /blogs routes (the child sitemap 404s for them),
    // so keep the index to the resource types that actually resolve.
    types: ['products', 'collections'],
  });

  response.headers.set('Cache-Control', `max-age=${60 * 60 * 24}`);

  return response;
}

/** @typedef {import('./+types/[sitemap.xml]').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
