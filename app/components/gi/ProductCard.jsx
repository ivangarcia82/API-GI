/* Generando Ideas — product card (grid + list views) */
import {Link, useNavigate} from 'react-router';
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
 * Add control: logged-in users add to the client-side quote list; guests are
 * routed to the product detail. (No purchase flow — quote-only.)
 */
export function AddControl({product, label, variant, size = 'sm', className = ''}) {
  const navigate = useNavigate();
  const {isLoggedIn, addToQuote, openQuoteDrawer} = useApp();
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

  return (
    <Button
      variant={variant}
      size={size}
      icon="quote"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        // Quick-add needs a real ProductVariant gid to price + image the line.
        // Without one, send the user to the PDP to choose a variant instead of
        // creating a $0, imageless quote line.
        if (!product.firstVariantId) {
          navigate(`/products/${product.handle}`);
          return;
        }
        addToQuote({
          variantId: product.firstVariantId,
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
      {label || 'Cotizar'}
    </Button>
  );
}

/**
 * Checkbox that opts a product into the catalog's bulk "añadir a cotización".
 * No hace falta frenar la propagación: el enlace estirado es un hermano con
 * menos z-index (ver .pcard-select en gi-screens.css), no un ancestro, así que
 * el clic nunca llega a él.
 */
function SelectBox({product, selected, onToggle}) {
  return (
    <label className={`pcard-select ${selected ? 'on' : ''}`}>
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(product)}
        aria-label={`Seleccionar ${product.title} para cotizar`}
      />
      <Icon name="check" size={13} strokeWidth={3} />
    </label>
  );
}

/**
 * @param {object} props
 * @param {boolean} [props.selectable] show the bulk-selection checkbox
 * @param {boolean} [props.selected]   current selection state
 * @param {(p: object) => void} [props.onToggleSelect]
 */
export function ProductCard({
  product,
  view = 'grid',
  selectable = false,
  selected = false,
  onToggleSelect,
}) {
  const {isLoggedIn, favs, toggleFav} = useApp();
  const toast = useToast();
  const isFav = favs.includes(product.id);

  /* The title is a real <a> whose ::after covers the whole card ("stretched
     link"). That keeps cmd-click, middle-click, right-click → open in new tab
     and the browser status bar working — the behaviour a B2B buyer relies on
     to compare a dozen products — while the card still reads as one target.
     Everything interactive on top of it needs z-index (see gi-screens.css). */
  const titleLink = (
    <Link className="pcard-link" to={`/products/${product.handle}`} prefetch="intent">
      {product.title}
    </Link>
  );

  if (view === 'list') {
    return (
      <article className={`pcard-list lift ${selected ? 'is-selected' : ''}`}>
        {selectable && (
          <SelectBox product={product} selected={selected} onToggle={onToggleSelect} />
        )}
        <PH src={product.image} alt={product.imageAlt} zoom />
        <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
          <div style={{display: 'flex', gap: 6}}>
            {product.isNew && <span className="tag tag-accent">Nuevo</span>}
            {product.isOffer && <span className="tag tag-ink">Oferta</span>}
          </div>
          <div className="pcard-name">{titleLink}</div>
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
          <AddControl product={product} variant="primary" />
        </div>
      </article>
    );
  }

  return (
    <article className={`pcard ${selected ? 'is-selected' : ''}`}>
      <div className="pcard-img">
        <PH src={product.image} alt={product.imageAlt} zoom />
        <div className="pcard-badges">
          {product.isNew && <span className="tag tag-accent">Nuevo</span>}
          {product.isOffer && <span className="tag tag-ink">Oferta</span>}
        </div>
        {selectable && (
          <SelectBox product={product} selected={selected} onToggle={onToggleSelect} />
        )}
        <button
          className={`pcard-fav ${isFav ? 'on' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(product.id);
            toast(isFav ? 'Quitado de favoritos' : 'Agregado a favoritos', {
              icon: 'heart_fill',
            });
          }}
          aria-pressed={isFav}
          aria-label={
            isFav
              ? `Quitar ${product.title} de favoritos`
              : `Guardar ${product.title} en favoritos`
          }
        >
          <Icon name={isFav ? 'heart_fill' : 'heart_outline'} size={16} />
        </button>
        <div className="pcard-quickactions">
          <AddControl
            product={product}
            variant="primary"
            className="grow"
            label="Añadir a cotización"
          />
        </div>
      </div>
      <div className="pcard-info">
        <div className="pcard-sku">{product.sku}</div>
        <div className="pcard-name">{titleLink}</div>
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
    </article>
  );
}
