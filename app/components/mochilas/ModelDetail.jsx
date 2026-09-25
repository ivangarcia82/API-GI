import {useEffect, useRef} from 'react';
import {Icon} from '~/components/gi/Icon';
import {ColorPicker} from './Swatches.jsx';

/**
 * Detalle de un modelo en un <dialog> nativo: showModal() lo pone en la capa
 * superior (por encima del header), atrapa el foco y deja inerte la página.
 */
export function ModelDetail({lineName, product, variantId, onColor, onChoose, onClose}) {
  const ref = useRef(null);
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const titleId = `mc-detail-${product.id}`;

  // onClose cambia en cada render del padre: se lee por ref para que abrir el
  // dialog no se repita al cambiar de color.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return undefined;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  const close = () => onCloseRef.current();

  return (
    // Un clic en el fondo cae sobre el propio <dialog>; dentro, sobre sus hijos.
    // El teclado cierra con Escape (nativo) o con el botón.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className="mc-detail"
      aria-labelledby={titleId}
      data-lenis-prevent
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="mc-detail-inner">
        <button type="button" className="mc-detail-close" onClick={close} aria-label="Cerrar">
          <Icon name="x" size={20} />
        </button>
        <div className="mc-detail-media">
          {variant.image ? (
            <img src={variant.image} alt={`Mochila ${product.name} en ${variant.color}`} />
          ) : null}
        </div>
        <div className="mc-detail-body">
          <p className="mc-detail-line">Línea {lineName}</p>
          <h3 id={titleId} className="mc-detail-title">
            {product.name}
          </h3>
          {product.description ? <p className="mc-detail-text">{product.description}</p> : null}
          <ColorPicker
            product={product}
            variantId={variant.id}
            name={`mc-detail-color-${product.id}`}
            onChange={(id) => onColor(product.id, id)}
          />
          <button
            type="button"
            className="mc-btn mc-btn-primary mc-btn-lg"
            onClick={() => onChoose(variant.id)}
          >
            Elegir esta
          </button>
        </div>
      </div>
    </dialog>
  );
}
