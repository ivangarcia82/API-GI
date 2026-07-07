import {useLoaderData, useSearchParams, useNavigate} from 'react-router';
import {useState} from 'react';
import {getPaginationVariables, Pagination} from '@shopify/hydrogen';
import {Icon} from '~/components/gi/Icon';
import {Button} from '~/components/gi/ui';
import {ProductCard} from '~/components/gi/ProductCard';
import {
  GI_PRODUCTS_QUERY,
  GI_COLLECTION_PRODUCTS_QUERY,
} from '~/lib/giFragments';
import {normalizeProduct, HOME_CATEGORIES, FEATURED_COLLECTIONS, colorHex} from '~/lib/gi';

export const meta = () => [
  {title: 'Catálogo · Generando Ideas'},
  {
    name: 'description',
    content:
      'Catálogo de artículos promocionales y regalos corporativos personalizables. Filtra por categoría, color y precio, y cotiza en línea.',
  },
];

const SORTS = {
  relevance: {global: ['RELEVANCE', false], collection: ['COLLECTION_DEFAULT', false]},
  bestseller: {global: ['BEST_SELLING', false], collection: ['BEST_SELLING', false]},
  new: {global: ['CREATED_AT', true], collection: ['CREATED', true]},
  'price-asc': {global: ['PRICE', false], collection: ['PRICE', false]},
  'price-desc': {global: ['PRICE', true], collection: ['PRICE', true]},
};

const EMPTY_CONNECTION = {nodes: [], pageInfo: {hasNextPage: false, hasPreviousPage: false}};

export async function loader({context, request}) {
  const {storefront} = context;
  const url = new URL(request.url);
  const cat = url.searchParams.get('cat') || '';
  const q = url.searchParams.get('q') || '';
  const sort = url.searchParams.get('sort') || 'relevance';
  const sortDef = SORTS[sort] || SORTS.relevance;
  const paginationVariables = getPaginationVariables(request, {pageBy: 24});

  let products = EMPTY_CONNECTION;
  let title = 'Todos los productos';

  if (cat) {
    const [sortKey, reverse] = sortDef.collection;
    const res = await storefront
      .query(GI_COLLECTION_PRODUCTS_QUERY, {
        variables: {handle: cat, sortKey, reverse, ...paginationVariables},
      })
      .catch(() => null);
    const coll = res?.collection;
    title = coll?.title || cat;
    products = coll?.products || EMPTY_CONNECTION;
  } else {
    const [sortKeyRel, reverse] = sortDef.global;
    // RELEVANCE only valid with a query; fall back to BEST_SELLING otherwise
    const sortKey = sortKeyRel === 'RELEVANCE' && !q ? 'BEST_SELLING' : sortKeyRel;
    const res = await storefront
      .query(GI_PRODUCTS_QUERY, {
        variables: {query: q || undefined, sortKey, reverse, ...paginationVariables},
      })
      .catch(() => null);
    products = res?.products || EMPTY_CONNECTION;
    title = q ? `Resultados · “${q}”` : 'Todos los productos';
  }

  return {products, title, cat, q, sort};
}

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

