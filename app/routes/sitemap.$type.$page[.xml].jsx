import {getSitemap} from '@shopify/hydrogen';

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({request, params, context: {storefront}}) {
  // This store no longer ships /pages or /blogs routes — don't emit sitemaps
  // whose URLs would 404.
  if (params.type === 'pages' || params.type === 'articles') {
    throw new Response('Not found', {status: 404});
  }

  const response = await getSitemap({
    storefront,
    request,
    params,
    // Single-locale store (es-MX); no locale-prefixed URLs.
    locales: [],
    getLink: ({type, baseUrl, handle}) => `${baseUrl}/${type}/${handle}`,
  });

  response.headers.set('Cache-Control', `max-age=${60 * 60 * 24}`);

  return response;
}

/** @typedef {import('./+types/sitemap.$type.$page[.xml]').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
