import {Link, useLoaderData, useSearchParams, useNavigate, useNavigation} from 'react-router';
import {useCallback, useEffect, useState} from 'react';
import {getPaginationVariables, Pagination} from '@shopify/hydrogen';
import {Icon} from '~/components/gi/Icon';
import {RouteError} from '~/components/gi/RouteError';
import {Button} from '~/components/gi/ui';
import {ProductCard} from '~/components/gi/ProductCard';
import {AutoLoadMore} from '~/components/gi/AutoLoadMore';
import {
  CatalogFilters,
  ActiveFilterChips,
  SortSheet,
} from '~/components/gi/CatalogFilters';
import {useApp, useToast} from '~/lib/AppContext';
import {GI_CATALOG_SEARCH_QUERY, GI_CATALOG_COLLECTION_QUERY} from '~/lib/giFragments';
import {normalizeProduct, HOME_CATEGORIES} from '~/lib/gi';
import {categoryPath, categoryHref, flattenTree} from '~/lib/category-tree';
import {
  SORTS,
  parseFilterParams,
  toSearchParams,
  buildSearchQuery,
  buildProductFilters,
  groupColorValues,
  groupTechniqueValues,
  groupSizeValues,
  activeChips,
  hasActiveFilters,
  resolveCatalogSource,
  appliedFilters,
} from '~/lib/filters';
import {getBrandColors, getColorVocabulary, getFacetValues} from '~/lib/brand-colors.server';
import {applyCustomerPrices, getCustomerMargin} from '~/lib/pricing.server';
import {brandVariantId} from '~/lib/brand-colors';
import {campanaHref, campanaPorHandle, enColorDeCampana} from '~/lib/campanas';
import {
  effectiveColorFamilies,
  visibleColorSelection,
  hayVocabulario,
} from '~/lib/brand-colors';

export const meta = ({data}) => (data?.campana ? metaCampana(data) : META_CATALOGO);

/* La landing de temporada (/temporada/:handle, ver app/routes.js) sale de
   este mismo módulo: título, texto e imagen de su colección de Shopify. */
function metaCampana({campana, coleccion, origin}) {
  const titulo = coleccion?.title || campana.titulo;
  const desc =
    coleccion?.description ||
    `Artículos promocionales para ${titulo}. Personalízalos con tu marca y cotiza en línea.`;
  const url = `${origin}${campanaHref(campana.handle)}`;
  return [
    {title: `${titulo} · Generando Ideas`},
    {name: 'description', content: desc},
    {tagName: 'link', rel: 'canonical', href: url},
    {property: 'og:title', content: `${titulo} · Generando Ideas`},
    {property: 'og:description', content: desc},
    {property: 'og:type', content: 'website'},
    {property: 'og:url', content: url},
    ...(coleccion?.image?.url ? [{property: 'og:image', content: coleccion.image.url}] : []),
  ];
}

const META_CATALOGO = [
  {title: 'Catálogo · Generando Ideas'},
  {
    name: 'description',
    content:
      'Catálogo de artículos promocionales y regalos corporativos personalizables. Filtra por categoría, color, material, técnica de impresión y precio.',
  },
];

/* Los cuatro campos de pageInfo son obligatorios: <Pagination> lanza si le
   falta startCursor o endCursor, y eso tumbaba la ruta entera con un 500 en
   cuanto la consulta no devolvía nada — por ejemplo, una colección que no
   existe o que no está publicada en el canal de Hydrogen. */
const EMPTY = {
  nodes: [],
  pageInfo: {hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null},
};

/* Ids de faceta que devuelve esta tienda. Se leen por id y no por posición
   porque Shopify sólo incluye las facetas que aplican al resultado. */
const FACET = {
  color: 'filter.v.option.color',
  talla: 'filter.v.option.talla',
  material: 'filter.p.m.custom.material',
  tecnica: 'filter.p.m.custom.tecnicas_de_impresion',
};

