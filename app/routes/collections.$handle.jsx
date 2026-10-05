import {useLoaderData, useNavigate, redirect} from 'react-router';
import {getPaginationVariables, Analytics, Pagination} from '@shopify/hydrogen';
import {Icon} from '~/components/gi/Icon';
import {Button, PH} from '~/components/gi/ui';
import {ProductCard} from '~/components/gi/ProductCard';
import {GI_PRODUCT_CARD_FRAGMENT} from '~/lib/giFragments';
import {normalizeProduct} from '~/lib/gi';
import {getBrandColors, getColorVocabulary} from '~/lib/brand-colors.server';
import {applyCustomerPrices} from '~/lib/pricing.server';
import {brandProductFilters} from '~/lib/brand-colors';

const paginationLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 24px',
  borderRadius: 999,
  border: '1px solid var(--line)',
  background: 'var(--bg-soft)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  letterSpacing: '0.02em',
  color: 'var(--ink)',
};

export const meta = ({data}) => {
  const c = data?.collection;
  const origin = data?.origin ?? '';
  const desc =
    c?.description ||
    `Productos de la colección ${c?.title ?? ''} para campañas y regalos corporativos. Cotiza en línea.`;
  const url = `${origin}/collections/${c?.handle}`;
  return [
    {title: `${c?.title ?? 'Colección'} · Generando Ideas`},
    {name: 'description', content: desc},
    {tagName: 'link', rel: 'canonical', href: url},
    {property: 'og:title', content: `${c?.title ?? 'Colección'} · Generando Ideas`},
    {property: 'og:description', content: desc},
    {property: 'og:type', content: 'website'},
    {property: 'og:url', content: url},
    ...(c?.image?.url ? [{property: 'og:image', content: c.image.url}] : []),
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {'@type': 'ListItem', position: 1, name: 'Inicio', item: `${origin}/`},
          {'@type': 'ListItem', position: 2, name: 'Colecciones', item: `${origin}/collections`},
          {'@type': 'ListItem', position: 3, name: c?.title, item: url},
        ],
      },
    },
  ];
};

export async function loader(args) {
  const {handle} = args.params;
  const {context, request} = args;
  if (!handle) throw redirect('/collections');

  const paginationVariables = getPaginationVariables(request, {pageBy: 24});

  // Un cliente con paleta de marca sólo ve, también aquí, lo que puede pedir
  // en sus colores. El vocabulario va después y no en paralelo porque sólo
  // sirve para expandir esa paleta: sin ella —todo visitante anónimo— pedirlo
  // sería una consulta completa por delante de la de la colección.
  const marca = await getBrandColors(context);
  const familias = marca?.families || [];
  const filters = familias.length
    ? brandProductFilters(familias, await getColorVocabulary(context))
    : null;

  const {collection} = await applyCustomerPrices(
    context,
    await context.storefront.query(COLLECTION_QUERY, {
      variables: {handle, filters, ...paginationVariables},
    }),
  );

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {status: 404});
  }

  return {collection, origin: new URL(request.url).origin};
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
          <Pagination connection={collection.products}>
            {({nodes, isLoading, PreviousLink, NextLink}) => {
              const pageProducts = nodes.map(normalizeProduct).filter(Boolean);
              return (
                <>
                  <div style={{display: 'flex', justifyContent: 'center', marginBottom: 24}}>
                    <PreviousLink style={paginationLinkStyle}>
                      {isLoading ? 'Cargando…' : '↑ Cargar productos anteriores'}
                    </PreviousLink>
                  </div>
                  <div className="product-grid stagger">
                    {pageProducts.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                  <div style={{display: 'flex', justifyContent: 'center', marginTop: 40}}>
                    <NextLink style={paginationLinkStyle}>
                      {isLoading ? 'Cargando…' : 'Cargar más productos ↓'}
                    </NextLink>
                  </div>
                </>
              );
            }}
          </Pagination>
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
    $filters: [ProductFilter!]
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
        filters: $filters
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
