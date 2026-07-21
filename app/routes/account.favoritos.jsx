import {useLoaderData, useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';
import {ProductCard} from '~/components/gi/ProductCard';
import {getDb} from '~/lib/db/client';
import {requireUser} from '~/lib/auth/guard';
import {listWishlist} from '~/lib/wishlist/repo';
import {normalizeProduct} from '~/lib/gi';

const FAVORITOS_QUERY = `#graphql
  query FavoritosNodes($ids: [ID!]!, $country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    nodes(ids: $ids) {
      __typename
      ... on Product {
        id
        handle
        title
        featuredImage { url altText width height }
        priceRange { minVariantPrice { amount currencyCode } }
        variants(first: 1) { nodes { id } }
      }
    }
  }
`;

/**
 * Keep only the non-null Product nodes returned by `nodes(ids:)`.
 * @param {Array<{__typename?: string} | null> | null | undefined} nodes
 * @returns {Array<object>}
 */
export function keepProducts(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.filter((n) => n && n.__typename === 'Product');
}

/**
 * @param {import('react-router').LoaderFunctionArgs & {context: any}} args
 */
export async function loader({context}) {
  const {userId} = await requireUser(context);
  const db = getDb(context.env);
  const ids = await listWishlist(db, userId);
  if (ids.length === 0) return {products: []};
  const {nodes} = await context.storefront.query(FAVORITOS_QUERY, {
    variables: {ids},
  });
  const products = keepProducts(nodes)
    .map((node) => normalizeProduct(node))
    .filter(Boolean);
  return {products};
}

export default function AccountFavoritos() {
  const navigate = useNavigate();
  const {products} = useLoaderData();

  return (
    <>
      <h1>Favoritos</h1>
      <p style={{color: 'var(--ink-3)', margin: '-8px 0 0'}}>
        Productos que guardaste para revisar o cotizar más tarde.
      </p>

      {products.length === 0 ? (
        <div className="empty">
          <Icon name="heart_outline" size={32} className="muted-2" />
          <h3>Aún no tienes favoritos</h3>
          <p>Marca el corazón en cualquier producto para guardarlo aquí.</p>
          <Button
            variant="accent"
            iconRight="arrow_right"
            onClick={() => navigate('/catalogo')}
          >
            Explorar catálogo
          </Button>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </>
  );
}
