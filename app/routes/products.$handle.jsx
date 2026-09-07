import {useLoaderData, Link, useNavigate, redirect} from 'react-router';
import {useState} from 'react';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {Icon} from '~/components/gi/Icon';
import {RouteError} from '~/components/gi/RouteError';
import {Button, PH} from '~/components/gi/ui';
import {useApp, useToast} from '~/lib/AppContext';
import {formatPrice, colorHex, normalizeProduct} from '~/lib/gi';
import {buildProductSpecs} from '~/lib/specs';
import {resumen, separarFrasesPegadas} from '~/lib/text';
import {useVariantGallery} from '~/lib/gallery';
import {GI_PRODUCT_RECOMMENDATIONS_QUERY} from '~/lib/giFragments';
import {getBrandColors} from '~/lib/brand-colors.server';
import {
  keepBrandProducts,
  productMatchesBrand,
  brandOptionValues,
} from '~/lib/brand-colors';
import {ProductCard} from '~/components/gi/ProductCard';
import {RecentlyViewed} from '~/components/gi/RecentlyViewed';
import DecorationSelector from '~/components/gi/DecorationSelector.jsx';
import {getTechniques, calcDecoration, effectiveUnitPrice, round2} from '~/lib/decoration/engine.js';
import {getVariantInventory} from '~/lib/admin/operations';

export const meta = ({data}) => {
  const p = data?.product;
  const origin = data?.origin ?? '';
  const desc =
    p?.seo?.description ||
    p?.description ||
    'Artículo promocional personalizable. Cotiza en línea con precios por proyecto.';
  const img = p?.featuredImage?.url;
  const title = `${p?.title ?? 'Producto'} · Generando Ideas`;
  const url = `${origin}/products/${p?.handle}`;
  return [
    {title},
    {name: 'description', content: desc},
    {tagName: 'link', rel: 'canonical', href: url},
    {property: 'og:title', content: title},
    {property: 'og:description', content: desc},
    {property: 'og:type', content: 'product'},
    {property: 'og:url', content: url},
    ...(img ? [{property: 'og:image', content: img}] : []),
    {
      // Product JSON-LD. Price is intentionally OMITTED — this storefront hides
      // prices from anonymous visitors ("precio para clientes"), so exposing a
      // concrete price publicly would contradict that gating.
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p?.title,
        description: desc,
        ...(img ? {image: [img]} : {}),
        brand: {'@type': 'Brand', name: 'Generando Ideas'},
        url,
      },
    },
  ];
};

export async function loader(args) {
  const criticalData = await loadCriticalData(args);
  return criticalData;
}

async function loadCriticalData({context, params, request}) {
  const {handle} = params;
  const {storefront} = context;
  if (!handle) throw new Error('Expected product handle to be defined');

  const [{product}, marca] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    getBrandColors(context),
  ]);

  if (!product?.id) throw new Response(null, {status: 404});
  redirectIfHandleIsLocalized(request, {handle, data: product});

  const marcaColores = marca?.families || [];

  /* Si la ficha aterrizaría en un color que el cliente no puede pedir, se
     arranca en uno suyo. Va antes de stock y recomendaciones porque al
     redirigir esas dos consultas se tirarían. Los parámetros que ya traía la
     URL se conservan: por ahí llegan las campañas y los enlaces de las
     ejecutivas. */
  const opciones = opcionesDeMarca(product, marcaColores);
  if (opciones) {
    const params = new URLSearchParams(new URL(request.url).search);
    for (const {name, value} of opciones) params.set(name, value);
    throw redirect(`/products/${product.handle}?${params}`);
  }

  // Inventory comes from the Admin API (the Hydrogen-managed Storefront token
  // can't get the inventory scope). Best-effort: needs the Admin `read_inventory`
  // scope + a real Admin token; degrades to null (no badge) otherwise.
  // Related products power the "Productos similares" strip; best-effort too.
  const [stock, recomendacionesCrudas] = await Promise.all([
    getVariantInventory(context.env, product.selectedOrFirstAvailableVariant?.id),
    storefront
      .query(GI_PRODUCT_RECOMMENDATIONS_QUERY, {variables: {productId: product.id}})
      .then((r) =>
        (r?.productRecommendations || [])
          .map(normalizeProduct)
          .filter((p) => p && p.id !== product.id),
      )
      .catch(() => []),
  ]);

  // productRecommendations no acepta facetas: se recorta aquí. Es una tira
  // corta, así que no hay paginación ni conteo que romper.
  const recommendations = keepBrandProducts(recomendacionesCrudas, marcaColores);

  return {
    product,
    stock,
    recommendations,
    marcaColores,
    origin: new URL(request.url).origin,
  };
}

