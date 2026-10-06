import {useLoaderData, useNavigate} from 'react-router';
import {Icon} from '~/components/gi/Icon';
import {PH} from '~/components/gi/ui';
import {fetchCollectionCards} from '~/lib/giFragments';
import {HOME_CATEGORIES} from '~/lib/gi';

/* Shopify modela estas familias como "collections" y de ahí sale la URL, pero
   Generando Ideas las llama categorías de cara al cliente. La ruta se queda
   como está; el copy es el que habla de categorías. */
export const meta = () => [
  {title: 'Categorías · Generando Ideas'},
  {
    name: 'description',
    content:
      'Explora nuestras categorías de artículos promocionales: líneas premium, ecológicas y temáticas para campañas B2B en México.',
  },
];

/* Sólo las 8 categorías principales, en el orden del home. Antes listaba
   todas las colecciones de la tienda (hasta 50: tipos, campañas, nuevos…), y
   "Ver todas las categorías" llevaba a una lista que no era la del menú. */
export async function loader({context}) {
  const cards = await fetchCollectionCards(
    context.storefront,
    HOME_CATEGORIES.map((c) => c.handle),
  );
  const porHandle = new Map(cards.map((c) => [c.handle, c]));
  const items = HOME_CATEGORIES.filter((c) => porHandle.has(c.handle)).map((c) => ({
    ...porHandle.get(c.handle),
    title: c.name,
  }));
  return {collections: items};
}

export default function Collections() {
  const {collections} = useLoaderData();
  const navigate = useNavigate();

  return (
    <div className="container" data-screen-label="05 Collections list">
      <div style={{padding: '32px 0 56px'}}>
        <div className="eyebrow">// Categorías</div>
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
          {collections.length > 0 ? (
            <>
              {HOME_CATEGORIES.length} categorías<br />
              <em style={{fontStyle: 'italic', fontWeight: 400, color: 'var(--accent-deep)'}}>
                especializadas
              </em>
              .
            </>
          ) : (
            'Categorías'
          )}
        </h1>
        <p style={{color: 'var(--ink-3)', fontSize: 17, maxWidth: 600}}>
          Cada categoría une calidad, oferta y propósito. Desde nuestras líneas premium
          hasta alternativas 100% ecológicas, encuentra la familia que se ajusta a tu marca.
        </p>
      </div>

      {collections.length === 0 ? (
        <div className="empty" style={{marginBottom: 80}}>
          <Icon name="search" size={32} className="muted-2" />
          <h3>No hay categorías por ahora</h3>
          <p>Vuelve pronto o explora el catálogo completo.</p>
        </div>
      ) : (
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/collections/${c.handle}`);
              }
            }}
            role="button"
            tabIndex={0}
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
                  {c.description?.slice(0, 48) || 'Categoría destacada'}
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
      )}
    </div>
  );
}
