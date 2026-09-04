import {useLoaderData, Link, useNavigate} from 'react-router';
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
import {keepBrandProducts} from '~/lib/brand-colors';
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

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
  ]);

  if (!product?.id) throw new Response(null, {status: 404});
  redirectIfHandleIsLocalized(request, {handle, data: product});

  // Inventory comes from the Admin API (the Hydrogen-managed Storefront token
  // can't get the inventory scope). Best-effort: needs the Admin `read_inventory`
  // scope + a real Admin token; degrades to null (no badge) otherwise.
  // Related products power the "Productos similares" strip; best-effort too.
  const [stock, recomendacionesCrudas, marca] = await Promise.all([
    getVariantInventory(context.env, product.selectedOrFirstAvailableVariant?.id),
    storefront
      .query(GI_PRODUCT_RECOMMENDATIONS_QUERY, {variables: {productId: product.id}})
      .then((r) =>
        (r?.productRecommendations || [])
          .map(normalizeProduct)
          .filter((p) => p && p.id !== product.id),
      )
      .catch(() => []),
    getBrandColors(context),
  ]);

  const marcaColores = marca?.families || [];
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

export default function Product() {
  const {product, stock, recommendations = []} = useLoaderData();
  const navigate = useNavigate();
  const {isLoggedIn, favs, toggleFav, addToQuote, openQuoteDrawer} = useApp();
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
    colors: colorOption
      ? colorOption.optionValues.map((v) => v.name).slice(0, 8)
      : [],
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
      await addToQuote({
        variantId: selectedVariant.id,
        // metadata used only by the anonymous client-side fallback render:
        productId: product.id,
        handle: product.handle,
        title: product.title,
        sku: selectedVariant.sku,
        image: mainImage,
        options: selectedVariant.selectedOptions,
        // the five fields the server reads (spec §7.2); default to no decoration
        // when the selector has not emitted a detail yet:
        technique: decoDetail?.technique ?? 'Sin decorado',
        surface: decoDetail?.surface ?? '',
        size: decoDetail?.size ?? '',
        qty: qtyNum,
      });
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
              {!isLoggedIn && ' · inicia sesión para cotizar'}
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

          {/* VARIANT OPTIONS (color/size as swatches) */}
          {productOptions.map((option) => {
            if (option.optionValues.length === 1) return null;
            const isColor = /color/i.test(option.name);
            return (
              <div className="pdp-section" key={option.name}>
                <h3>{option.name}</h3>
                <div className={isColor ? 'pdp-swatches' : 'pdp-printtech'}>
                  {option.optionValues.map((value) => {
                    const {
                      name,
                      variantUriQuery,
                      selected,
                      available,
                      swatch,
                    } = value;
                    const bg = swatch?.color || colorHex(name);
                    if (isColor) {
                      return (
                        <Link
                          key={option.name + name}
                          to={`?${variantUriQuery}`}
                          preventScrollReset
                          replace
                          className={`pdp-swatch ${selected ? 'active' : ''}`}
                          style={{'--c': bg, opacity: available ? 1 : 0.3}}
                          title={name}
                          aria-label={name}
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
            {!isLoggedIn ? (
              <Button
                variant="accent"
                size="lg"
                iconRight="arrow_right"
                onClick={() => navigate('/login')}
                style={{width: '100%', justifyContent: 'center'}}
              >
                Iniciar sesión para cotizar
              </Button>
            ) : (
              <>
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
                  <Icon
                    name={isFav ? 'heart_fill' : 'heart_outline'}
                    size={18}
                    className=""
                  />
                </button>
              </>
            )}
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
