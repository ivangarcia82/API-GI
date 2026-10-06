/* Generando Ideas — panel de filtros del catálogo.
 *
 * Sólo pinta: recibe las facetas ya calculadas por el servidor (con sus
 * conteos) y avisa de los cambios hacia arriba. La traducción entre URL,
 * estado y argumentos de la API vive en `~/lib/filters`, que se prueba aparte.
 *
 * Se escribe desacoplado de la ruta para que las páginas de colección puedan
 * adoptarlo sin cambios.
 */
import {useRef, useState} from 'react';
import {Icon} from './Icon';
import {useDialogBehavior} from '~/lib/dialog';
import {toggleMulti} from '~/lib/filters';

/** Grupo plegable. Los grupos sin opciones no se montan (ver CatalogFilters). */
function Group({title, count, children, defaultOpen = true}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`cf-group ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="cf-group-head"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>
          {title}
          {count > 0 && <span className="cf-group-badge">{count}</span>}
        </span>
        <Icon name="chevron_down" size={14} className="cf-chev" />
      </button>
      {open && <div className="cf-group-body">{children}</div>}
    </div>
  );
}

/** Lista de opciones con conteo; recorta a `max` con un "ver más". */
function OptionList({options, selected, onToggle, max = 8}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, max);
  return (
    <>
      <div className="cf-options">
        {visible.map((o) => {
          const active = selected.includes(o.value);
          return (
            <label key={o.value} className={`cf-option ${active ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={active}
                onChange={() => onToggle(o.value)}
              />
              <span className="cf-option-label">{o.label}</span>
              <span className="cf-option-count">{o.count.toLocaleString('es-MX')}</span>
            </label>
          );
        })}
      </div>
      {options.length > max && (
        <button type="button" className="cf-more" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Ver menos' : `Ver ${options.length - max} más`}
        </button>
      )}
    </>
  );
}