/* Opciones genéricas (técnica, talla) con la forma que espera el panel. */
const genericos = (agrupar, facetas, id) =>
  agrupar((facetas.find((f) => f.id === id)?.values || []).filter((v) => v.count > 0)).map((g) => ({
    value: g.id,
    label: g.label,
    count: g.count,
  }));

const listaDe = (facetas, id) =>
  (facetas.find((f) => f.id === id)?.values || [])
    .filter((v) => v.count > 0)
    .map((v) => ({value: v.label, label: v.label, count: v.count}));

export async function loader(args) {
  // Sin :handle es /catalogo; con él, la landing de una temporada.
  const handle = args.params?.handle;
  if (!handle) return cargarCatalogo(args);
  const campana = campanaPorHandle(handle);
  if (!campana) throw new Response('Campaña no encontrada', {status: 404});
  const datos = await cargarCatalogo(args, {cat: campana.handle});
  return {...datos, campana, origin: new URL(args.request.url).origin};
}

/**
 * El catálogo, y también la landing de cada temporada. Con `cat` fijo la
 * colección no sale de la URL sino de la ruta: los filtros, el orden y la
 * paginación funcionan igual, pero no hay búsqueda de texto (sacaría los
 * resultados de la colección) ni chip de categoría que quitar.
 * @param {{context: object, request: Request}} args
 * @param {{cat?: string}} [fijo]
 */
