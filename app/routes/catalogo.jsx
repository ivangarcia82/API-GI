import {useLoaderData, useSearchParams, useNavigate, useNavigation} from 'react-router';
import {useCallback, useEffect, useState} from 'react';
import {getPaginationVariables, Pagination} from '@shopify/hydrogen';
import {Icon} from '~/components/gi/Icon';
import {RouteError} from '~/components/gi/RouteError';
import {Button} from '~/components/gi/ui';
import {ProductCard} from '~/components/gi/ProductCard';
import {CatalogFilters, ActiveFilterChips} from '~/components/gi/CatalogFilters';
import {useApp, useToast} from '~/lib/AppContext';
import {GI_CATALOG_SEARCH_QUERY} from '~/lib/giFragments';
import {normalizeProduct, HOME_CATEGORIES} from '~/lib/gi';
import {
  SORTS,
  parseFilterParams,
  toSearchParams,
  buildSearchQuery,
  buildProductFilters,
  groupColorValues,
  activeChips,
  hasActiveFilters,
} from '~/lib/filters';

export const meta = () => [
  {title: 'Catálogo · Generando Ideas'},
  {
    name: 'description',
    content:
      'Catálogo de artículos promocionales y regalos corporativos personalizables. Filtra por categoría, color, material, técnica de impresión y precio.',
  },
];

const EMPTY = {nodes: [], pageInfo: {hasNextPage: false, hasPreviousPage: false}};

/* Ids de faceta que devuelve esta tienda. Se leen por id y no por posición
   porque Shopify sólo incluye las facetas que aplican al resultado. */
const FACET = {
  color: 'filter.v.option.color',
  talla: 'filter.v.option.talla',
  material: 'filter.p.m.custom.material',
  tecnica: 'filter.p.m.custom.tecnicas_de_impresion',
};

const listaDe = (facetas, id) =>
  (facetas.find((f) => f.id === id)?.values || [])
    .filter((v) => v.count > 0)
    .map((v) => ({value: v.label, label: v.label, count: v.count}));

export async function loader({context, request}) {
  const {storefront} = context;
  const url = new URL(request.url);
  const filtros = parseFilterParams(url.searchParams);
  const paginationVariables = getPaginationVariables(request, {pageBy: 24});
  const sortDef = SORTS[filtros.sort];

  const consultaBase = {
    query: buildSearchQuery(filtros),
    sortKey: sortDef.sortKey,
    reverse: sortDef.reverse,
  };

  const buscar = (variables, etiqueta) =>
    storefront.query(GI_CATALOG_SEARCH_QUERY, {variables}).catch((error) => {
      console.error(`[catalogo] búsqueda (${etiqueta}) falló:`, error);
      return null;
    });

  /* Una familia de color se traduce a un OR de los tonos crudos que existan
     ahora mismo ("Verde" → VERDE, VERDE PISTACHO, VERDE AQUA…), y esos tonos
     sólo se conocen leyendo la faceta. De ahí el huevo y la gallina: para
     construir el filtro hace falta una respuesta previa.
     Esa consulta de vocabulario pide `first: 1` porque sus productos se
     descartan — las facetas vienen igual sea cual sea el tamaño de página. */
  let colorValues = [];
  if (filtros.color.length) {
    const vocabulario = await buscar(
      {...consultaBase, productFilters: null, first: 1},
      'vocabulario de color',
    );
    colorValues = vocabulario?.search?.productFilters?.find((f) => f.id === FACET.color)?.values || [];
  }

  const res = await buscar(
    {
      ...consultaBase,
      productFilters: buildProductFilters(filtros, groupColorValues(colorValues)),
      ...paginationVariables,
    },
    'resultados',
  );

  const resultado = res?.search;
  const facetasCrudas = resultado?.productFilters || [];

  /* Todas las facetas salen de la consulta ya filtrada para que sus conteos
     reflejen lo aplicado. La de color es la excepción aparente: Shopify no
     estrecha una faceta con su propio filtro, así que aquí sigue llegando el
     vocabulario completo y los demás colores se pueden seguir eligiendo. */
  const colores = groupColorValues(
    (facetasCrudas.find((f) => f.id === FACET.color)?.values || []).filter((v) => v.count > 0),
  );

  return {
    products: resultado ? {nodes: resultado.nodes || [], pageInfo: resultado.pageInfo} : EMPTY,
    totalCount: resultado?.totalCount ?? 0,
    filtros,
    facetas: {
      colores,
      materiales: listaDe(facetasCrudas, FACET.material),
      tecnicas: listaDe(facetasCrudas, FACET.tecnica),
      tallas: listaDe(facetasCrudas, FACET.talla),
    },
  };
}

