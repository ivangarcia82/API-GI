/* Generando Ideas — galería de la ficha como carrete.
 *
 * Algunos productos traen decenas de fotos (T730_NEGRO, CDO-K11…) y la
 * rejilla de miniaturas crecía hacia abajo hasta empujar todo lo demás. Aquí
 * las miniaturas van en una sola tira que se desliza, la foto principal tiene
 * flechas y contador, y la miniatura activa se mantiene a la vista.
 */
import {useEffect, useRef} from 'react';
import {Icon} from './Icon';
import {PH} from './ui';

/**
 * @param {{
 *   images: Array<{url: string}>,
 *   active: number,
 *   onSelect: (i: number) => void,
 *   title: string,
 * }} props
 */
export function GalleryReel({images, active, onSelect, title}) {
  const tiraRef = useRef(null);
  const total = images.length;
  const varias = total > 1;
  const actual = images[active] ?? images[0];

  const ir = (i) => onSelect((i + total) % total);

  // La miniatura activa siempre a la vista. Se desliza la tira a mano y no con
  // scrollIntoView, que además movía la página cuando la tira quedaba al
  // borde de la pantalla.
  useEffect(() => {
    const tira = tiraRef.current;
    const item = tira?.children[active];
    if (!tira || !item || typeof tira.scrollTo !== 'function') return;
    tira.scrollTo({
      left: item.offsetLeft - (tira.clientWidth - item.clientWidth) / 2,
      behavior: 'smooth',
    });
  }, [active]);

  const onKeyDown = (e) => {
    if (!varias) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      ir(active + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      ir(active - 1);
    }
  };

  return (
    <div className="pdp-gallery" role="region" aria-label={`Galería de ${title}`}>
      <div className="pdp-main">
        <PH key={actual?.url} src={actual?.url} alt={title} aspect="ph-square" />
        {varias && (
          <>
            <button
              type="button"
              className="pdp-nav pdp-nav-prev"
              aria-label="Imagen anterior"
              onClick={() => ir(active - 1)}
              onKeyDown={onKeyDown}
            >
              <Icon name="chevron_right" size={18} />
            </button>
            <button
              type="button"
              className="pdp-nav pdp-nav-next"
              aria-label="Imagen siguiente"
              onClick={() => ir(active + 1)}
              onKeyDown={onKeyDown}
            >
              <Icon name="chevron_right" size={18} />
            </button>
            <span className="pdp-count" aria-live="polite">
              {active + 1} / {total}
            </span>
          </>
        )}
      </div>

      {varias && (
        <ul className="pdp-reel" ref={tiraRef} aria-label="Imágenes del producto">
          {images.map((img, i) => (
            <li key={img.url ?? i}>
              <button
                type="button"
                className={`pdp-thumb ${active === i ? 'active' : ''}`}
                aria-label={`Ver imagen ${i + 1}`}
                aria-current={active === i ? 'true' : undefined}
                onClick={() => onSelect(i)}
                // Con el foco en la galería, ← y → cambian de foto.
                onKeyDown={onKeyDown}
              >
                <PH src={img.url} alt="" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
