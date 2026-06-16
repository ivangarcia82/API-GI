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
import {Button, PH} from '~/components/gi/ui';
import {AddToCartButton} from '~/components/AddToCartButton';
import {useApp, useToast} from '~/lib/AppContext';
import {formatPrice, colorHex, TECHNIQUES} from '~/lib/gi';
import DecorationSelector from '~/components/gi/DecorationSelector.jsx';
import {getTechniques, calcDecoration} from '~/lib/decoration/engine.js';

export const meta = ({data}) => [
  {title: `${data?.product?.title ?? 'Producto'} · Generando Ideas`},
  {rel: 'canonical', href: `/products/${data?.product?.handle}`},
];

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
  return {product};
}

export default function Product() {
  const {product} = useLoaderData();
  const navigate = useNavigate();
  const {isLoggedIn, canBuy, favs, toggleFav} = useApp();
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
  const currency = selectedVariant?.price?.currencyCode || 'MXN';

  const images = product.images?.nodes?.length
    ? product.images.nodes
    : [selectedVariant?.image].filter(Boolean);

  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [hasFile, setHasFile] = useState(false);
  const [technique, setTechnique] = useState(TECHNIQUES[0].id);
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
  const decoCalc = decoDetail
    ? calcDecoration(
        decoDetail.technique,
        decoDetail.surface,
        decoDetail.qty,
        decoDetail.size,
      )
    : null;
  const decoError = Boolean(decoCalc && decoCalc.error);

  const isFav = favs.includes(product.id);
  const total = unit != null ? unit * qty : null;
  const isNew = (product.tags || []).includes('nuevo');
  const isOffer = (product.tags || []).includes('oferta');
  const mainImage = images[activeImg]?.url || selectedVariant?.image?.url;

  const {addToQuote} = useApp();
  const handleQuote = () => {
    addToQuote({
      variantId: selectedVariant.id,
      productId: product.id,
      handle: product.handle,
      title: product.title,
      sku: selectedVariant.sku,
      image: mainImage,
      price: unit,
      qty,
      options: selectedVariant.selectedOptions,
    });
    toast(`${product.title} en tu lista de cotización`, {icon: 'quote', accent: true});
  };

  return (
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
            <PH src={mainImage} alt={product.title} aspect="ph-square" />
          </div>
          {images.length > 1 && (
            <div className="pdp-thumbs">
              {images.slice(0, 5).map((img, i) => (
                <div
                  key={i}
                  className={`pdp-thumb ${activeImg === i ? 'active' : ''}`}
                  onClick={() => setActiveImg(i)}
                >
                  <PH src={img.url} alt="" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* INFO */}
        <div className="pdp-info">
          <div className="pdp-meta">
            {isNew && <span className="tag tag-accent">Nuevo</span>}
            {isOffer && <span className="tag tag-ink">Oferta</span>}
            {selectedVariant?.availableForSale && (
              <span className="tag tag-ok tag-dot">En stock</span>
            )}
            <span className="pdp-sku">{selectedVariant?.sku || product.handle}</span>
          </div>

          <h1 className="pdp-title">{product.title}</h1>

          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div style={{display: 'flex', gap: 1, color: 'var(--accent-deep)'}}>
              {[0, 1, 2, 3, 4].map((s) => (
                <Icon key={s} name="star_fill" size={14} />
              ))}
            </div>
            <span style={{fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)'}}>
              {product.vendor ? `Línea ${product.vendor}` : 'Producto promocional'}
            </span>
          </div>

          {product.description && <p className="pdp-desc">{product.description}</p>}

          {/* PRICE */}
          {isLoggedIn ? (
            <div className="pdp-price-bar">
              <div>
                <div className="pdp-price-from">Precio por pieza</div>
                <div className="pdp-price">{formatPrice(unit, currency)}</div>
              </div>
              <div style={{textAlign: 'right'}}>
                <div className="pdp-price-from">Total · {qty} pz</div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 22,
                    color: 'var(--ink-2)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {formatPrice(total, currency)}
                </div>
              </div>
            </div>
          ) : (
            <div className="pdp-gated">
              <Icon name="eye_off" size={20} className="muted-2" />
              <h3>Precios solo para clientes registrados</h3>
              <p>Crea tu cuenta gratuita para ver precios, cotizar y comprar.</p>
              <div style={{display: 'flex', gap: 8, justifyContent: 'center'}}>
                <Button variant="accent" iconRight="arrow_right" onClick={() => navigate('/registro')}>
                  Crear cuenta
                </Button>
                <Button variant="ghost" onClick={() => navigate('/login')}>
                  Iniciar sesión
                </Button>
              </div>
            </div>
          )}

          {/* DECORATION SELECTOR */}
          {isLoggedIn && unit != null && decoProduct.techniques.length > 0 && (
            <div className="pdp-section">
              <h3>Decorado</h3>
              <DecorationSelector
                product={decoProduct}
                basePrice={unit}
                qty={qty}
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
                      handle,
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
            <div style={{display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap'}}>
              <div className="pdp-qty">
                <button onClick={() => setQty(Math.max(1, qty - 1))}>
                  <Icon name="minus" size={14} />
                </button>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, +e.target.value || 1))}
                  min={1}
                />
                <button onClick={() => setQty(qty + 1)}>
                  <Icon name="plus" size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* CUSTOMIZATION */}
          <div className="pdp-custom">
            <div className="pdp-custom-head">
              <h3>Personalización</h3>
              <span className="pdp-custom-tag">Incluida</span>
            </div>
            <p style={{margin: 0, fontSize: 14, color: 'var(--ink-3)'}}>
              Sube tu logo (vector preferido) y selecciona técnica. Recibirás un dummy
              digital para aprobar antes de producción.
            </p>

            <label
              className={`pdp-upload ${hasFile ? 'has-file' : ''}`}
              style={{display: 'block'}}
            >
              <input
                type="file"
                accept=".svg,.ai,.pdf,.png,.jpg"
                style={{display: 'none'}}
                onChange={(e) => setHasFile(e.target.files?.length > 0)}
              />
              <Icon name={hasFile ? 'check' : 'upload'} size={24} className="upload-icon" />
              <div className="upload-text">
                {hasFile ? 'Logotipo cargado · listo' : 'Arrastra o selecciona tu logotipo'}
              </div>
              <div className="upload-hint">
                {hasFile
                  ? 'Click para reemplazar'
                  : 'Vector preferido · SVG, AI, PDF · Máx 10 MB'}
              </div>
            </label>

            <div style={{marginTop: 20}}>
              <h3
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  color: 'var(--ink-4)',
                  textTransform: 'uppercase',
                  margin: '0 0 12px',
                }}
              >
                Técnica de impresión
              </h3>
              <div className="pdp-printtech">
                {TECHNIQUES.map((t) => (
                  <button
                    key={t.id}
                    className={technique === t.id ? 'active' : ''}
                    onClick={() => setTechnique(t.id)}
                  >
                    <span>{t.name}</span>
                    <span className="pt-cost">{t.cost}</span>
                  </button>
                ))}
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
                {canBuy && selectedVariant?.availableForSale && (
                  <AddToCartButton
                    lines={[{merchandiseId: selectedVariant.id, quantity: qty}]}
                    onClick={() =>
                      toast(`${qty} pz de ${product.title} en tu carrito`, {
                        icon: 'cart',
                        accent: true,
                      })
                    }
                  >
                    <span
                      className="btn btn-accent btn-lg"
                      style={{display: 'inline-flex'}}
                    >
                      <Icon name="cart" size={18} /> Añadir al carrito
                    </span>
                  </AddToCartButton>
                )}
                <Button
                  variant={canBuy ? 'ghost' : 'accent'}
                  size="lg"
                  icon="quote"
                  onClick={handleQuote}
                  disabled={decoError}
                >
                  Añadir a cotización
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 16,
              padding: '20px 0',
              borderTop: '1px solid var(--line)',
              marginTop: 8,
            }}
          >
            {[
              {icon: 'truck', label: 'Producción', value: '8–15 días'},
              {icon: 'package', label: 'Personalización', value: 'Incluida'},
              {icon: 'shield', label: 'Garantía', value: 'Reposición s/c'},
            ].map((m) => (
              <div key={m.label} style={{display: 'flex', gap: 10}}>
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
                  `<p>${product.description || 'Producto promocional personalizable.'}</p>`,
              }}
            />
          )}
          {tab === 'specs' && (
            <table>
              <tbody>
                <tr><td>SKU</td><td className="mono">{selectedVariant?.sku || product.handle}</td></tr>
                <tr><td>Proveedor</td><td>{product.vendor || 'Generando Ideas'}</td></tr>
                <tr><td>Técnicas</td><td>{TECHNIQUES.map((t) => t.name).join(' · ')}</td></tr>
                <tr><td>Tiempo de producción</td><td>8–15 días hábiles</td></tr>
                <tr><td>Origen</td><td>México · proveeduría seleccionada</td></tr>
              </tbody>
            </table>
          )}
          {tab === 'logistics' && (
            <table>
              <tbody>
                <tr><td>Tiempo de producción</td><td>8–15 días hábiles</td></tr>
                <tr><td>Envío nacional</td><td>2–5 días hábiles, paquetería seleccionada</td></tr>
                <tr><td>Cobertura</td><td>Toda la República Mexicana</td></tr>
                <tr><td>Devoluciones</td><td>Reposición sin costo en defectos de fabricación</td></tr>
                <tr><td>Fulfillment</td><td>Disponible · envíos individuales con tu identidad</td></tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price?.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
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
  }
`;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    tags
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    featuredImage { url altText }
    images(first: 6) { nodes { url altText width height } }
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
      {namespace: "custom", key: "material"}
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
