import {useLoaderData} from 'react-router';

/**
 * Standard Shopify CMS page route (Online Store → Pages). Lets marketing
 * publish pages from the Shopify admin without code changes.
 * @type {Route.MetaFunction}
 */
export const meta = ({data}) => {
  return [{title: `${data?.page.seo?.title ?? data?.page.title ?? 'Página'} · Generando Ideas`}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({params, context}) {
  if (!params.pageHandle) {
    throw new Response('No page handle was passed in', {status: 404});
  }

  const data = await context.storefront.query(PAGE_QUERY, {
    variables: {
      handle: params.pageHandle,
      language: context.storefront.i18n?.language,
    },
  });

  if (!data?.page) {
    throw new Response('Could not find the page', {status: 404});
  }

  return {page: data.page};
}

export default function Page() {
  /** @type {LoaderReturnData} */
  const {page} = useLoaderData();

  return (
    <div className="container policy" style={{padding: '40px 0 80px', maxWidth: 760}}>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 'clamp(32px, 5vw, 48px)',
          letterSpacing: '-0.02em',
          margin: '0 0 24px',
        }}
      >
        {page.title}
      </h1>
      <div dangerouslySetInnerHTML={{__html: page.body}} />
    </div>
  );
}

const PAGE_QUERY = `#graphql
  query GiPage($language: LanguageCode, $country: CountryCode, $handle: String!)
    @inContext(language: $language, country: $country) {
    page(handle: $handle) {
      id
      title
      body
      seo {
        description
        title
      }
    }
  }
`;

/** @typedef {import('./+types/pages.$pageHandle').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
