// Static sitemap for the Astro-ported marketing routes (home, about,
// services, blog, careers, contact). These aren't Shopify resources, so they
// can't be produced by `getSitemap`/`getSitemapIndex` — instead this route
// hand-builds a urlset from `~/lib/site-content`, the single source of truth
// for marketing ids. Linked from `[sitemap.xml].jsx` via `customChildSitemaps`.
import {BLOG_POSTS, JOBS, SERVICE_DETAIL_IDS} from '~/lib/site-content';

const STATIC_PATHS = ['/', '/conocenos', '/servicios', '/blog', '/bolsa-de-trabajo', '/contacto'];

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({request}) {
  const {origin} = new URL(request.url);

  const paths = [
    ...STATIC_PATHS,
    ...SERVICE_DETAIL_IDS.map((id) => `/servicios/${id}`),
    ...BLOG_POSTS.map((post) => `/blog/${post.id}`),
    ...JOBS.map((job) => `/bolsa-de-trabajo/${job.id}`),
  ];

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join('\n') +
    '\n</urlset>';

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}

/** @typedef {import('./+types/[sitemap-marketing.xml]').Route} Route */
