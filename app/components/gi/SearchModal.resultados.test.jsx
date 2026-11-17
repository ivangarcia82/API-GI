// @vitest-environment jsdom
/* "Ver todos los resultados" llevaba a /search, una lista sin estilo. Ahora
   lleva al catálogo con el término ya aplicado, que es donde están las
   tarjetas, los filtros y el orden. */
import {useEffect} from 'react';
import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import {createRoutesStub, useLocation} from 'react-router';
import {AppProvider, useApp} from '~/lib/AppContext';
import {GiSearchModal} from './SearchModal.jsx';

function Abrir() {
  const {openSearch} = useApp();
  useEffect(() => {
    openSearch();
  }, [openSearch]);
  return null;
}

function Donde() {
  const {pathname, search} = useLocation();
  return <output data-testid="donde">{pathname + search}</output>;
}

const RESULTADO = {
  type: 'predictive',
  term: 'termo',
  result: {
    total: 1,
    items: {
      articles: [],
      collections: [],
      pages: [],
      queries: [],
      products: [
        {
          id: 'gid://shopify/Product/1',
          handle: 'termo',
          title: 'TERMO MELT',
          featuredImage: {url: 'https://cdn.example/termo.jpg', altText: 'Termo'},
          selectedOrFirstAvailableVariant: {id: 'gid://shopify/ProductVariant/1', price: null},
        },
      ],
    },
  },
};

function montar() {
  const Pantalla = () => (
    <AppProvider isLoggedIn={false}>
      <Abrir />
      <GiSearchModal />
      <Donde />
    </AppProvider>
  );
  const Stub = createRoutesStub([
    {path: '/', Component: Pantalla},
    {path: '/catalogo', Component: Donde},
    {path: '/search', loader: () => RESULTADO, Component: Donde},
  ]);
  return render(<Stub initialEntries={['/']} />);
}

async function escribir(texto) {
  fireEvent.change(await screen.findByRole('searchbox'), {target: {value: texto}});
  await screen.findByText('TERMO MELT', {}, {timeout: 3000});
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('ver todos los resultados', () => {
  it('el botón lleva al catálogo con el término', async () => {
    montar();
    await escribir('termo de acero');
    fireEvent.click(screen.getByRole('button', {name: /Ver todos los resultados/i}));
    await vi.waitFor(() =>
      expect(screen.getByTestId('donde').textContent).toBe('/catalogo?q=termo%20de%20acero'),
    );
  });

  it('Enter en el campo hace lo mismo', async () => {
    montar();
    await escribir('termo');
    // Enter en un campo envía su formulario; jsdom no lo hace por sí solo.
    fireEvent.submit(screen.getByRole('searchbox').closest('form'));
    await vi.waitFor(() =>
      expect(screen.getByTestId('donde').textContent).toBe('/catalogo?q=termo'),
    );
  });
});