async function cargarCatalogo({context, request}, {cat} = {}) {
  const {storefront} = context;
  const url = new URL(request.url);
  const filtros = parseFilterParams(url.searchParams);
  if (cat) {
    filtros.cat = cat;
    filtros.q = '';
  }
  const paginationVariables = getPaginationVariables(request, {pageBy: 24});
  const sortDef = SORTS[filtros.sort];

  /* Paleta y margen primero, en paralelo: sin `gid` ninguno toca la red, así
     que el visitante anónimo no paga nada por preguntar. */
  const [marca, margen] = await Promise.all([
    getBrandColors(context),
    getCustomerMargin(context),
  ]);
  const marcaColores = marca?.families || [];

  /* Dos vistas del mismo filtro de color, y la diferencia importa:
       - `efectivos` es lo que se consulta. Con paleta, nunca sale de ella.
       - `visibles` es lo que se pinta como chip. La paleta no aparece: es el
         suelo del catálogo, no un filtro aplicado, y una x que no quitara nada
         mentiría. Lo que el usuario pidió fuera de su paleta se borra. */
  const filtrosEfectivos = {
    ...filtros,
    color: effectiveColorFamilies(filtros.color, marcaColores),
  };
  const filtrosVisibles = {
    ...filtros,
    color: visibleColorSelection(filtros.color, marcaColores),
  };

  /* El vocabulario sólo sirve para expandir familias de color a los tonos
     crudos de la tienda. Sin ninguna familia que expandir —ni de la paleta ni
     elegida en el panel— no se usa para nada, y con la entrada de CacheLong
     fría es una consulta entera por delante de la real. Es la condición que
     el código viejo tenía como `if (filtros.color.length)`, ampliada a la
     paleta. */
  const vocabulario = filtrosEfectivos.color.length
    ? await getColorVocabulary(context)
    : null;

  /* Técnica y talla viajan como genéricos ("bordado", "xg") y hay que
     expandirlos a los valores reales de la tienda. Sólo se leen cuando hay
     alguno elegido; salen de la misma consulta cacheada que el color. */
  const [vocabTecnicas, vocabTallas] = await Promise.all([
    filtros.tecnica.length ? getFacetValues(context, FACET.tecnica) : null,
    filtros.talla.length ? getFacetValues(context, FACET.talla) : null,
  ]);

  const fuente = resolveCatalogSource(filtrosEfectivos);
  const consultaBase = {
    query: buildSearchQuery(filtrosEfectivos),
    sortKey: sortDef.sortKey,
    reverse: sortDef.reverse,
  };

  const buscar = (variables, etiqueta, consulta = GI_CATALOG_SEARCH_QUERY) =>
    storefront.query(consulta, {variables}).catch((error) => {
      console.error(`[catalogo] búsqueda (${etiqueta}) falló:`, error);
      return null;
    });

  /* El vocabulario de color solía pedirse con una consulta extra ("para
     construir el filtro hace falta una respuesta previa"). Ahora viene de
     getColorVocabulary, cacheado y compartido por todas las rutas, así que el
     catálogo se resuelve con una sola consulta.

     `colorObligatorio` es el fail-closed —0 productos cuando ninguna familia
     de la marca existe en la tienda— y sólo se enciende si el vocabulario se
     pudo leer de verdad. Sin él no se puede afirmar que la paleta no tenga
     tonos, y vaciarle el catálogo al cliente por un hipo de la faceta sería
     peor que servirle el catálogo público, que es el que ve cualquier
     visitante anónimo. Es la misma decisión que toma brandProductFilters para
     /collections y /search: las dos rutas del catálogo la heredan aquí. */
  const productFilters = buildProductFilters(
    filtrosEfectivos,
    groupColorValues(vocabulario),
    {
      colorObligatorio: marcaColores.length > 0 && hayVocabulario(vocabulario),
      // El rango de precio lo escribe el cliente en su precio, no en el de lista.
      margin: margen,
      tecnicas: groupTechniqueValues(vocabTecnicas),
      tallas: groupSizeValues(vocabTallas),
    },
  );

  /* La categoría se resuelve por colección porque `search(query:"tag:...")` no
     filtra: sólo pesa en la relevancia, y al cruzarla con cualquier otro filtro
     se cuelan productos de otras categorías. La colección no acepta texto libre,
     así que en cuanto hay `q` se vuelve a `search` y la categoría deja de
     aplicarse — `appliedFilters` la quita de los chips para no mentir. */
  const resCrudo =
    fuente.modo === 'coleccion'
      ? await buscar(
          {
            handle: fuente.handle,
            productFilters,
            sortKey: sortDef.sortKey === 'PRICE' ? 'PRICE' : 'RELEVANCE',
            reverse: sortDef.reverse,
            ...paginationVariables,
          },
          'resultados (colección)',
          GI_CATALOG_COLLECTION_QUERY,
        )
      : await buscar({...consultaBase, productFilters, ...paginationVariables}, 'resultados');

  // Precios del cliente (margen sobre costo) antes de que nada los lea.
  const res = await applyCustomerPrices(context, resCrudo);

  const coleccion = res?.collection;
  const resultado = fuente.modo === 'coleccion' ? coleccion?.products : res?.search;
  const facetasCrudas =
    (fuente.modo === 'coleccion' ? resultado?.filters : resultado?.productFilters) || [];

  /* Todas las facetas salen de la consulta ya filtrada para que sus conteos
     reflejen lo aplicado. La de color es la excepción aparente: Shopify no
     estrecha una faceta con su propio filtro, así que aquí sigue llegando el
     vocabulario completo y los demás colores se pueden seguir eligiendo — salvo
     que el cliente tenga paleta, en cuyo caso el panel sólo ofrece la suya. */
  const colores = groupColorValues(
    (facetasCrudas.find((f) => f.id === FACET.color)?.values || []).filter((v) => v.count > 0),
  ).filter((c) => !marcaColores.length || marcaColores.includes(c.family));

  return {
    products: resultado
      ? {nodes: resultado.nodes || [], pageInfo: {...EMPTY.pageInfo, ...resultado.pageInfo}}
      : EMPTY,
    // La colección no expone total: se marca como desconocido en vez de
    // enseñar un 0 que sería falso.
    totalCount: fuente.modo === 'coleccion' ? null : (resultado?.totalCount ?? 0),
    // Con la categoría fija, ni chip ni parámetro: la pone la ruta.
    filtros: cat
      ? {...appliedFilters(filtrosVisibles), cat: ''}
      : appliedFilters(filtrosVisibles),
    coleccion: coleccion
      ? {title: coleccion.title, description: coleccion.description, image: coleccion.image}
      : null,
    marcaColores,
    facetas: {
      colores,
      materiales: listaDe(facetasCrudas, FACET.material),
      // Agrupadas: 6 técnicas en vez de 57 combinaciones, y una talla por tamaño.
      tecnicas: genericos(groupTechniqueValues, facetasCrudas, FACET.tecnica),
      tallas: genericos(groupSizeValues, facetasCrudas, FACET.talla),
    },
  };
}