/**
 * Arma la línea que la ficha manda a cotizar.
 *
 * Va aparte y exportada porque sirve a dos destinos: con sesión el servidor
 * sólo lee las cinco claves de intención y vuelve a pedirle a Shopify precio,
 * título e imagen; sin sesión el carrito de invitado pinta el cajón con lo que
 * traiga la línea, así que el precio de lista tiene que viajar o el usuario
 * vería $0 hasta que se registre.
 */
export function lineaDeFicha({product, selectedVariant, mainImage, unit, decoDetail, qty}) {
  return {
    variantId: selectedVariant.id,
    // Display del carrito de invitado; con sesión el servidor los ignora.
    productId: product.id,
    handle: product.handle,
    title: product.title,
    sku: selectedVariant.sku,
    image: mainImage,
    price: unit,
    options: selectedVariant.selectedOptions,
    // Las cinco claves que el servidor lee; sin decorado mientras el selector
    // no haya emitido un detalle.
    technique: decoDetail?.technique ?? 'Sin decorado',
    surface: decoDetail?.surface ?? '',
    size: decoDetail?.size ?? '',
    qty,
  };
}

export default function Product() {
  const {product, stock, recommendations = [], marcaColores = []} = useLoaderData();
  const navigate = useNavigate();
  const {favs, toggleFav, addToQuote, openQuoteDrawer} = useApp();
  const toast = useToast();

  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const unit = selectedVariant?.price ? parseFloat(selectedVariant.price.amount) : null;
  const compareAt = selectedVariant?.compareAtPrice
    ? parseFloat(selectedVariant.compareAtPrice.amount)
    : null;
  const currency = selectedVariant?.price?.currencyCode || 'MXN';

  const images = product.images?.nodes?.length
    ? product.images.nodes
    : [selectedVariant?.image].filter(Boolean);

  const [qty, setQty] = useState(1);
  // The input can sit briefly empty ('') while editing; qtyNum is the numeric
  // value used for all pricing/math so a transient empty field never yields NaN.
  const qtyNum = typeof qty === 'number' && qty >= 1 ? qty : 1;
  const [activeImg, setActiveImg] = useVariantGallery(images, selectedVariant);
  const [tab, setTab] = useState('desc');
  const [decoDetail, setDecoDetail] = useState(null);

  // Decoration metafields → engine inputs (route uses the raw loader product,
  // not normalizeProduct, so derive techniques/surface from product.metafields).
  const readMetafield = (key) =>
    (product.metafields || []).find(
      (m) => m && m.namespace === 'custom' && m.key === key,
    )?.value ?? null;
  const decoProduct = {
    techniques: getTechniques(readMetafield('tecnicas_de_impresion')),
    surface: String(readMetafield('material') ?? ''),
  };
  // Ficha técnica visible: ya viene filtrada de vacíos y ceros.
  const specs = buildProductSpecs(product);
  // Recompute decoration from the live quantity (qtyNum), not decoDetail.qty —
  // otherwise the total flashes a stale value for a frame on each qty change.
  const decoCalc = decoDetail
    ? calcDecoration(
        decoDetail.technique,
        decoDetail.surface,
        qtyNum,
        decoDetail.size,
      )
    : null;
  const decoError = Boolean(decoCalc && decoCalc.error);

  // Single integrated price: unit + total, decoration already folded in.
  const decoTotal = decoCalc && !decoCalc.error ? decoCalc.totalPrice : 0;
  const effUnit = unit != null ? round2(effectiveUnitPrice(unit, decoTotal, qtyNum)) : null;
  const effTotal = unit != null ? round2(unit * qtyNum + decoTotal) : null;

  const isFav = favs.includes(product.id);
  const isNew = (product.tags || []).includes('nuevo');
  const isOffer = (product.tags || []).includes('oferta');
  const mainImage = images[activeImg]?.url || selectedVariant?.image?.url;

  // Storefront-side inventory for the selected variant. `quantityAvailable`
  // is null when the store hasn't granted the Storefront API the
  // unauthenticated_read_product_inventory scope — in that case we fall back
  // to availableForSale instead of showing a misleading "0" or "null".
  const quantityAvailable =
    typeof selectedVariant?.quantityAvailable === 'number'
      ? selectedVariant.quantityAvailable
      : null;
  const isOutOfStock =
    quantityAvailable != null
      ? quantityAvailable <= 0
      : selectedVariant?.availableForSale === false;

  // Compact snapshot for the "Vistos recientemente" history (ProductCard shape).
  const colorOption = (product.options || []).find((o) => /color/i.test(o.name));
  const fueraDeMarca = esFueraDeMarca(colorOption, marcaColores);
  const recentSnapshot = {
    id: product.id,
    handle: product.handle,
    title: product.title,
    sku: selectedVariant?.sku || product.handle?.toUpperCase() || '',
    image:
      product.featuredImage?.url ||
      images[0]?.url ||
      selectedVariant?.image?.url ||
      null,
    imageAlt: product.featuredImage?.altText || product.title,
    price: unit,
    currency,
    // Todos los tonos, no los ocho primeros: de esta lista sale también el
    // recorte por paleta de la tira de vistos recientemente, y un ROJO en la
    // posición 10 tiene que contar igual que uno en la primera.
    colors: colorOption ? colorOption.optionValues.map((v) => v.name) : [],
    isNew,
    isOffer,
    firstVariantId:
      product.selectedOrFirstAvailableVariant?.id || selectedVariant?.id || null,
  };

  const handleQuote = async () => {
    // Defense in depth: the button is disabled while out of stock, but guard
    // the action itself too in case the disabled state is ever bypassed
    // (e.g. a stale click queued before a variant change re-renders it).
    if (!selectedVariant?.id || isOutOfStock) return;
    try {
      await addToQuote(
        lineaDeFicha({
          product,
          selectedVariant,
          mainImage,
          unit,
          decoDetail,
          qty: qtyNum,
        }),
      );
      toast(`${product.title} en tu lista de cotización`, {icon: 'quote', accent: true});
      openQuoteDrawer();
    } catch (err) {
      toast(err.message || 'No se pudo agregar a la cotización');
    }
  };

  return (
    <>
      <div className="container" data-screen-label={`06 Product: ${product.title}`}>
      {/* Breadcrumbs */}
      <div
        style={{
          padding: '20px 0 16px',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-4)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <Link to="/catalogo">Catálogo</Link>
        <Icon name="chevron_right" size={10} />
        <span style={{color: 'var(--ink-2)'}}>{product.title}</span>
      </div>

      <div className="pdp">
        {/* GALLERY */}
        <div className="pdp-gallery">
          <div className="pdp-main">
            <PH key={mainImage} src={mainImage} alt={product.title} aspect="ph-square" />
          </div>
          {images.length > 1 && (
            <div className="pdp-thumbs">
              {images.map((img, i) => (
                <button
                  type="button"
                  key={img.url ?? i}
                  className={`pdp-thumb ${activeImg === i ? 'active' : ''}`}
                  onClick={() => setActiveImg(i)}
                  aria-label={`Ver imagen ${i + 1}`}
                >
                  <PH src={img.url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* INFO */}
        <div className="pdp-info">
          <div className="pdp-meta">
            {isNew && <span className="tag tag-accent">Nuevo</span>}
            {isOffer && <span className="tag tag-ink">Oferta</span>}
            {selectedVariant?.availableForSale ? (
              <span className="tag tag-ok tag-dot">En stock</span>
            ) : (
              <span className="tag tag-ink tag-dot">Agotado</span>
            )}
            {typeof stock === 'number' && stock > 0 && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--ink-4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {stock} disponibles
              </span>
            )}
            <span className="pdp-sku">{selectedVariant?.sku || product.handle}</span>
          </div>

          <h1 className="pdp-title">{product.title}</h1>

          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <span style={{fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)'}}>
              Producto promocional
            </span>
          </div>

          {/* Sólo el arranque de la descripción. El texto completo vive en la
              pestaña "Descripción" de abajo; pintarlo entero aquí lo repetía
              palabra por palabra en la misma pantalla. */}
          {product.description && (
            <p className="pdp-desc">{resumen(product.description)}</p>
          )}

          {/* PRICE — se pinta con o sin sesión. Lo que sigue pidiendo login
              es cotizar (ver ACTIONS), no consultar el precio. */}
          {unit != null ? (
            <div className="pdp-price-bar">
              <div>
                <div className="pdp-price-from">Precio por pieza</div>
                <div className="pdp-price">{formatPrice(effUnit, currency)}</div>
                {compareAt != null && compareAt > unit && decoTotal === 0 && (
                  <div
                    style={{
                      textDecoration: 'line-through',
                      color: 'var(--ink-4)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {formatPrice(compareAt, currency)}
                  </div>
                )}
              </div>
              <div style={{textAlign: 'right'}}>
                <div className="pdp-price-from">Total · {qtyNum} pz</div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 22,
                    color: 'var(--ink-2)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {formatPrice(effTotal, currency)}
                </div>
              </div>
            </div>
          ) : (
            <div className="pdp-price-bar">
              <div>
                <div className="pdp-price-from">Precio</div>
                <div className="pdp-price" style={{fontSize: 20}}>
                  Consultar con asesor
                </div>
              </div>
            </div>
          )}

          {/* El precio dejó de estar tras el login, pero sigue siendo precio
              de lista: volumen, decorado y plazo se cierran en la cotización.
              Decirlo aquí evita que se lea como un total cerrado. */}
          {unit != null && (
            <p className="pdp-price-note">
              {currency} · sin IVA · precio de lista
            </p>
          )}

          {/* DECORATION SELECTOR — también sin sesión: es lo que hace visible
              cómo la técnica y el volumen mueven el precio por pieza. */}
          {unit != null && decoProduct.techniques.length > 0 && (
            <div className="pdp-section">
              <h3>Decorado</h3>
              <DecorationSelector
                product={decoProduct}
                qty={qtyNum}
                onChange={setDecoDetail}
              />
            </div>
          )}

          {fueraDeMarca && (
            <div className="pdp-aviso-marca" role="status">
              Este producto no está disponible en los colores de tu marca.
              Puedes cotizarlo igual; tu ejecutiva te confirma las opciones.
            </div>
          )}

          {/* VARIANT OPTIONS (color/size as swatches) */}
          {productOptions.map((option) => {
            const isColor = /color/i.test(option.name);
            /* Al cliente con paleta se le ofrecen sólo sus tonos: enseñarle un
               azul que no puede pedir es ruido, y el loader ya le hizo aterrizar
               en un color suyo. `brandOptionValues` devuelve la lista entera
               cuando ninguno es de la marca — el producto que sólo se alcanza
               por link directo—, y ahí se ven todos marcados junto al aviso. */
            const valores = isColor
              ? brandOptionValues(option.optionValues, marcaColores)
              : option.optionValues;
            // Un solo valor no es una elección; la regla ya existía y se aplica
            // igual sobre la lista recortada.
            if (valores.length === 1) return null;
            return (
              <div className="pdp-section" key={option.name}>
                <h3>{option.name}</h3>
                <div className={isColor ? 'pdp-swatches' : 'pdp-printtech'}>
                  {valores.map((value) => {
                    const {
                      name,
                      variantUriQuery,
                      selected,
                      available,
                      swatch,
                    } = value;
                    const bg = swatch?.color || colorHex(name);
                    if (isColor) {
                      const deMarca = esTonoDeMarca(name, marcaColores);
                      return (
                        <Link
                          key={option.name + name}
                          to={`?${variantUriQuery}`}
                          preventScrollReset
                          replace
                          className={`pdp-swatch ${selected ? 'active' : ''} ${deMarca ? '' : 'pdp-swatch-ajeno'}`}
                          // Única fuente de verdad para la opacidad: una regla de clase
                          // nunca gana a este inline, así que el estado "ajeno" tiene que
                          // decidirse aquí también. No disponible manda sobre ajeno.
                          style={{'--c': bg, opacity: !available ? 0.3 : deMarca ? 1 : 0.45}}
                          title={deMarca ? name : `${name} · fuera de tu marca`}
                          aria-label={deMarca ? name : `${name}, fuera de los colores de tu marca`}
                        />
                      );
                    }
                    return (
                      <Link
                        key={option.name + name}
                        to={`?${variantUriQuery}`}
                        preventScrollReset
                        replace
                        className={selected ? 'active' : ''}
                        style={{opacity: available ? 1 : 0.4}}
                      >
                        <span>{name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* QUANTITY */}
          <div className="pdp-section">
            <h3>Cantidad</h3>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: isOutOfStock ? 'var(--err)' : 'var(--ink-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 12,
              }}
            >
              {quantityAvailable != null
                ? quantityAvailable > 0
                  ? `Inventario: ${quantityAvailable} piezas`
                  : 'Agotado'
                : selectedVariant?.availableForSale
                  ? 'Disponible'
                  : 'Agotado'}
            </div>
            <div style={{display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
              <div className="pdp-qty">
                <button onClick={() => setQty(Math.max(1, qtyNum - 1))} aria-label="Disminuir cantidad">
                  <Icon name="minus" size={14} />
                </button>
                <input
                  type="number"
                  value={qty}
                  min={1}
                  inputMode="numeric"
                  aria-label="Cantidad"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') return setQty('');
                    const n = parseInt(v, 10);
                    if (!Number.isNaN(n)) setQty(Math.max(1, n));
                  }}
                  onBlur={() => {
                    if (qty === '' || qty < 1) setQty(1);
                  }}
                />
                <button onClick={() => setQty(qtyNum + 1)} aria-label="Aumentar cantidad">
                  <Icon name="plus" size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="pdp-actions">
            <Button
              variant="accent"
              size="lg"
              icon="quote"
              onClick={handleQuote}
              disabled={Boolean(decoError) || !selectedVariant?.id || isOutOfStock}
            >
              {isOutOfStock ? 'Agotado' : 'Añadir a cotización'}
            </Button>
            <button
              className="appbar-iconbtn"
              style={{width: 48, height: 48, border: '1px solid var(--line-strong)'}}
              onClick={() => toggleFav(product.id)}
              aria-label="Favorito"
            >
              <Icon name={isFav ? 'heart_fill' : 'heart_outline'} size={18} className="" />
            </button>
          </div>

          {/* DELIVERY GRID */}
          <div className="pdp-trust">
            {[
              {icon: 'truck', label: 'Producción', value: 'Bajo pedido'},
              {icon: 'package', label: 'Personalización', value: 'Incluida'},
              {icon: 'shield', label: 'Garantía', value: 'Reposición s/c'},
            ].map((m) => (
              <div key={m.label} className="pdp-trust-item">
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    flexShrink: 0,
                    background: 'var(--bg-soft)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--ink-2)',
                  }}
                >
                  <Icon name={m.icon} size={15} />
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--ink-4)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {m.label}
                  </div>
                  <div style={{fontSize: 13, fontWeight: 500, marginTop: 2}}>{m.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="pdp-tabs">
        <div className="pdp-tabs-nav">
          {[
            {k: 'desc', l: 'Descripción'},
            {k: 'specs', l: 'Especificaciones'},
            {k: 'logistics', l: 'Envío y devoluciones'},
          ].map((t) => (
            <button key={t.k} className={tab === t.k ? 'active' : ''} onClick={() => setTab(t.k)}>
              {t.l}
            </button>
          ))}
        </div>
        <div className="pdp-tabs-body">
          {tab === 'desc' && (
            <div
              style={{maxWidth: 720}}
              dangerouslySetInnerHTML={{
                __html:
                  product.descriptionHtml ||
                  `<p>${separarFrasesPegadas(product.description) || 'Producto promocional personalizable.'}</p>`,
              }}
            />
          )}
          {tab === 'specs' && (
            <table>
              <tbody>
                <tr><td>SKU</td><td className="mono">{selectedVariant?.sku || product.handle}</td></tr>
                <tr><td>Marca</td><td>Generando Ideas</td></tr>
                {/* Material, Medidas y Área de impresión salen de metafields y
                    sólo aparecen si traen dato: un campo vacío o en cero
                    (0, 0x0x0) no pinta fila. */}
                {specs.map((s) => (
                  <tr key={s.label}>
                    <td>{s.label}</td>
                    <td>{s.value}</td>
                  </tr>
                ))}
                <tr><td>Técnicas</td><td>{decoProduct.techniques.length ? decoProduct.techniques.join(' · ') : 'Consultar con asesor'}</td></tr>
                <tr><td>Origen</td><td>México</td></tr>
              </tbody>
            </table>
          )}
          {tab === 'logistics' && (
            <table>
              <tbody>
                {/* "Según técnica y volumen" no es una respuesta: el comprador
                    llega aquí porque necesita saber si le da tiempo, y unas
                    pantallas después le pedimos una fecha objetivo. Mientras no
                    haya plazos por técnica en los metafields, se dice cuándo
                    tendrá el dato y quién se lo da. */}
                <tr>
                  <td>Tiempo de producción</td>
                  <td>Tu asesor lo confirma al cotizar, en menos de 24 h hábiles</td>
                </tr>
                <tr><td>Flete</td><td>CDMX y Zona Metropolitana</td></tr>
                <tr><td>Devoluciones</td><td>Reposición sin costo en defectos de fabricación</td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
      </div>

      {/* PRODUCTOS SIMILARES */}
      {recommendations.length > 0 && (
        <section className="section container" style={{paddingTop: 8}}>
          <div className="section-head">
            <div>
              <div className="eyebrow">// Relacionados</div>
              <h2>Productos similares</h2>
            </div>
            <Button
              variant="ghost"
              iconRight="arrow_right"
              onClick={() => navigate('/catalogo')}
            >
              Ver catálogo
            </Button>
          </div>
          <div className="product-grid">
            {recommendations.slice(0, 4).map((rec) => (
              <ProductCard key={rec.id} product={rec} />
            ))}
          </div>
        </section>
      )}

      {/* VISTOS RECIENTEMENTE */}
      <RecentlyViewed current={recentSnapshot} />

      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price?.amount || '0',
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </>
  );
}

/* Se exportan para poder probar la decisión sin montar la ficha entera, que
   arrastra media aplicación. */

/**
 * ¿Este producto no se puede pedir en ningún color de la marca? Es la misma
 * pregunta que hace productMatchesBrand en los listados, sobre la forma que
 * tiene aquí el producto (opciones de la Storefront API, no normalizado).
 * @param {{optionValues?: Array<{name: string}>}|undefined} colorOption
 * @param {string[]} marcaColores
 */
export function esFueraDeMarca(colorOption, marcaColores) {
  if (!marcaColores?.length || !colorOption) return false;
  return !productMatchesBrand(
    {colors: (colorOption.optionValues || []).map((v) => v.name)},
    marcaColores,
  );
}

/** ¿Este tono concreto pertenece a la paleta de la marca? */
export function esTonoDeMarca(nombre, marcaColores) {
  if (!marcaColores?.length) return true;
  return productMatchesBrand({colors: [nombre]}, marcaColores);
}

/**
 * Los `selectedOptions` a los que hay que redirigir para que la ficha arranque
 * en un color de la marca, o null si no hay que redirigir.
 *
 * Sin esto, ocultar los tonos ajenos deja la ficha peor que antes: aterriza en
 * una variante que ya no aparece en el selector, y su foto, su precio y el
 * botón de cotizar apuntan a un color que el cliente no puede pedir.
 *
 * El destino es siempre una variante que YA sabemos que es de su paleta, así
 * que la comprobación de "ya está en su color" corta el bucle en la carga
 * siguiente.
 *
 * @param {object} product tal como lo devuelve PRODUCT_QUERY
 * @param {string[]} marcaColores
 * @returns {Array<{name: string, value: string}>|null}
 */
export function opcionesDeMarca(product, marcaColores) {
  if (!marcaColores?.length) return null;
  const colorOption = (product?.options || []).find((o) => /color/i.test(o?.name || ''));
  if (!colorOption) return null;
  // Sin ningún color suyo no hay a dónde llevarle: la ficha le enseña todos los
  // tonos junto a su banda de aviso.
  if (esFueraDeMarca(colorOption, marcaColores)) return null;
  const actual = (product?.selectedOrFirstAvailableVariant?.selectedOptions || []).find(
    (o) => /color/i.test(o?.name || ''),
  );
  if (actual && esTonoDeMarca(actual.value, marcaColores)) return null;
  const [primero] = brandOptionValues(colorOption.optionValues, marcaColores) || [];
  return primero?.firstSelectableVariant?.selectedOptions ?? null;
}

/* Un producto retirado o renombrado es el 404 más común de esta tienda: llega
   desde un enlace viejo en un correo del asesor. Se resuelve dentro del layout
   para no tirar la cabecera ni la cotización que el comprador ya llevaba. */
export function ErrorBoundary() {
  return (
    <div className="container">
      <RouteError
        titulo="Este producto ya no está disponible"
        descripcion="Puede que lo hayamos retirado o que haya cambiado de nombre. Busca en el catálogo o pregúntale a tu asesor por el SKU."
        acciones={
          <div style={{display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap'}}>
            <Link className="btn btn-accent" to="/catalogo">
              Ver catálogo
            </Link>
            <Link className="btn btn-ghost" to="/contacto">
              Hablar con un asesor
            </Link>
          </div>
        }
      />
    </div>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice { amount currencyCode }
    id
    image { __typename id url altText width height }
    price { amount currencyCode }
    product { title handle }
    selectedOptions { name value }
    sku
    title
    unitPrice { amount currencyCode }
    quantityAvailable
  }
`;

/* Los metafields de abajo cubren dos usos distintos:
   - `tecnicas_de_impresion` y `material` alimentan el motor de decoración
     (`material` es la superficie con la que se calcula el precio).
   - `material_front`, `medidas` y `area_de_impresion` son la ficha técnica que
     lee el cliente; las procesa `~/lib/specs`, que oculta las vacías y las
     que vienen en cero. Ojo: `material` y `material_front` NO son el mismo
     campo ni tienen el mismo contenido. */
const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    handle
    tags
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    featuredImage { url altText }
    images(first: 25) { nodes { id url altText width height } }
    options {
      name
      optionValues {
        name
        firstSelectableVariant { ...ProductVariant }
        swatch { color image { previewImage { url } } }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    metafields(identifiers: [
      {namespace: "custom", key: "tecnicas_de_impresion"},
      {namespace: "custom", key: "material"},
      {namespace: "custom", key: "material_front"},
      {namespace: "custom", key: "medidas"},
      {namespace: "custom", key: "area_de_impresion"}
    ]) { key namespace value }
    seo { description title }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
`;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
`;
