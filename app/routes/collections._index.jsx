import {useLoaderData, useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {PH} from '~/components/gi/ui';

export const meta = () => [{title: 'Colecciones · Generando Ideas'}];

export async function loader({context}) {
  const {collections} = await context.storefront.query(COLLECTIONS_QUERY);
  const items = (collections?.nodes || []).map((c) => ({
    id: c.id,
    handle: c.handle,
    title: c.title,
    description: c.description,
    image: c.image?.url || c.products?.nodes?.[0]?.featuredImage?.url || null,
  }));
  return {collections: items};
}

export default function Collections() {
  const {collections} = useLoaderData();
  const navigate = useNavigate();

  return (
    <div className="container" data-screen-label="05 Collections list">
      <div style={{padding: '32px 0 56px'}}>
        <div className="eyebrow">// Colecciones · /colecciones</div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(48px, 7vw, 96px)',
            letterSpacing: '-0.035em',
            lineHeight: 0.95,
            margin: '12px 0 16px',
            maxWidth: 900,
          }}
        >
          {collections.length} colecciones curadas<br />
          para campañas{' '}
          <em style={{fontStyle: 'italic', fontWeight: 400, color: 'var(--accent-deep)'}}>
            precisas
          </em>
          .
        </h1>
        <p style={{color: 'var(--ink-3)', fontSize: 17, maxWidth: 600}}>
          Cada colección une calidad, oferta y propósito. Desde nuestras líneas premium
          hasta alternativas 100% ecológicas, encuentra la familia que se ajusta a tu marca.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          paddingBottom: 80,
        }}
        className="collections-grid stagger"
      >
        {collections.map((c, i) => (
          <div
            key={c.id}
            className="coll-card"
            onClick={() => navigate(`/collections/${c.handle}`)}
            style={{minHeight: 420}}
          >
            <div className="coll-card-img">
              <PH src={c.image} alt={c.title} className="ph-square" zoom />
              <div className="coll-card-tag">// {String(i + 1).padStart(2, '0')}</div>
            </div>
            <div className="coll-card-info">
              <div>
                <div className="coll-card-name">{c.title}</div>
                <div className="coll-card-meta">
                  {c.description?.slice(0, 48) || 'Colección curada'}
                </div>
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'var(--bg-soft)',
                  color: 'var(--ink)',
                }}
              >
                <Icon name="arrow_up_right" size={14} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const COLLECTIONS_QUERY = `#graphql
  query GiStoreCollections($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 50, sortKey: TITLE) {
      nodes {
        id
        title
        handle
        description
        image { url altText }
        products(first: 1) { nodes { featuredImage { url altText } } }
      }
    }
  }
`;
