import {useLoaderData, useNavigate, redirect} from 'react-router';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {Icon} from '~/components/gi/Icon';
import {Button, PH} from '~/components/gi/ui';
import {ProductCard} from '~/components/gi/ProductCard';
import {GI_PRODUCT_CARD_FRAGMENT} from '~/lib/giFragments';
import {normalizeProduct} from '~/lib/gi';

export const meta = ({data}) => {
  const c = data?.collection;
  const desc =
    c?.description ||
    `Productos de la colección ${c?.title ?? ''} para campañas y regalos corporativos. Cotiza en línea.`;
  return [
    {title: `${c?.title ?? 'Colección'} · Generando Ideas`},
    {name: 'description', content: desc},
  ];
};

export async function loader(args) {
  const {handle} = args.params;
  const {context, request} = args;
  if (!handle) throw redirect('/collections');

  const paginationVariables = getPaginationVariables(request, {pageBy: 24});
  const {collection} = await context.storefront.query(COLLECTION_QUERY, {
    variables: {handle, ...paginationVariables},
  });

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {status: 404});
  }

  return {collection};
}

export default function Collection() {
  const {collection} = useLoaderData();
  const navigate = useNavigate();
  const products = (collection.products?.nodes || [])
    .map(normalizeProduct)
    .filter(Boolean);
  const heroImage = collection.image?.url || products[0]?.image || null;

  return (
    <div className="container" data-screen-label={`05b Collection: ${collection.title}`}>
      <div style={{padding: '32px 0 12px'}}>
        <button
          onClick={() => navigate('/collections')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          <span style={{transform: 'rotate(180deg)', display: 'inline-flex'}}>
            <Icon name="arrow_right" size={12} />
          </span>
          Volver a colecciones
        </button>
      </div>

      <div className="coll-hero">
        <div>
          <div className="eyebrow">// Colección</div>
          <h1>{collection.title}</h1>
          <p style={{marginTop: 24}}>
            {collection.description ||
              'Una línea cuidadosamente seleccionada por nuestro equipo creativo para maximizar impacto y minimizar desperdicio.'}
          </p>
          <div className="coll-hero-meta">
            <div>
              <div className="n ticker">{products.length}+</div>
              <div className="l">Productos</div>
            </div>
            <div>
              <div className="n ticker">8–12d</div>
              <div className="l">Producción</div>
            </div>
          </div>
        </div>
        <div style={{borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)'}}>
          <PH src={heroImage} alt={collection.title} aspect="ph-square" zoom />
        </div>
      </div>

      <div style={{padding: '40px 0 80px'}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 32,
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Productos de la colección
          </h2>
          <span className="cat-results-meta">{products.length} productos</span>
        </div>
        {products.length === 0 ? (
          <div className="empty">
            <Icon name="search" size={32} className="muted-2" />
            <h3>Aún no hay productos en esta colección</h3>
            <p>Explora el catálogo completo mientras la preparamos.</p>
            <Button variant="accent" iconRight="arrow_right" onClick={() => navigate('/catalogo')}>
              Ver catálogo
            </Button>
          </div>
        ) : (
          <div className="product-grid stagger">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>

      <Analytics.CollectionView
        data={{collection: {id: collection.id, handle: collection.handle}}}
      />
    </div>
  );
}

const COLLECTION_QUERY = `#graphql
  ${GI_PRODUCT_CARD_FRAGMENT}
  query GiCollection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image { url altText width height }
      products(
        first: $first
        last: $last
        before: $startCursor
        after: $endCursor
      ) {
        nodes { ...GiProductCard }
        pageInfo { hasPreviousPage hasNextPage startCursor endCursor }
      }
    }
  }
`;