/**
 * Qué decir y qué ofrecer cuando no queda ni un producto que pintar.
 *
 * El mensaje y el botón tienen que salir de la misma decisión: con paleta de
 * marca y sin ningún filtro aplicado —el /catalogo desnudo de un cliente cuya
 * paleta no existe en la tienda— el texto pedía "prueba a quitar alguno" y no
 * se pintaba ningún botón, porque el de limpiar filtros colgaba de
 * `hayFiltros`. El cliente se quedaba sin nada que pulsar. Su paleta la edita
 * Generando Ideas y no él, así que la única salida real es escribirnos.
 *
 * Se exporta para poder fijarlo con un test sin montar la página entera.
 * @param {{marcaColores?: string[], hayFiltros?: boolean}} estado
 * @returns {{texto: string, accion: 'limpiar'|'contacto'|null}}
 */
/* Todas las colecciones del árbol, con el nombre que lleva su chip. */
const CATEGORIAS_DEL_ARBOL = flattenTree().map((n) => ({handle: n.handle, name: n.title}));

/**
 * Título del catálogo y, si la categoría es una subcategoría o un tipo, la ruta
 * de sus padres ("Bebidas › Tazas y tarros") y la categoría principal que se
 * marca en la barra lateral.
 *
 * Se exporta para poder fijarlo con un test sin montar la página entera.
 * @param {{cat?: string, q?: string}} filtros
 * @returns {{titulo: string, ruta: Array<{title: string, handle: string}>, raiz: string}}
 */
export function encabezadoCatalogo({cat = '', q = ''} = {}) {
  const camino = categoryPath(cat);
  const nodo = camino.at(-1);
  return {
    titulo: q ? `Resultados · “${q}”` : nodo?.title || 'Todos los productos',
    ruta: q ? [] : camino.slice(0, -1),
    raiz: camino[0]?.handle || cat,
  };
}

