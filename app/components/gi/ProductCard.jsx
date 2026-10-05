/* Generando Ideas — product card (grid + list views) */
import {Link, useNavigate} from 'react-router';
import {Icon} from './Icon';
import {Button, PH} from './ui';
import {useApp, useToast} from '~/lib/AppContext';
import {formatPrice, colorHex} from '~/lib/gi';
import {brandOptionValues, brandVariantId} from '~/lib/brand-colors';

/* El recorte es de presentación y vive aquí a propósito: `product.colors` trae
   todos los tonos del producto porque de ahí sale también el filtrado por la
   paleta del cliente.
   Al cliente con paleta se le enseñan sólo sus tonos: ver un azul en la tarjeta
   y no encontrarlo en la ficha sería peor que no verlo. La paleta se lee del
   contexto y no por props para no atravesar con ella las cinco pantallas que
   pintan tarjetas. */
function Swatches({colors, size = 14}) {
  const {brandColors} = useApp();
  const suyos = brandOptionValues(colors, brandColors);
  return (
    <div style={{display: 'flex', gap: 6, marginTop: 8}}>
      {suyos.slice(0, 5).map((c) => (
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
 * Precio de la tarjeta. Se pinta con o sin sesión: el comprador que compara
 * proveedores no abre una cuenta para saber si estamos en su rango. Cotizar
 * sí sigue pidiendo login (ver AddControl).
 *
 * `product.price` es null cuando la variante no trae precio (normalizeProduct
 * en ~/lib/gi) y formatPrice devuelve '' con null: sin esta rama la tarjeta
 * pintaría "desde" seguido de un hueco.
 */
function Precio({product, view}) {
  if (product.price == null) {
    return <span className="pcard-price-ask">Consultar con asesor</span>;
  }
  const importe = formatPrice(product.price, product.currency);
  if (view === 'list') {
    return (
      <div style={{textAlign: 'right'}}>
        <div className="pcard-price-from">Desde</div>
        <div className="pcard-price">{importe}</div>
      </div>
    );
  }
  return (
    <div>
      <span className="pcard-price-from">desde</span>
      <span className="pcard-price">{importe}</span>
    </div>
  );
}

/**
 * Add control: añade a la lista de cotización. Con sesión va al servidor; sin
 * ella al carrito de invitado en localStorage, que se migra al entrar.
 * (No hay flujo de compra — sólo cotización.)
 */
export function AddControl({product, label, variant, size = 'sm', className = ''}) {
  const navigate = useNavigate();
  const {addToQuote, openQuoteDrawer, brandColors} = useApp();
  /* `firstVariantId` es la primera variante que devolvió la consulta y puede
     ser de cualquier color: a un cliente con paleta le metería en la cotización
     una variante que no puede pedir. */
  const variantId = brandVariantId(product, brandColors);
  const toast = useToast();

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
        if (!variantId) {
          navigate(`/products/${product.handle}`);
          return;
        }
        addToQuote({
          variantId,
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
  const {favs, toggleFav} = useApp();
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
            {product.available === false && <span className="tag tag-soldout">Agotado</span>}
            {product.isNew && <span className="tag tag-accent">Nuevo</span>}
            {product.isOffer && <span className="tag tag-ink">Oferta</span>}
          </div>
          <div className="pcard-name">{titleLink}</div>
          <div className="pcard-sku">{product.sku}</div>
          {product.colors.length > 0 && <Swatches colors={product.colors} size={16} />}
        </div>
        <div className="pcard-list-actions">
          <Precio product={product} view="list" />
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
          {/* Desde la portada: no hay que entrar a la ficha para saberlo. */}
          {product.available === false && <span className="tag tag-soldout">Agotado</span>}
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
          <Precio product={product} />
        </div>
      </div>
    </article>
  );
}
