// @vitest-environment jsdom
/* El invitado arma su lista sin sesión, pero el precio es sólo para clientes
   (decisión del negocio, 12-nov-2026). Sus líneas no traen importe, así que el
   cajón pintaba "$0" por línea y un total de $0: se quitan los importes y se
   le dice cuándo los va a ver. */
import {useEffect} from 'react';
import {describe, it, expect, afterEach, beforeEach} from 'vitest';
import {render, cleanup, screen} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {AppProvider, useApp} from '~/lib/AppContext';
import {serializeGuestQuote} from '~/lib/quote-guest';
import {QuoteDrawer} from './QuoteDrawer.jsx';

function Abrir() {
  const {openQuoteDrawer} = useApp();
  useEffect(() => {
    openQuoteDrawer();
  }, [openQuoteDrawer]);
  return null;
}

const LINEA = {
  id: 'i1',
  variantId: 'gid://shopify/ProductVariant/1',
  title: 'Termo',
  qty: 100,
  technique: 'Sin decorado',
  surface: '',
  size: '',
  options: [],
  // Un precio guardado por una visita anterior, cuando aún se mostraba.
  baseUnitPrice: 133,
  addedAt: 1,
};

function montar({isLoggedIn}) {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () => (
        <AppProvider
          isLoggedIn={isLoggedIn}
          quote={isLoggedIn ? [{...LINEA, effectiveUnitPrice: 133}] : []}
        >
          <Abrir />
          <QuoteDrawer />
        </AppProvider>
      ),
    },
  ]);
  return render(<Stub initialEntries={['/']} />);
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('gi_quote', serializeGuestQuote([LINEA], Date.now()));
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('cajón de cotización sin sesión', () => {
  it('lista el producto y las piezas, sin ningún importe', async () => {
    const {container} = montar({isLoggedIn: false});
    expect(await screen.findByText('Termo')).toBeTruthy();
    expect(screen.getByText('Piezas totales')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\$/);
    expect(screen.queryByText(/Subtotal|IVA estimado|Total estimado/)).toBeNull();
  });

  it('dice cuándo va a ver los precios', async () => {
    montar({isLoggedIn: false});
    await screen.findByText('Termo');
    expect(screen.getByText(/Los precios se muestran al iniciar sesión/i)).toBeTruthy();
  });

  it('con sesión el resumen sigue llevando sus importes', async () => {
    window.localStorage.clear();
    montar({isLoggedIn: true});
    expect(await screen.findByText('Subtotal estimado')).toBeTruthy();
    expect(screen.getByText('Total estimado')).toBeTruthy();
  });
});
