/* Generando Ideas — menú de categorías del catálogo (3 niveles).
 *
 * El árbol sale de app/lib/category-tree.js; cada enlace lleva a
 * /catalogo?cat=<colección>. En escritorio es un panel bajo la barra: a la
 * izquierda las categorías, a la derecha las subcategorías de la activa con
 * sus tipos. En móvil es un acordeón dentro del menú.
 */
import {useEffect, useRef, useState} from 'react';
import {Link, NavLink} from 'react-router';
import {Icon} from './Icon';
import {CATEGORY_TREE, categoryHref} from '~/lib/category-tree';

// Retraso al abrir y al cerrar con el mouse: cruzar la barra camino a otro
// enlace no debe abrir el panel, y salir un instante del panel tampoco cerrarlo.
const ABRIR_MS = 120;
const CERRAR_MS = 180;

/**
 * Estado del panel compartido entre el disparador (en la barra) y el panel
 * (debajo de ella): pasar el mouse de uno al otro no lo cierra.
 */
export function useCatalogMenu() {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  const programar = (valor, ms) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(valor), ms);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    open,
    toggle: () => {
      clearTimeout(timer.current);
      setOpen((o) => !o);
    },
    close: () => {
      clearTimeout(timer.current);
      setOpen(false);
    },
    hover: {
      onMouseEnter: () => programar(true, ABRIR_MS),
      onMouseLeave: () => programar(false, CERRAR_MS),
    },
  };
}

/** "Catálogo" en la barra: el enlace de siempre más el botón que abre el panel. */
export function CatalogTrigger({menu}) {
  return (
    <span className="appbar-cat" {...menu.hover}>
      <NavLink to="/catalogo" prefetch="intent" onClick={menu.close}>
        Catálogo
      </NavLink>
      <button
        type="button"
        className="appbar-cat-toggle"
        aria-label="Ver categorías del catálogo"
        aria-expanded={menu.open}
        aria-controls="catalog-menu"
        onClick={menu.toggle}
      >
        <Icon name="chevron_down" size={14} />
      </button>
    </span>
  );
}

/** Panel de escritorio. Se monta sólo abierto. */
export function CatalogPanel({menu}) {
  const [activa, setActiva] = useState(CATEGORY_TREE[0].handle);
  if (!menu.open) return null;
  const cat = CATEGORY_TREE.find((c) => c.handle === activa) ?? CATEGORY_TREE[0];

  return (
    <div
      id="catalog-menu"
      className="catmenu"
      role="region"
      aria-label="Categorías del catálogo"
      {...menu.hover}
    >
      <div className="catmenu-inner">
        <ul className="catmenu-l1">
          {CATEGORY_TREE.map((c) => (
            <li key={c.handle}>
              <Link
                to={categoryHref(c.handle)}
                className={c.handle === cat.handle ? 'is-active' : undefined}
                onMouseEnter={() => setActiva(c.handle)}
                onFocus={() => setActiva(c.handle)}
                onClick={menu.close}
              >
                {c.title}
                <Icon name="chevron_right" size={14} />
              </Link>
            </li>
          ))}
          <li className="catmenu-all">
            <Link to="/catalogo" onClick={menu.close}>
              Ver todo el catálogo
            </Link>
          </li>
        </ul>

        <div className="catmenu-body">
          <div className="catmenu-head">
            <span className="catmenu-title">{cat.title}</span>
            <Link to={categoryHref(cat.handle)} className="catmenu-seeall" onClick={menu.close}>
              Ver todo {cat.title}
              <Icon name="arrow_right" size={14} />
            </Link>
          </div>
          <div className="catmenu-cols">
            {(cat.children ?? []).map((sub) => (
              <div className="catmenu-col" key={sub.handle}>
                <Link to={categoryHref(sub.handle)} className="catmenu-l2" onClick={menu.close}>
                  {sub.title}
                </Link>
                {sub.children?.length ? (
                  <ul className="catmenu-l3">
                    {sub.children.map((tipo) => (
                      <li key={tipo.handle}>
                        <Link to={categoryHref(tipo.handle)} onClick={menu.close}>
                          {tipo.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Acordeón del menú móvil. Usa <details>: abre y cierra sin estado propio y el
 * lector de pantalla lo anuncia como desplegable.
 */
export function MobileCatalogMenu({onNavigate}) {
  return (
    <details className="mcat">
      <summary>Catálogo</summary>
      <div className="mcat-body">
        <Link to="/catalogo" className="mcat-all" onClick={onNavigate}>
          Ver todo el catálogo
        </Link>
        {CATEGORY_TREE.map((c) => (
          <details className="mcat-l1" key={c.handle}>
            <summary>{c.title}</summary>
            <div className="mcat-body">
              <Link to={categoryHref(c.handle)} className="mcat-all" onClick={onNavigate}>
                Ver todo {c.title}
              </Link>
              {(c.children ?? []).map((sub) =>
                sub.children?.length ? (
                  <details className="mcat-l2" key={sub.handle}>
                    <summary>{sub.title}</summary>
                    <div className="mcat-body">
                      <Link to={categoryHref(sub.handle)} className="mcat-all" onClick={onNavigate}>
                        Ver todo {sub.title}
                      </Link>
                      {sub.children.map((tipo) => (
                        <Link key={tipo.handle} to={categoryHref(tipo.handle)} onClick={onNavigate}>
                          {tipo.title}
                        </Link>
                      ))}
                    </div>
                  </details>
                ) : (
                  <Link key={sub.handle} to={categoryHref(sub.handle)} className="mcat-leaf" onClick={onNavigate}>
                    {sub.title}
                  </Link>
                ),
              )}
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}