export default function Catalogo() {
  const data = useLoaderData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState(data.q || '');
  const [priceRange, setPriceRange] = useState([0, 5000]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, {preventScrollReset: true});
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (search) next.set('q', search);
    else next.delete('q');
    next.delete('cat'); // free search spans whole catalog
    setParams(next, {preventScrollReset: true});
  };

  // Client-side price refinement runs over the accumulated paginated nodes.
  const priceFilter = (p) =>
    p.price == null || (p.price >= priceRange[0] && p.price <= priceRange[1]);

  return (
    <div className="container" data-screen-label="04 Catalog">
      <div style={{padding: '32px 0 16px'}}>
        <div className="eyebrow">// Catálogo · /catalogo</div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 'clamp(40px, 6vw, 80px)',
            letterSpacing: '-0.035em',
            lineHeight: 0.95,
            margin: '12px 0 8px',
          }}
        >
          {data.title}
        </h1>
        <p style={{color: 'var(--ink-3)', margin: 0, fontSize: 16}}>
          Explora nuestro inventario completo. Filtra por categoría, busca por SKU o
          ajusta el rango de precio.
        </p>
      </div>

      <div className="cat-page">
        <aside className="cat-sidebar">
          <div className="cat-filter-group">
            <h4>
              Categorías
              {(data.cat || data.q) && (
                <button
                  onClick={() => navigate('/catalogo')}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--accent-deep)',
                    textDecoration: 'underline',
                    textTransform: 'none',
                  }}
                >
                  reset
                </button>
              )}
            </h4>
            <div className="cat-filter-list">
              <button
                onClick={() => setParam('cat', '')}
                className={!data.cat ? 'active' : ''}
              >
                <span>Todas</span>
              </button>
              {HOME_CATEGORIES.map((c) => (
                <button
                  key={c.handle}
                  onClick={() => setParam('cat', c.handle)}
                  className={data.cat === c.handle ? 'active' : ''}
                >
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="cat-filter-group">
            <h4>Colecciones</h4>
            <div className="cat-tags">
              {FEATURED_COLLECTIONS.map((handle) => (
                <button
                  key={handle}
                  className={`cat-tag-btn ${data.cat === handle ? 'active' : ''}`}
                  onClick={() => setParam('cat', handle)}
                >
                  {handle.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="cat-filter-group">
            <h4>Color</h4>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
              {['Negro', 'Blanco', 'Azul', 'Rojo', 'Verde', 'Amarillo', 'Gris', 'Plata'].map(
                (c) => (
                  <button
                    key={c}
                    title={c}
                    onClick={() => {
                      setSearch(c);
                      setParam('q', c);
                    }}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: colorHex(c),
                      border: '2px solid var(--bg)',
                      boxShadow: '0 0 0 1px var(--line)',
                      cursor: 'pointer',
                    }}
                  />
                ),
              )}
            </div>
          </div>

          <div className="cat-filter-group">
            <h4>Rango de precio</h4>
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <input
                type="number"
                className="input"
                value={priceRange[0]}
                onChange={(e) => setPriceRange([+e.target.value, priceRange[1]])}
                style={{padding: '8px 10px', fontSize: 13}}
              />
              <span style={{color: 'var(--ink-4)'}}>—</span>
              <input
                type="number"
                className="input"
                value={priceRange[1]}
                onChange={(e) => setPriceRange([priceRange[0], +e.target.value])}
                style={{padding: '8px 10px', fontSize: 13}}
              />
            </div>
            <span className="help-msg">MXN · sin IVA</span>
          </div>
        </aside>

        <div>
          <Pagination connection={data.products}>
            {({nodes, isLoading, PreviousLink, NextLink, hasNextPage, hasPreviousPage}) => {
              const visible = nodes
                .map(normalizeProduct)
                .filter(Boolean)
                .filter(priceFilter);
              return (
                <>
                  <div className="cat-toolbar">
                    <form className="cat-search" onSubmit={submitSearch}>
                      <Icon name="search" size={14} />
                      <input
                        placeholder="Buscar producto, SKU o categoría…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </form>
                    <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                      <span className="cat-results-meta">{visible.length} productos</span>
                      <select
                        className="input"
                        value={data.sort}
                        onChange={(e) => setParam('sort', e.target.value)}
                        style={{padding: '10px 14px', fontSize: 13, borderRadius: 999, fontWeight: 500}}
                      >
                        <option value="relevance">Relevancia</option>
                        <option value="bestseller">Más vendidos</option>
                        <option value="new">Nuevos primero</option>
                        <option value="price-asc">Precio: menor a mayor</option>
                        <option value="price-desc">Precio: mayor a menor</option>
                      </select>
                      <div className="cat-view-toggle">
                        <button
                          className={view === 'grid' ? 'active' : ''}
                          onClick={() => setView('grid')}
                          aria-label="Vista cuadrícula"
                        >
                          <Icon name="grid" size={14} />
                        </button>
                        <button
                          className={view === 'list' ? 'active' : ''}
                          onClick={() => setView('list')}
                          aria-label="Vista lista"
                        >
                          <Icon name="list" size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {hasPreviousPage && (
                    <div style={{display: 'flex', justifyContent: 'center', marginBottom: 24}}>
                      <PreviousLink style={paginationLinkStyle}>
                        {isLoading ? 'Cargando…' : '↑ Cargar anteriores'}
                      </PreviousLink>
                    </div>
                  )}

                  {visible.length === 0 ? (
                    <div className="empty">
                      <Icon name="search" size={32} className="muted-2" />
                      <h3>Sin resultados</h3>
                      <p>Intenta con otros filtros o palabras de búsqueda.</p>
                      <Button variant="ghost" onClick={() => navigate('/catalogo')}>
                        Limpiar filtros
                      </Button>
                    </div>
                  ) : view === 'grid' ? (
                    <div className="product-grid stagger">
                      {visible.map((p) => (
                        <ProductCard key={p.id} product={p} />
                      ))}
                    </div>
                  ) : (
                    <div className="product-list stagger">
                      {visible.map((p) => (
                        <ProductCard key={p.id} product={p} view="list" />
                      ))}
                    </div>
                  )}

                  {hasNextPage && (
                    <div style={{display: 'flex', justifyContent: 'center', marginTop: 40}}>
                      <NextLink style={paginationLinkStyle}>
                        {isLoading ? 'Cargando…' : 'Cargar más productos ↓'}
                      </NextLink>
                    </div>
                  )}
                </>
              );
            }}
          </Pagination>
        </div>
      </div>
    </div>
  );
}
