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
    options { name optionValues { name } }
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
      products(first: 1) {
        nodes { featuredImage { url altText } }
      }
    }
  }
`;

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
    image: c.image?.url || c.products?.nodes?.[0]?.featuredImage?.url || null,
  }));
}
