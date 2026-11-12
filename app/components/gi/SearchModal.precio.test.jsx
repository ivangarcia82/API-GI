// @vitest-environment jsdom
/* Búsqueda instantánea: el precio es sólo para quien inició sesión. El
   servidor ya no lo entrega sin sesión; aquí se fija lo que lee el visitante
   en su lugar, y que no se pinte aunque el dato llegara. */
import {useEffect} from 'react';
import {describe, it, expect, afterEach, beforeEach} from 'vitest';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {AppProvider, useApp} from '~/lib/AppContext';
import {GiSearchModal} from './SearchModal.jsx';

function Abrir() {
  const {openSearch} = useApp();
  useEffect(() => {
    openSearch();
  }, [openSearch]);
  return null;
}

const resultado = (price) => ({
  type: 'predictive',
  term: 'taza',
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
          handle: 'taza',
          title: 'TAZA MÁGICA',
          featuredImage: {url: 'https://cdn.example/taza.jpg', altText: 'Taza'},
          selectedOrFirstAvailableVariant: {id: 'gid://shopify/ProductVariant/1', price},
        },
      ],
    },
  },
});

async function buscar({isLoggedIn, price}) {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () => (
        <AppProvider isLoggedIn={isLoggedIn}>
          <Abrir />
          <GiSearchModal />
        </AppProvider>
      ),
    },
    {path: '/search', loader: () => resultado(price)},
  ]);
  render(<Stub initialEntries={['/']} />);
  fireEvent.change(await screen.findByRole('searchbox'), {target: {value: 'taza'}});
  await screen.findByText('TAZA MÁGICA', {}, {timeout: 3000});
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('precio en la búsqueda instantánea', () => {
  it('con sesión muestra el precio', async () => {
    await buscar({isLoggedIn: true, price: {amount: '129.0', currencyCode: 'MXN'}});
    expect(screen.getByText('$129')).toBeTruthy();
  });

  it('sin sesión dice que el precio es para clientes', async () => {
    await buscar({isLoggedIn: false, price: null});
    expect(screen.getByText(/Precio para clientes/i)).toBeTruthy();
    expect(screen.queryByText(/Consultar con asesor/i)).toBeNull();
  });

  it('sin sesión no pinta el importe aunque el dato llegara', async () => {
    await buscar({isLoggedIn: false, price: {amount: '129.0', currencyCode: 'MXN'}});
    expect(screen.queryByText('$129')).toBeNull();
  });
});
