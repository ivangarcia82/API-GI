import {swatchFor} from '~/lib/mochilas/colors';

/** Círculo de color; los compuestos ("Azul / Negro") van partidos a la mitad. */
export function Swatch({color}) {
  const {tones} = swatchFor(color);
  const background =
    tones.length > 1
      ? `linear-gradient(135deg, ${tones[0]} 50%, ${tones[1]} 50%)`
      : tones[0];
  return <span className="mc-swatch" style={{background}} aria-hidden="true" />;
}

/**
 * Colores de un modelo. Con uno solo no hay nada que elegir: se muestra como
 * texto. Con varios, un grupo de radios con la muestra de cada color.
 */
export function ColorPicker({product, variantId, onChange, name}) {
  const current = product.variants.find((v) => v.id === variantId) ?? product.variants[0];

  if (product.variants.length === 1) {
    return (
      <p className="mc-color-single">
        <Swatch color={current.color} />
        <span>{current.color}</span>
      </p>
    );
  }

  return (
    <div className="mc-color-picker" role="radiogroup" aria-label={`Color de ${product.name}`}>
      <div className="mc-color-options">
        {product.variants.map((v) => (
          <label key={v.id} className="mc-color-option" title={v.color}>
            <input
              type="radio"
              name={name}
              value={v.id}
              checked={v.id === current.id}
              onChange={() => onChange(v.id)}
              aria-label={v.color}
            />
            <Swatch color={v.color} />
          </label>
        ))}
      </div>
      <span className="mc-color-name" aria-hidden="true">
        {current.color}
      </span>
    </div>
  );
}