/* Si la búsqueda de Shopify falla, el loader ya degrada a lista vacía; esto
   cubre lo demás (una combinación de filtros que revienta la consulta, un
   cursor inválido pegado en la URL). Se queda dentro del layout para que la
   cabecera y la cotización sigan ahí. */
export function ErrorBoundary() {
  return (
    <div className="container">
      <RouteError
        titulo="No pudimos cargar el catálogo"
        descripcion="Puede ser una combinación de filtros que no admite la búsqueda. Empieza de nuevo sin filtros o escríbenos si sigue pasando."
        acciones={
          <div style={{display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap'}}>
            <a className="btn btn-accent" href="/catalogo">
              Ver todo el catálogo
            </a>
            <a className="btn btn-ghost" href="/contacto">
              Reportar el problema
            </a>
          </div>
        }
      />
    </div>
  );
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
  const {products, totalCount, filtros, facetas} = useLoaderData();
  const [, setParams] = useSearchParams();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const {isLoggedIn, addToQuote, openQuoteDrawer} = useApp();
  const toast = useToast();
  const [view, setView] = useState('grid');
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [texto, setTexto] = useState(filtros.q);
  /* Selección múltiple: se guarda el producto entero, no sólo el id, porque la
     barra de acciones tiene que poder cotizar productos que ya salieron de la
     página visible (paginación por cursor). */
  const [seleccion, setSeleccion] = useState(() => new Map());
  const [añadiendo, setAñadiendo] = useState(false);

  const alternarSeleccion = useCallback((producto) => {
    setSeleccion((prev) => {
      const next = new Map(prev);
      if (next.has(producto.id)) next.delete(producto.id);
      else next.set(producto.id, producto);
      return next;
    });
  }, []);

  const limpiarSeleccion = useCallback(() => setSeleccion(new Map()), []);

  const cotizarSeleccion = async () => {
    const elegidos = [...seleccion.values()];
    const cotizables = elegidos.filter((p) => p.firstVariantId);
    const sinVariante = elegidos.length - cotizables.length;
    setAñadiendo(true);
    let ok = 0;
    try {
      // En serie: cada respuesta del servidor trae la lista autoritativa de
      // líneas, así que lanzarlas en paralelo haría que la última pisara al
      // resto.
      for (const p of cotizables) {
        await addToQuote({
          variantId: p.firstVariantId,
          productId: p.id,
          handle: p.handle,
          title: p.title,
          sku: p.sku,
          image: p.image,
          price: p.price,
          qty: 1,
        });
        ok += 1;
      }
      limpiarSeleccion();
      openQuoteDrawer();
      toast(
        sinVariante > 0
          ? `${ok} en tu cotización · ${sinVariante} necesitan que elijas variante`
          : `${ok} ${ok === 1 ? 'producto añadido' : 'productos añadidos'} a tu cotización`,
        {icon: 'quote', accent: true},
      );
    } catch (err) {
      toast(
        ok > 0
          ? `Se añadieron ${ok} y falló el resto: ${err.message || 'inténtalo de nuevo'}`
          : err.message || 'No se pudo añadir a la cotización',
        {icon: 'alert'},
      );
    } finally {
      setAñadiendo(false);
    }
  };

  // El input es controlado, pero la verdad vive en la URL: al navegar con
  // atrás/adelante o al quitar el chip de búsqueda hay que resincronizarlo.
  useEffect(() => setTexto(filtros.q), [filtros.q]);

  const cargando = navigation.state === 'loading';

  const aplicar = (siguiente) => {
    // Cualquier cambio de filtro reinicia la paginación: los cursores de la
    // consulta anterior no son válidos para el nuevo resultado.
    setParams(toSearchParams(siguiente), {preventScrollReset: true});
  };

  const enviarBusqueda = (e) => {
    e.preventDefault();
    aplicar({...filtros, q: texto});
  };

  const quitarChip = (chip) => {
    const f = {...filtros};
    switch (chip.group) {
      case 'q':
        f.q = '';
        break;
      case 'cat':
        f.cat = '';
        break;
      case 'precio':
        f.precioMin = null;
        f.precioMax = null;
        break;
      case 'disp':
        f.soloDisponibles = false;
        break;
      case 'nuevos':
        f.nuevos = false;
        break;
      case 'ofertas':
        f.ofertas = false;
        break;
      default:
        // color / material / tecnica / talla
        f[chip.group] = (f[chip.group] || []).filter((v) => v !== chip.value);
    }
    aplicar(f);
  };

  const limpiarTodo = () => navigate('/catalogo', {preventScrollReset: true});

  const chips = activeChips(filtros, {categorias: HOME_CATEGORIES});
  const hayFiltros = hasActiveFilters(filtros);

  const titulo = filtros.q
    ? `Resultados · “${filtros.q}”`
    : HOME_CATEGORIES.find((c) => c.handle === filtros.cat)?.name || 'Todos los productos';

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
          {titulo}
        </h1>
        <p style={{color: 'var(--ink-3)', margin: 0, fontSize: 16}}>
          {totalCount.toLocaleString('es-MX')} productos
          {hayFiltros ? ' con los filtros aplicados' : ' en el catálogo'}. Combina
          categoría, color, precio y acabados.
        </p>
      </div>

      <ActiveFilterChips chips={chips} onRemove={quitarChip} onClearAll={limpiarTodo} />

      <div className="cat-page">
        <button
          type="button"
          className="cat-filters-toggle"
          aria-expanded={panelAbierto}
          onClick={() => setPanelAbierto(true)}
        >
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
            <Icon name="filter" size={15} />
            Filtros{chips.length ? ` · ${chips.length}` : ''}
          </span>
          <Icon name="chevron_down" size={15} className="chev" />
        </button>

        {panelAbierto && (
          <button
            type="button"
            className="cf-scrim"
            aria-label="Cerrar filtros"
            onClick={() => setPanelAbierto(false)}
          />
        )}

        <CatalogFilters
          filters={filtros}
          facets={facetas}
          categorias={HOME_CATEGORIES}
          onChange={aplicar}
          onClearAll={limpiarTodo}
          totalCount={totalCount}
          open={panelAbierto}
          onClose={() => setPanelAbierto(false)}
        />

        <div>
          <div className="cat-toolbar">
            <form className="cat-search" onSubmit={enviarBusqueda}>
              <Icon name="search" size={14} />
              <input
                placeholder="Buscar producto, SKU o categoría…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                aria-label="Buscar en el catálogo"
              />
              {texto && (
                <button
                  type="button"
                  className="cat-search-clear"
                  aria-label="Borrar búsqueda"
                  onClick={() => {
                    setTexto('');
                    aplicar({...filtros, q: ''});
                  }}
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </form>
            <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
              <span className="cat-results-meta">
                {cargando ? 'Buscando…' : `${totalCount.toLocaleString('es-MX')} productos`}
              </span>
              <select
                className="input"
                value={filtros.sort}
                onChange={(e) => aplicar({...filtros, sort: e.target.value})}
                aria-label="Ordenar"
                style={{padding: '10px 14px', fontSize: 13, borderRadius: 999, fontWeight: 500}}
              >
                {Object.entries(SORTS).map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.label}
                  </option>
                ))}
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

          <Pagination connection={products}>
            {({nodes, isLoading, PreviousLink, NextLink, hasNextPage, hasPreviousPage}) => {
              const visible = nodes.map(normalizeProduct).filter(Boolean);
              return (
                <>
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
                      <p>
                        {hayFiltros
                          ? 'Ninguna combinación de estos filtros devuelve productos. Prueba a quitar alguno.'
                          : 'Intenta con otras palabras de búsqueda.'}
                      </p>
                      {hayFiltros && (
                        <Button variant="ghost" onClick={limpiarTodo}>
                          Limpiar filtros
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`${view === 'grid' ? 'product-grid' : 'product-list'} stagger`}
                      data-loading={cargando ? '' : undefined}
                    >
                      {visible.map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          view={view === 'list' ? 'list' : undefined}
                          selectable={isLoggedIn}
                          selected={seleccion.has(p.id)}
                          onToggleSelect={alternarSeleccion}
                        />
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

      {seleccion.size > 0 && (
        <div className="bulk-bar" role="region" aria-label="Selección para cotizar">
          <span className="bulk-bar-count">
            {seleccion.size} {seleccion.size === 1 ? 'seleccionado' : 'seleccionados'}
          </span>
          <button type="button" className="bulk-bar-clear" onClick={limpiarSeleccion}>
            Limpiar
          </button>
          <Button
            variant="accent"
            icon="quote"
            disabled={añadiendo}
            onClick={cotizarSeleccion}
          >
            {añadiendo ? 'Añadiendo…' : 'Añadir a cotización'}
          </Button>
        </div>
      )}
    </div>
  );
}
