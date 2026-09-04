/* Generando Ideas — shared Storefront API fragments + helpers */

/** Fields needed to render a ProductCard. */
export const GI_PRODUCT_CARD_FRAGMENT = `#graphql
  fragment GiProductCard on Product {
    id
    handle
    title
    description
    tags
    featuredImage { id url altText width height }
    priceRange { minVariantPrice { amount currencyCode } }
    # firstSelectableVariant es lo que permite cotizar en el color de la marca
    # del cliente: variants(first: 1), abajo, devuelve una variante cualquiera,
    # que puede ser de un color que ese cliente no puede pedir.
    options {
      name
      optionValues { name firstSelectableVariant { id } }
    }
    variants(first: 1) {
      nodes {
        id
        title
        sku
        availableForSale
        price { amount currencyCode }
        image { url altText }
      }
    }
    metafields(identifiers: [
      {namespace: "custom", key: "tecnicas_de_impresion"},
      {namespace: "custom", key: "material"}
    ]) { key namespace value }
  }
`;

/** A list of products (catalog / collection / recommended). */
export const GI_PRODUCTS_QUERY = `#graphql
  ${GI_PRODUCT_CARD_FRAGMENT}
  query GiProducts(
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $query: String
    $sortKey: ProductSortKeys
    $reverse: Boolean
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    products(
      first: $first
      last: $last
      before: $startCursor
      after: $endCursor
      query: $query
      sortKey: $sortKey
      reverse: $reverse
    ) {
      nodes { ...GiProductCard }
      pageInfo { hasPreviousPage hasNextPage startCursor endCursor }
    }
  }
`;

/** Products within a collection (catalog category view + collection page). */
export const GI_COLLECTION_PRODUCTS_QUERY = `#graphql
  ${GI_PRODUCT_CARD_FRAGMENT}
  query GiCollectionProducts(
    $handle: String!
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image { url altText }
      products(
        first: $first
        last: $last
        before: $startCursor
        after: $endCursor
        sortKey: $sortKey
        reverse: $reverse
      ) {
        nodes { ...GiProductCard }
        pageInfo { hasPreviousPage hasNextPage startCursor endCursor }
      }
    }
  }
`;

/**
 * Búsqueda facetada del catálogo.
 *
 * Es el único endpoint de la Storefront API que acepta texto libre Y facetas a
 * la vez: `products(query:)` no admite `filters` y `collection.products` no
 * admite texto. `productFilters` devuelve las facetas recalculadas sobre el
 * resultado actual, con sus conteos, y `totalCount` el total real (no el de la
 * página).
 */
export const GI_CATALOG_SEARCH_QUERY = `#graphql
  ${GI_PRODUCT_CARD_FRAGMENT}
  query GiCatalogSearch(
    $query: String!
    $productFilters: [ProductFilter!]
    $sortKey: SearchSortKeys
    $reverse: Boolean
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    search(
      query: $query
      types: PRODUCT
      productFilters: $productFilters
      sortKey: $sortKey
      reverse: $reverse
      first: $first
      last: $last
      before: $startCursor
      after: $endCursor
      unavailableProducts: LAST
    ) {
      totalCount
      productFilters {
        id
        label
        type
        values { id label count input }
      }
      nodes { ...GiProductCard }
      pageInfo { hasPreviousPage hasNextPage startCursor endCursor }
    }
  }
`;

/** Related products for the PDP "Productos similares" section. */
export const GI_PRODUCT_RECOMMENDATIONS_QUERY = `#graphql
  ${GI_PRODUCT_CARD_FRAGMENT}
  query GiProductRecommendations(
    $productId: ID!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    productRecommendations(productId: $productId, intent: RELATED) {
      ...GiProductCard
    }
  }
`;

/** A single collection card (handle, title, image, sample product image). */
export const GI_COLLECTION_CARD_QUERY = `#graphql
  query GiCollectionCard($handle: String!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image { url altText }
      products(first: 10) {
        nodes { featuredImage { url altText } }
      }
    }
  }
`;

/**
 * Pick the best-effort image URL for a collection card: the collection's own
 * image if set, otherwise the featuredImage of the first sampled product that
 * actually has one (this store has collections with no image set, and the
 * very first product in a collection isn't guaranteed to have an image
 * either — see the "hide products with no image" rule in normalizeProduct).
 * Pure/no network — shared by fetchCollectionCards and collections._index.jsx.
 * @param {{image?: {url?: string|null}|null, products?: {nodes?: Array<{featuredImage?: {url?: string|null}|null}>}}} collection
 * @returns {string|null}
 */
export function pickCollectionImage(collection) {
  if (!collection) return null;
  if (collection.image?.url) return collection.image.url;
  const nodes = collection.products?.nodes || [];
  const withImage = nodes.find((n) => n?.featuredImage?.url);
  return withImage?.featuredImage?.url || null;
}

/**
 * Fetch several collection cards in parallel. Returns one entry per handle
 * (nulls filtered out), each carrying a best-effort image (collection image
 * or first product image, since this store's collections have no image set).
 */
export async function fetchCollectionCards(storefront, handles) {
  const results = await Promise.all(
    handles.map((handle) =>
      storefront
        .query(GI_COLLECTION_CARD_QUERY, {variables: {handle}})
        .then((r) => r?.collection)
        .catch(() => null),
    ),
  );
  return results.filter(Boolean).map((c) => ({
    id: c.id,
    handle: c.handle,
    title: c.title,
    description: c.description,
    image: pickCollectionImage(c),
  }));
}

/* Ruta estricta de la categoría. `search(query:"tag:...")` no filtra —sólo pesa
   en la relevancia— así que la categoría se resuelve por colección, que sí
   respeta el filtro. A cambio no acepta texto libre ni expone un total. */
export const GI_CATALOG_COLLECTION_QUERY = `#graphql
  ${GI_PRODUCT_CARD_FRAGMENT}
  query GiCatalogCollection(
    $handle: String!
    $productFilters: [ProductFilter!]
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      handle
      title
      products(
        filters: $productFilters
        sortKey: $sortKey
        reverse: $reverse
        first: $first
        last: $last
        before: $startCursor
        after: $endCursor
      ) {
        filters {
          id
          label
          type
          values { id label count input }
        }
        nodes { ...GiProductCard }
        pageInfo { hasPreviousPage hasNextPage startCursor endCursor }
      }
    }
  }
`;
