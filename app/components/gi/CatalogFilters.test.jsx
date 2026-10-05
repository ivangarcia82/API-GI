// @vitest-environment jsdom
/* El cajón de filtros en móvil: lo que se prueba aquí es lo que el usuario
   nota y las revisiones visuales no atrapan — que el pie no prometa un total
   que ya caducó, que el panel se anuncie como diálogo sólo cuando de verdad
   tapa la página, y que la hoja de orden diga cuál está activo. */
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import {CatalogFilters, SortSheet} from './CatalogFilters.jsx';
import {SORTS} from '~/lib/filters';

const FILTROS = {
  q: '',
  cat: '',
  color: [],
  material: [],
  tecnica: [],
  talla: [],
  precioMin: null,
  precioMax: null,
  soloDisponibles: false,
  nuevos: false,
  ofertas: false,
  sort: 'relevance',
};

const FACETAS = {colores: [], materiales: [], tecnicas: [], tallas: []};

function montarPanel(props = {}) {
  return render(
    <CatalogFilters
      filters={FILTROS}
      facets={FACETAS}
      categorias={[]}
      onChange={() => {}}
      onClearAll={() => {}}
      totalCount={1240}
      open={false}
      onClose={() => {}}
      {...props}
    />,
  );
}

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('pie del cajón de filtros', () => {
  it('muestra el total cuando no hay consulta en vuelo', () => {
    montarPanel();
    expect(screen.getByRole('button', {name: /Ver 1,240 productos/})).toBeTruthy();
  });

  it('deja de prometer un total mientras la consulta viaja', () => {
    // El total del loader es todavía el de los filtros anteriores: anunciarlo
    // manda al usuario a una lista que no coincide con el botón que pulsó.
    montarPanel({cargando: true});
    const boton = screen.getByRole('button', {name: 'Buscando…'});
    expect(boton.disabled).toBe(true);
    expect(screen.queryByText(/Ver 1,240 productos/)).toBeNull();
  });
});

describe('el panel como diálogo', () => {
  it('en escritorio es una columna, no un diálogo', () => {
    const {container} = montarPanel({open: false});
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('abierto se anuncia como diálogo modal y congela el fondo', () => {
    const {container} = montarPanel({open: true});
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
  });
});

describe('hoja de orden', () => {
  const opciones = Object.entries(SORTS);

  it('no monta nada mientras está cerrada', () => {
    const {container} = render(
      <SortSheet
        open={false}
        value="relevance"
        options={opciones}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('marca la opción activa para lectores de pantalla', () => {
    render(
      <SortSheet
        open
        value="price-asc"
        options={opciones}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    );
    const activa = screen.getByRole('radio', {name: SORTS['price-asc'].label});
    expect(activa.getAttribute('aria-checked')).toBe('true');
    expect(
      screen.getByRole('radio', {name: SORTS.relevance.label}).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('avisa la elección hacia arriba', () => {
    const onSelect = vi.fn();
    render(
      <SortSheet
        open
        value="relevance"
        options={opciones}
        onSelect={onSelect}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('radio', {name: SORTS['price-desc'].label}));
    expect(onSelect).toHaveBeenCalledWith('price-desc');
  });
});

describe('filtro de color', () => {
  const colores = [
    {family: 'rojo', label: 'Rojo', hex: '#c2352c', count: 66},
    {family: 'negro', label: 'Negro', hex: '#111', count: 61},
  ];

  it('muestra sólo los círculos de color, con el nombre para lectores y tooltip', () => {
    const {container} = montarPanel({facets: {...FACETAS, colores}});
    expect(container.querySelector('.cf-swatch-label')).toBeNull();
    const rojo = screen.getByRole('button', {name: 'Rojo (66)'});
    expect(rojo.getAttribute('title')).toBe('Rojo');
    expect(rojo.querySelector('.cf-swatch-dot')).not.toBeNull();
  });
});
