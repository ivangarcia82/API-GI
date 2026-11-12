/* Generando Ideas — bloque de precio de la ficha de producto.
 *
 * El precio es sólo para quien inició sesión (decisión del negocio,
 * 12-nov-2026). El servidor ya no entrega importes sin sesión; este bloque
 * además no los pinta aunque lleguen, y en su lugar dice cómo verlos.
 */
import {Link, useLocation} from 'react-router';
import {Icon} from './Icon';
import {Button} from './ui';
import {formatPrice} from '~/lib/gi';

/**
 * @param {object} props
 * @param {boolean} props.isLoggedIn
 * @param {number|null} props.unit      precio base por pieza de la variante
 * @param {number|null} props.effUnit   por pieza con el decorado prorrateado
 * @param {number|null} props.effTotal  total de la cantidad elegida
 * @param {number|null} props.compareAt precio tachado, si lo hay
 * @param {number} props.decoTotal      costo del decorado elegido
 * @param {number} props.qty
 * @param {string} props.currency
 */
export function PdpPrice({
  isLoggedIn,
  unit,
  effUnit,
  effTotal,
  compareAt,
  decoTotal,
  qty,
  currency,
}) {
  const {pathname, search} = useLocation();

  if (!isLoggedIn) {
    // De vuelta a esta misma ficha, con el color que estaba viendo.
    const volverA = encodeURIComponent(pathname + search);
    return (
      <div className="pdp-gated">
        <Icon name="eye_off" size={20} className="muted-2" />
        <h3>Precios solo para clientes registrados</h3>
        <p>Crea tu cuenta gratuita para ver precios y enviar tu cotización.</p>
        <div className="pdp-gated-actions">
          <Button
            as={Link}
            to={`/registro?redirectTo=${volverA}`}
            variant="accent"
            iconRight="arrow_right"
          >
            Crear cuenta
          </Button>
          <Button as={Link} to={`/login?redirectTo=${volverA}`} variant="ghost">
            Iniciar sesión
          </Button>
        </div>
      </div>
    );
  }

  if (unit == null) {
    return (
      <div className="pdp-price-bar">
        <div>
          <div className="pdp-price-from">Precio</div>
          <div className="pdp-price" style={{fontSize: 20}}>
            Consultar con asesor
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
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
            {formatPrice(effTotal, currency)}
          </div>
        </div>
      </div>

      {/* Sigue siendo precio de lista: volumen, decorado y plazo se cierran en
          la cotización. Decirlo aquí evita que se lea como un total cerrado. */}
      <p className="pdp-price-note">{currency} · sin IVA · precio de lista</p>
    </>
  );
}