export function CatalogFilters({
  filters,
  facets,
  categorias,
  // La categoría principal a marcar: con un tipo elegido ("Tarros") se marca
  // su categoría (Bebidas), que es lo que la lista enseña.
  categoriaActiva = filters.cat,
  onChange,
  onClearAll,
  totalCount,
  cargando = false,
  open,
  onClose,
}) {
  const set = (patch) => onChange({...filters, ...patch});
  const panelRef = useRef(null);

  /* En móvil el panel es un cajón encima de la página; en escritorio es una
     columna fija y `open` nunca es true, así que el hook no hace nada. */
  useDialogBehavior({open, onClose, panelRef});

  // El precio se edita en local para no lanzar una consulta por cada tecla;
  // se aplica al enviar o al salir del campo.
  const [precio, setPrecio] = useState({
    min: filters.precioMin ?? '',
    max: filters.precioMax ?? '',
  });

  const aplicarPrecio = () => {
    const min = precio.min === '' ? null : Number(precio.min);
    const max = precio.max === '' ? null : Number(precio.max);
    if (min === filters.precioMin && max === filters.precioMax) return;
    set({precioMin: Number.isFinite(min) ? min : null, precioMax: Number.isFinite(max) ? max : null});
  };

  return (
    <aside
      ref={panelRef}
      className={`cf-panel ${open ? 'open' : ''}`}
      aria-label="Filtros"
      role={open ? 'dialog' : undefined}
      aria-modal={open ? true : undefined}
    >
      <div className="cf-mobile-head">
        <strong>Filtros</strong>
        <button type="button" onClick={onClose} aria-label="Cerrar filtros">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="cf-quick">
        <button
          type="button"
          className={`cf-quick-btn ${filters.nuevos ? 'active' : ''}`}
          onClick={() => set({nuevos: !filters.nuevos})}
        >
          Novedades
        </button>
        <button
          type="button"
          className={`cf-quick-btn ${filters.ofertas ? 'active' : ''}`}
          onClick={() => set({ofertas: !filters.ofertas})}
        >
          Ofertas
        </button>
        <button
          type="button"
          className={`cf-quick-btn ${filters.soloDisponibles ? 'active' : ''}`}
          onClick={() => set({soloDisponibles: !filters.soloDisponibles})}
        >
          En existencia
        </button>
      </div>

{/* Sin categorías (la landing de temporada) el grupo no se pinta. */}
      {categorias && (
        <Group title="Categoría" count={filters.cat ? 1 : 0}>
          <div className="cf-cats">
            <button
              type="button"
              className={!filters.cat ? 'active' : ''}
              onClick={() => set({cat: ''})}
            >
              Todas
            </button>
            {categorias.map((c) => (
              <button
                key={c.handle}
                type="button"
                className={categoriaActiva === c.handle ? 'active' : ''}
                onClick={() => set({cat: filters.cat === c.handle ? '' : c.handle})}
              >
                {c.name}
              </button>
            ))}
          </div>
        </Group>
      )}

      {facets.colores.length > 0 && (
        <Group title="Color" count={filters.color.length}>
          <div className="cf-swatches">
            {facets.colores.map((c) => {
              const active = filters.color.includes(c.family);
              return (
                // Sólo el círculo: el nombre va en el tooltip y en el nombre
                // accesible, con el conteo para quien no ve el color.
                <button
                  key={c.family}
                  type="button"
                  className={`cf-swatch ${active ? 'active' : ''} ${c.hex ? '' : 'cf-swatch-multi'}`}
                  style={c.hex ? {'--sw': c.hex} : undefined}
                  aria-pressed={active}
                  aria-label={`${c.label} (${c.count.toLocaleString('es-MX')})`}
                  title={c.label}
                  onClick={() => set({color: toggleMulti(filters.color, c.family)})}
                >
                  <span className="cf-swatch-dot" />
                </button>
              );
            })}
          </div>
        </Group>
      )}

      <Group title="Precio" count={filters.precioMin != null || filters.precioMax != null ? 1 : 0}>
        <div className="cf-precio">
          <input
            type="number"
            className="input"
            inputMode="numeric"
            placeholder="Mín"
            value={precio.min}
            onChange={(e) => setPrecio((p) => ({...p, min: e.target.value}))}
            onBlur={aplicarPrecio}
            onKeyDown={(e) => e.key === 'Enter' && aplicarPrecio()}
          />
          <span>—</span>
          <input
            type="number"
            className="input"
            inputMode="numeric"
            placeholder="Máx"
            value={precio.max}
            onChange={(e) => setPrecio((p) => ({...p, max: e.target.value}))}
            onBlur={aplicarPrecio}
            onKeyDown={(e) => e.key === 'Enter' && aplicarPrecio()}
          />
        </div>
        <span className="help-msg">MXN · sin IVA</span>
      </Group>

      {facets.materiales.length > 0 && (
        <Group title="Material" count={filters.material.length} defaultOpen={false}>
          <OptionList
            options={facets.materiales}
            selected={filters.material}
            onToggle={(v) => set({material: toggleMulti(filters.material, v)})}
          />
        </Group>
      )}

      {facets.tecnicas.length > 0 && (
        <Group title="Técnica de impresión" count={filters.tecnica.length} defaultOpen={false}>
          <OptionList
            options={facets.tecnicas}
            selected={filters.tecnica}
            onToggle={(v) => set({tecnica: toggleMulti(filters.tecnica, v)})}
          />
        </Group>
      )}

      {facets.tallas.length > 0 && (
        <Group title="Talla" count={filters.talla.length} defaultOpen={false}>
          <OptionList
            options={facets.tallas}
            selected={filters.talla}
            onToggle={(v) => set({talla: toggleMulti(filters.talla, v)})}
            max={12}
          />
        </Group>
      )}

      <div className="cf-mobile-foot">
        <button type="button" className="cf-clear" onClick={onClearAll}>
          Limpiar todo
        </button>
        {/* Mientras la consulta viaja, `totalCount` sigue siendo el de los
            filtros anteriores. Prometer "Ver 1,240 productos" y aterrizar en
            80 es peor que decir que todavía se está contando. */}
        <button
          type="button"
          className="btn btn-accent"
          onClick={onClose}
          disabled={cargando}
          aria-live="polite"
        >
          {cargando
            ? 'Buscando…'
            : totalCount == null
              ? 'Ver productos'
              : `Ver ${totalCount.toLocaleString('es-MX')} productos`}
        </button>
      </div>
    </aside>
  );
}

/**
 * Hoja inferior para elegir el orden. Existe sólo para móvil: el <select> del
 * toolbar se queda sin sitio a 375px junto al buscador y el cambio de vista, y
 * el picker nativo no deja ver cuál está activo hasta abrirlo.
 */
export function SortSheet({open, value, options, onSelect, onClose}) {
  const panelRef = useRef(null);
  useDialogBehavior({open, onClose, panelRef});
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        className="cf-scrim"
        aria-label="Cerrar orden"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="sort-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Ordenar"
      >
        <div className="sort-sheet-head">
          <strong>Ordenar</strong>
          <button type="button" onClick={onClose} aria-label="Cerrar orden">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div role="radiogroup" aria-label="Ordenar por">
          {options.map(([key, def]) => {
            const activo = key === value;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={activo}
                className={`sort-opt ${activo ? 'active' : ''}`}
                onClick={() => onSelect(key)}
              >
                <span>{def.label}</span>
                {activo && <Icon name="check" size={16} />}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/** Chips de lo aplicado, cada uno con su botón de quitar. */
export function ActiveFilterChips({chips, onRemove, onClearAll}) {
  if (!chips.length) return null;
  return (
    <div className="cf-chips">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className="cf-chip"
          onClick={() => onRemove(c)}
          aria-label={`Quitar filtro ${c.label}`}
        >
          {c.label}
          <Icon name="x" size={12} />
        </button>
      ))}
      <button type="button" className="cf-chips-clear" onClick={onClearAll}>
        Limpiar todo
      </button>
    </div>
  );
}
