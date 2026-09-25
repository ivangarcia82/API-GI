import {Icon} from '~/components/gi/Icon';
import {ColorPicker} from './Swatches.jsx';

/**
 * @param {{product: any, variantId?: string, isChosen: boolean,
 *   onColor: (productId: string, variantId: string) => void,
 *   onChoose: (variantId: string) => void, onOpen: (productId: string) => void}} props
 */
export function ModelCard({product, variantId, isChosen, onColor, onChoose, onOpen}) {
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const nameId = `mc-card-${product.id}`;

  return (
    <article className={`mc-card${isChosen ? ' is-chosen' : ''}`} aria-labelledby={nameId}>
      <div className="mc-card-media">
        {variant.image ? (
          <img
            src={variant.image}
            alt={variant.imageAlt ?? `Mochila ${product.name} en ${variant.color}`}
            loading="lazy"
            width="480"
            height="600"
          />
        ) : null}
        {isChosen ? (
          <span className="mc-card-badge">
            <Icon name="check" size={14} strokeWidth={2.4} />
            Tu elección
          </span>
        ) : null}
      </div>

      <div className="mc-card-body">
        <h3 id={nameId} className="mc-card-name">
          {product.name}
        </h3>
        <ColorPicker
          product={product}
          variantId={variant.id}
          name={`mc-color-${product.id}`}
          onChange={(id) => onColor(product.id, id)}
        />
        <div className="mc-card-actions">
          <button
            type="button"
            className={`mc-btn ${isChosen ? 'mc-btn-chosen' : 'mc-btn-primary'}`}
            onClick={() => onChoose(variant.id)}
          >
            {isChosen ? <Icon name="check" size={16} strokeWidth={2.4} /> : null}
            {isChosen ? 'Elegida' : 'Elegir esta'}
          </button>
          <button
            type="button"
            className="mc-btn mc-btn-quiet"
            onClick={() => onOpen(product.id)}
            aria-label={`Ver detalles de ${product.name}`}
          >
            Detalles
          </button>
        </div>
      </div>
    </article>
  );
}
