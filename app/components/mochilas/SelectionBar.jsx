import {Icon} from '~/components/gi/Icon';

/** Barra fija con la mochila elegida; lleva al formulario desde cualquier punto. */
export function SelectionBar({selection, onContinue}) {
  const {line, product, variant} = selection;
  return (
    <section className="mc-bar" aria-label="Tu elección">
      <div className="mc-bar-inner">
        {variant.image ? <img className="mc-bar-thumb" src={variant.image} alt="" width="44" height="55" /> : null}
        <p className="mc-bar-text">
          <span className="mc-bar-label">Tu elección</span>
          <strong>{`${line.name} ${product.name} · ${variant.color}`}</strong>
        </p>
        <button type="button" className="mc-btn mc-btn-primary" onClick={onContinue}>
          Continuar
          <Icon name="arrow_right" size={16} strokeWidth={2.2} />
        </button>
      </div>
    </section>
  );
}