export function estadoVacio({marcaColores = [], hayFiltros = false} = {}) {
  if (marcaColores.length) {
    return hayFiltros
      ? {
          texto:
            'No hay productos en los colores de tu marca con estos filtros. Prueba a quitar alguno.',
          accion: 'limpiar',
        }
      : {
          texto:
            'Ahora mismo no encontramos productos en los colores de tu marca. Escríbenos y te buscamos alternativas.',
          accion: 'contacto',
        };
  }
  return hayFiltros
    ? {
        texto: 'Ninguna combinación de estos filtros devuelve productos. Prueba a quitar alguno.',
        accion: 'limpiar',
      }
    : {texto: 'Intenta con otras palabras de búsqueda.', accion: null};
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

/**
 * Encabezado de la landing de temporada: el banner y, debajo, el título y el
 * texto de la campaña. Los tres salen de la colección de Shopify; el título de
 * la configuración sólo cubre una colección sin título.
 */
function EncabezadoCampana({campana, coleccion}) {
  const titulo = coleccion?.title || campana.titulo;
  return (
    <header className="campana-hero">
      <nav className="eyebrow cat-breadcrumb" aria-label="Ruta">
        <Link to="/">Inicio</Link>
        {' › '}
        <span>Temporada</span>
      </nav>
      {coleccion?.image?.url && (
        <div className="campana-banner">
          <img
            src={coleccion.image.url}
            alt={coleccion.image.altText || titulo}
            width={coleccion.image.width}
            height={coleccion.image.height}
            fetchPriority="high"
          />
        </div>
      )}
      <div className="campana-texto">
        <h1>{titulo}</h1>
        {coleccion?.description && <p>{coleccion.description}</p>}
      </div>
    </header>
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

/**
 * Las líneas de cotización de una selección múltiple, cada una con la variante
 * del color de la marca del cliente.
 *
 * Antes se mandaba `firstVariantId` a secas, que es la primera variante que
 * devolvió la consulta y puede ser de cualquier color: al cliente con paleta le
 * entraban en la cotización variantes que no puede pedir, en lote y sin que el
 * color apareciera por ningún lado.
 *
 * @param {Array<object>} productos los seleccionados, ya normalizados
 * @param {string[]} marcaColores
 * @returns {{lineas: Array<object>, sinVariante: number}}
 */
export function lineasDeSeleccion(productos, marcaColores) {
  const lineas = [];
  let sinVariante = 0;
  for (const p of productos || []) {
    const variantId = brandVariantId(p, marcaColores);
    // Sin variante no se puede cotizar sin crear una línea de $0 y sin foto.
    if (!variantId) {
      sinVariante += 1;
      continue;
    }
    lineas.push({
      variantId,
      productId: p.id,
      handle: p.handle,
      title: p.title,
      sku: p.sku,
      image: p.image,
      price: p.price,
      qty: 1,
    });
  }
  return {lineas, sinVariante};
}

export default function Catalogo() {
  const {campana} = useLoaderData();
  return <CatalogoVista campana={campana} />;
}

/**
 * @param {{campana?: {handle: string, titulo: string}}} props con campaña, la
 *   página es su landing: encabezado con banner, sin búsqueda ni categorías.
 */
function CatalogoVista({campana = null}) {
  const {products, totalCount, filtros, facetas, coleccion, marcaColores = []} =
    useLoaderData();
  /* La ruta de colección no expone un total. Se escribe "productos" a secas en
     vez de inventar un número o enseñar un 0 que sería mentira. */
  const totalTexto =
    totalCount == null ? 'Productos' : `${totalCount.toLocaleString('es-MX')} productos`;
  const [, setParams] = useSearchParams();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const {addToQuote, openQuoteDrawer} = useApp();
  const toast = useToast();
  const [view, setView] = useState('grid');
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [ordenAbierto, setOrdenAbierto] = useState(false);
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
    const {lineas: cotizables, sinVariante} = lineasDeSeleccion(
      [...seleccion.values()],
      marcaColores,
    );
    setAñadiendo(true);
    let ok = 0;
    try {
      // En serie: cada respuesta del servidor trae la lista autoritativa de
      // líneas, así que lanzarlas en paralelo haría que la última pisara al
      // resto.
      for (const linea of cotizables) {
        await addToQuote(linea);
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

  const inicio = campana ? campanaHref(campana.handle) : '/catalogo';
  const limpiarTodo = () => navigate(inicio, {preventScrollReset: true});
  /* En la landing cada producto sale en el color de la campaña, salvo para un
     cliente con paleta: a él sólo se le enseñan sus colores. */
  const presentar = (p) =>
    campana && !marcaColores.length ? enColorDeCampana(campana.handle, p) : p;

  const chips = activeChips(filtros, {categorias: CATEGORIAS_DEL_ARBOL});
  const hayFiltros = hasActiveFilters(filtros);
  const vacio = estadoVacio({marcaColores, hayFiltros});

  const {titulo, ruta, raiz} = encabezadoCatalogo(filtros);

  return (
    <div className="container" data-screen-label={campana ? `04b Temporada: ${campana.titulo}` : '04 Catalog'}>
      {campana ? (
        <EncabezadoCampana campana={campana} coleccion={coleccion} />
      ) : (
        <div style={{padding: '32px 0 16px'}}>
          {ruta.length ? (
            <nav className="eyebrow cat-breadcrumb" aria-label="Ruta de la categoría">
              <Link to="/catalogo">Catálogo</Link>
              {ruta.map((n) => (
                <span key={n.handle}>
                  {' › '}
                  <Link to={categoryHref(n.handle)}>{n.title}</Link>
                </span>
              ))}
            </nav>
          ) : (
            <div className="eyebrow">// Catálogo · /catalogo</div>
          )}
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
            {totalTexto}
            {hayFiltros ? ' con los filtros aplicados' : ' en el catálogo'}. Combina
            categoría, color, precio y acabados.
          </p>
        </div>
      )}

      <ActiveFilterChips chips={chips} onRemove={quitarChip} onClearAll={limpiarTodo} />

      <div className="cat-page">
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
          categorias={campana ? null : HOME_CATEGORIES}
          categoriaActiva={raiz}
          onChange={aplicar}
          onClearAll={limpiarTodo}
          totalCount={totalCount}
          cargando={cargando}
          open={panelAbierto}
          onClose={() => setPanelAbierto(false)}
        />

        <div>
          <div className="cat-toolbar">
{!campana && (
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
            )}
            <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
              <span className="cat-results-meta">
                {cargando ? 'Buscando…' : totalTexto}
              </span>
              <select
                className="input cat-sort-select"
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
            {({
              nodes,
              isLoading,
              PreviousLink,
              NextLink,
              hasNextPage,
              hasPreviousPage,
              nextPageUrl,
              state,
            }) => {
              const visible = nodes.map(normalizeProduct).filter(Boolean).map(presentar);
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
                      <p>{vacio.texto}</p>
                      {vacio.accion === 'limpiar' && (
                        <Button variant="ghost" onClick={limpiarTodo}>
                          Limpiar filtros
                        </Button>
                      )}
                      {vacio.accion === 'contacto' && (
                        <Button variant="ghost" onClick={() => navigate('/contacto')}>
                          Escríbenos
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
                          selectable
                          selected={seleccion.has(p.id)}
                          onToggleSelect={alternarSeleccion}
                        />
                      ))}
                    </div>
                  )}

                  {hasNextPage && (
                    <div className="cat-load-more">
                      {/* Carga sola al acercarse al final; el botón queda de
                          respaldo para teclado y navegadores sin observer. */}
                      <AutoLoadMore nextPageUrl={nextPageUrl} state={state} isLoading={isLoading} />
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

      {/* Barra fija de móvil. El toggle vivía sobre la grilla y sólo se
          alcanzaba subiendo hasta arriba; filtrar y ordenar es justo lo que se
          quiere después de haber bajado un par de pantallas.
          Cede el sitio a .bulk-bar, que ocupa la misma franja: con productos
          seleccionados, cotizarlos es la tarea en curso. */}
      {seleccion.size === 0 && (
        <div className="cat-mobile-bar">
          <button
            type="button"
            className="cat-mobile-btn"
            aria-expanded={panelAbierto}
            onClick={() => setPanelAbierto(true)}
          >
            <Icon name="filter" size={16} />
            Filtros
            {chips.length > 0 && (
              <span className="cat-mobile-badge">{chips.length}</span>
            )}
          </button>
          <button
            type="button"
            className="cat-mobile-btn"
            aria-expanded={ordenAbierto}
            onClick={() => setOrdenAbierto(true)}
          >
            <Icon name="sort" size={16} />
            {SORTS[filtros.sort].short}
          </button>
        </div>
      )}

      <SortSheet
        open={ordenAbierto}
        value={filtros.sort}
        options={Object.entries(SORTS)}
        onSelect={(sort) => {
          aplicar({...filtros, sort});
          setOrdenAbierto(false);
        }}
        onClose={() => setOrdenAbierto(false)}
      />

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
