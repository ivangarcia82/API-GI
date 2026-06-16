/* Generando Ideas — product card (grid + list views) */
import {useNavigate} from 'react-router';
import {CartForm} from '@shopify/hydrogen';
import {Icon} from './Icon';
import {Button, PH} from './ui';
import {useApp, useToast} from '~/lib/AppContext';
import {formatPrice, colorHex} from '~/lib/gi';

function Swatches({colors, size = 14}) {
  return (
    <div style={{display: 'flex', gap: 6, marginTop: 8}}>
      {colors.slice(0, 5).map((c) => (
        <div
          key={c}
          title={c}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: colorHex(c),
            border: '1px solid rgba(20,17,10,0.1)',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Add control: buyers submit to the Shopify cart, quoters add to the
 * client-side quote list, guests are routed to the product detail.
 */
export function AddControl({product, label, variant, size = 'sm', className = ''}) {
  const navigate = useNavigate();
  const {isLoggedIn, canBuy, addToQuote, openQuoteDrawer} = useApp();
  const toast = useToast();

  if (!isLoggedIn) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        iconRight="arrow_right"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/products/${product.handle}`);
        }}
      >
        Ver detalles
      </Button>
    );
  }

  if (canBuy && product.firstVariantId) {
    return (
      <CartForm
        route="/cart"
        inputs={{lines: [{merchandiseId: product.firstVariantId, quantity: 1}]}}
        action={CartForm.ACTIONS.LinesAdd}
      >
        {(fetcher) => (
          <Button
            type="submit"
            variant={variant}
            size={size}
            icon="cart"
            className={className}
            disabled={fetcher.state !== 'idle'}
            onClick={(e) => {
              e.stopPropagation();
              toast(`${product.title} agregado al carrito`, {
                icon: 'cart',
                accent: true,
              });
            }}
          >
            {label || 'Agregar'}
          </Button>
        )}
      </CartForm>
    );
  }

  // Quoter (or buyer without a variant) → quote list
  return (
    <Button
      variant={variant}
      size={size}
      icon="quote"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        addToQuote({
          variantId: product.firstVariantId || product.id,
          productId: product.id,
          handle: product.handle,
          title: product.title,
          sku: product.sku,
          image: product.image,
          price: product.price,
          qty: 1,
        });
        toast(`${product.title} agregado a tu cotización`, {
          icon: 'quote',
          accent: true,
        });
        openQuoteDrawer();
      }}
    >
      {canBuy ? 'Cotizar' : 'Cotizar'}
    </Button>
  );
}

export function ProductCard({product, view = 'grid'}) {
  const navigate = useNavigate();
  const {isLoggedIn, canBuy, favs, toggleFav} = useApp();
  const toast = useToast();
  const isFav = favs.includes(product.id);
  const go = () => navigate(`/products/${product.handle}`);

  if (view === 'list') {
    return (
      <div className="pcard-list lift" onClick={go}>
        <PH src={product.image} alt={product.imageAlt} zoom />
        <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
          <div style={{display: 'flex', gap: 6}}>
            {product.isNew && <span className="tag tag-accent">Nuevo</span>}
            {product.isOffer && <span className="tag tag-ink">Oferta</span>}
          </div>
          <div className="pcard-name">{product.title}</div>
          <div className="pcard-sku">{product.sku}</div>
          {product.colors.length > 0 && <Swatches colors={product.colors} size={16} />}
        </div>
        <div className="pcard-list-actions">
          {isLoggedIn ? (
            <div style={{textAlign: 'right'}}>
              <div className="pcard-price-from">Desde</div>
              <div className="pcard-price">
                {formatPrice(product.price, product.currency)}
              </div>
            </div>
          ) : (
            <div className="pcard-quote-label">
              <Icon name="eye_off" size={11} /> Inicia sesión
            </div>
          )}
          <AddControl product={product} variant={canBuy ? 'accent' : 'primary'} />
        </div>
      </div>
    );
  }

  return (
    <div className="pcard" onClick={go}>
      <div className="pcard-img">
        <PH src={product.image} alt={product.imageAlt} zoom />
        <div className="pcard-badges">
          {product.isNew && <span className="tag tag-accent">Nuevo</span>}
          {product.isOffer && <span className="tag tag-ink">Oferta</span>}
        </div>
        <button
          className={`pcard-fav ${isFav ? 'on' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(product.id);
            toast(isFav ? 'Quitado de favoritos' : 'Agregado a favoritos', {
              icon: 'heart_fill',
            });
          }}
          aria-label="Favorito"
        >
          <Icon name={isFav ? 'heart_fill' : 'heart_outline'} size={16} />
        </button>
        <div className="pcard-quickactions">
          <AddControl
            product={product}
            variant={canBuy ? 'accent' : 'primary'}
            className="grow"
            label={canBuy ? 'Añadir al carrito' : 'Añadir a cotización'}
          />
        </div>
      </div>
      <div className="pcard-info">
        <div className="pcard-sku">{product.sku}</div>
        <div className="pcard-name">{product.title}</div>
        {product.colors.length > 0 && <Swatches colors={product.colors} />}
        <div className="pcard-foot">
          {isLoggedIn ? (
            <div>
              <span className="pcard-price-from">desde</span>
              <span className="pcard-price">
                {formatPrice(product.price, product.currency)}
              </span>
            </div>
          ) : (
            <span className="pcard-quote-label">
              <Icon name="eye_off" size={11} /> Precio para clientes
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
