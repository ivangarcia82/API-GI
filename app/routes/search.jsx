import {redirect} from 'react-router';
import {getEmptyPredictiveSearchResult} from '~/lib/search';
import {getBrandColors} from '~/lib/brand-colors.server';
import {applyCustomerPrices} from '~/lib/pricing.server';
import {keepBrandProducts} from '~/lib/brand-colors';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: `Buscar · Generando Ideas`}];
};

/**
 * /search sólo atiende al buscador instantáneo (`?predictive`).
 *
 * La búsqueda completa vive en el catálogo: /catalogo?q=… enseña los mismos
 * resultados con las tarjetas, los filtros y el orden del sitio. Aquí había
 * una página de resultados aparte —la lista sin estilo de la plantilla base—
 * y cualquier enlace viejo a ella se manda al catálogo con su término.
 * @param {Route.LoaderArgs}
 */
export async function loader({request, context}) {
  const url = new URL(request.url);
  if (!url.searchParams.has('predictive')) {
    const q = String(url.searchParams.get('q') || '').trim();
    throw redirect(q ? `/catalogo?${new URLSearchParams({q})}` : '/catalogo');
  }

  try {
    return await predictiveSearch({request, context});
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/* Sin pantalla propia: el modal de búsqueda consume el loader con un fetcher
   y pinta los resultados encima de la página en la que esté el usuario. */
export default function SearchPage() {
  return null;
}

/**
 * Predictive search query and fragments
 * (adjust as needed)
 */
const PREDICTIVE_SEARCH_ARTICLE_FRAGMENT = `#graphql
  fragment PredictiveArticle on Article {
    __typename
    id
    title
    handle
    blog {
      handle
    }
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
`;

const PREDICTIVE_SEARCH_COLLECTION_FRAGMENT = `#graphql
  fragment PredictiveCollection on Collection {
    __typename
    id
    title
    handle
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
`;

const PREDICTIVE_SEARCH_PAGE_FRAGMENT = `#graphql
  fragment PredictivePage on Page {
    __typename
    id
    title
    handle
    trackingParameters
  }
`;

const PREDICTIVE_SEARCH_PRODUCT_FRAGMENT = `#graphql
  fragment PredictiveProduct on Product {
    __typename
    id
    title
    handle
    trackingParameters
    featuredImage { url altText width height }
    selectedOrFirstAvailableVariant(
      selectedOptions: []
      ignoreUnknownOptions: true
      caseInsensitiveMatch: true
    ) {
      id
      image {
        url
        altText
        width
        height
      }
      price {
        amount
        currencyCode
      }
    }
    options { name optionValues { name } }
  }
`;

const PREDICTIVE_SEARCH_QUERY_FRAGMENT = `#graphql
  fragment PredictiveQuery on SearchQuerySuggestion {
    __typename
    text
    styledText
    trackingParameters
  }
`;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/predictiveSearch
const PREDICTIVE_SEARCH_QUERY = `#graphql
  query PredictiveSearch(
    $country: CountryCode
    $language: LanguageCode
    $limit: Int!
    $limitScope: PredictiveSearchLimitScope!
    $term: String!
    $types: [PredictiveSearchType!]
  ) @inContext(country: $country, language: $language) {
    predictiveSearch(
      limit: $limit,
      limitScope: $limitScope,
      query: $term,
      types: $types,
    ) {
      articles {
        ...PredictiveArticle
      }
      collections {
        ...PredictiveCollection
      }
      pages {
        ...PredictivePage
      }
      products {
        ...PredictiveProduct
      }
      queries {
        ...PredictiveQuery
      }
    }
  }
  ${PREDICTIVE_SEARCH_ARTICLE_FRAGMENT}
  ${PREDICTIVE_SEARCH_COLLECTION_FRAGMENT}
  ${PREDICTIVE_SEARCH_PAGE_FRAGMENT}
  ${PREDICTIVE_SEARCH_PRODUCT_FRAGMENT}
  ${PREDICTIVE_SEARCH_QUERY_FRAGMENT}
`;

/**
 * Predictive search fetcher
 * @param {Pick<
 *   Route.ActionArgs,
 *   'request' | 'context'
 * >}
 * @return {Promise<PredictiveSearchReturn>}
 */
async function predictiveSearch({request, context}) {
  const {storefront} = context;
  const url = new URL(request.url);
  const term = String(url.searchParams.get('q') || '').trim();
  const limit = Number(url.searchParams.get('limit') || 10);
  const type = 'predictive';

  if (!term) return {type, term, result: getEmptyPredictiveSearchResult()};

  // Predictively search articles, collections, pages, products, and queries
  // (suggestions). getBrandColors sale en el mismo Promise.all: esta ruta se
  // dispara en cada tecleo desde el modal de búsqueda, no hay loader de root
  // que corra a la par (es un fetcher contra /search) y con caché fría es un
  // round trip íntegro al Admin API que no se puede permitir en serie.
  const [{predictiveSearch: items, errors}, marca] = await Promise.all([
    storefront
      .query(PREDICTIVE_SEARCH_QUERY, {
        variables: {
          // customize search options as needed
          limit,
          limitScope: 'EACH',
          term,
        },
      })
      .then((r) => applyCustomerPrices(context, r)),
    getBrandColors(context),
  ]);

  if (errors) {
    throw new Error(
      `Shopify API errors: ${errors.map(({message}) => message).join(', ')}`,
    );
  }

  if (!items) {
    throw new Error('No predictive search data returned from Shopify API');
  }

  // predictiveSearch no acepta productFilters: el recorte por paleta se hace
  // aquí, sobre una lista de 6-10 elementos que ya trae sus colores.
  const filtrados = {
    ...items,
    products: keepBrandProducts(items.products || [], marca?.families || []),
  };

  const total = Object.values(filtrados).reduce((acc, item) => acc + item.length, 0);

  return {type, term, result: {items: filtrados, total}};
}

/** @typedef {import('./+types/search').Route} Route */
/** @typedef {import('~/lib/search').PredictiveSearchReturn} PredictiveSearchReturn */
/** @typedef {import('storefrontapi.generated').PredictiveSearchQuery} PredictiveSearchQuery */
