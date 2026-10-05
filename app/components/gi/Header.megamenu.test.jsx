// @vitest-environment jsdom
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, cleanup, fireEvent, within} from '@testing-library/react';
import {createRoutesStub} from 'react-router';

vi.mock('~/lib/AppContext', () => ({
  useApp: () => ({quoteCount: 0, openQuoteDrawer: () => {}, openSearch: () => {}}),
}));

import {GiHeader} from './Header.jsx';

afterEach(cleanup);

function abrir() {
  const Stub = createRoutesStub([{path: '/', Component: () => <GiHeader isLoggedIn={false} />}]);
  render(<Stub initialEntries={['/']} />);
}

describe('menú de categorías (escritorio)', () => {
  it('"Catálogo" sigue siendo un enlace al catálogo', async () => {
    abrir();
    const nav = await screen.findByRole('navigation', {name: 'Principal'});
    expect(within(nav).getByRole('link', {name: 'Catálogo'}).getAttribute('href')).toBe('/catalogo');
  });

  it('el botón abre el panel con las 8 categorías', async () => {
    abrir();
    const boton = await screen.findByRole('button', {name: 'Ver categorías del catálogo'});
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(boton);
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    const panel = screen.getByRole('region', {name: 'Categorías del catálogo'});
    for (const c of ['Bebidas', 'Oficina', 'Textil', 'Hogar', 'Salud y belleza', 'Tecnología', 'Tiempo libre', 'Ecológicos']) {
      expect(within(panel).getByRole('link', {name: c})).toBeTruthy();
    }
  });

  it('muestra las subcategorías y tipos de la categoría activa', async () => {
    abrir();
    fireEvent.click(await screen.findByRole('button', {name: 'Ver categorías del catálogo'}));
    const panel = screen.getByRole('region', {name: 'Categorías del catálogo'});
    // La primera categoría arranca activa.
    expect(within(panel).getByRole('link', {name: 'Tazas y tarros'}).getAttribute('href')).toBe('/catalogo?cat=tazas');
    expect(within(panel).getByRole('link', {name: 'Tarros'}).getAttribute('href')).toBe('/catalogo?cat=tarros');
    // Al pasar a otra categoría cambian las columnas.
    fireEvent.mouseEnter(within(panel).getByRole('link', {name: 'Tecnología'}));
    expect(within(panel).getByRole('link', {name: 'Bocinas'}).getAttribute('href')).toBe('/catalogo?cat=bocinas');
    expect(within(panel).queryByRole('link', {name: 'Tarros'})).toBeNull();
  });

  it('Escape cierra el panel', async () => {
    abrir();
    const boton = await screen.findByRole('button', {name: 'Ver categorías del catálogo'});
    fireEvent.click(boton);
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('region', {name: 'Categorías del catálogo'})).toBeNull();
  });
});

describe('menú de categorías (móvil)', () => {
  it('el menú móvil trae el árbol completo en acordeón', async () => {
    abrir();
    fireEvent.click(await screen.findByRole('button', {name: 'Menú'}));
    const menu = screen.getByRole('navigation', {name: 'Menú móvil'});
    expect(within(menu).getByText('Bebidas')).toBeTruthy();
    expect(within(menu).getByRole('link', {name: 'Tarros'}).getAttribute('href')).toBe('/catalogo?cat=tarros');
  });
});
