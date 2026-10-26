/* Generando Ideas — menú "Colecciones": las landings de temporada.
 *
 * Mismas campañas y portadas que la sección del home (campanasActivas en
 * app/lib/campanas.js); cada tarjeta lleva a /temporada/<handle>. En
 * escritorio es un panel bajo la barra con la portada de cada una; en móvil,
 * un acordeón dentro del menú. El estado (abrir con el mouse, Escape) es el
 * mismo hook del menú del catálogo.
 */
import {Link, useLocation} from 'react-router';
import {Icon} from './Icon';
import {campanasActivas, campanaHref} from '~/lib/campanas';

/** "Colecciones" en la barra. No hay página índice: sólo abre el panel. */
export function CollectionsTrigger({menu}) {
  const {pathname} = useLocation();
  const activa = pathname.startsWith('/temporada/');
  return (
    <span className="appbar-cat" {...menu.hover}>
      <button
        type="button"
        className={`appbar-coll${activa ? ' active' : ''}`}
        aria-expanded={menu.open}
        aria-controls="collections-menu"
        onClick={menu.toggle}
      >
        Colecciones
        <Icon name="chevron_down" size={14} />
      </button>
    </span>
  );
}

/** Panel de escritorio. Se monta sólo abierto. */
export function CollectionsPanel({menu}) {
  if (!menu.open) return null;
  const campanas = campanasActivas();
  return (
    <div
      id="collections-menu"
      className="catmenu"
      role="region"
      aria-label="Colecciones de temporada"
      {...menu.hover}
    >
      <div className="collmenu-inner">
        <div className="catmenu-head">
          <span className="catmenu-title">Colecciones de temporada</span>
        </div>
        <ul className="collmenu-grid">
          {campanas.map((c) => (
            <li key={c.handle}>
              <Link to={campanaHref(c.handle)} className="collmenu-card" onClick={menu.close}>
                <img src={c.portada} alt="" width={900} height={900} loading="lazy" decoding="async" />
                <span className="collmenu-name">{c.titulo}</span>
                <span className="collmenu-meta">{c.tema}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Acordeón del menú móvil, con la portada en miniatura. */
export function MobileCollectionsMenu({onNavigate}) {
  return (
    <details className="mcat">
      <summary>Colecciones</summary>
      <div className="mcat-body">
        {campanasActivas().map((c) => (
          <Link key={c.handle} to={campanaHref(c.handle)} className="mcoll-link" onClick={onNavigate}>
            <img src={c.portada} alt="" width={48} height={48} loading="lazy" />
            {c.titulo}
          </Link>
        ))}
      </div>
    </details>
  );
}
