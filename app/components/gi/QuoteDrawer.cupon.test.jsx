// @vitest-environment jsdom
/* El resumen del cajón es lo único que el comprador lee antes de decidir. Si
   el descuento no se refleja ahí, o el IVA se calcula sobre el subtotal sin
   descontar, el total que ve no es el que Shopify va a emitir. */
import {useEffect} from 'react';
import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest';
import {render, cleanup, screen, act, fireEvent} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {AppProvider, useApp} from '~/lib/AppContext';
import {QuoteDrawer} from './QuoteDrawer.jsx';

/* El cajón cerrado lleva `inert`, que saca su contenido del árbol de
   accesibilidad y con él de las consultas por rol. Se prueba abierto, que es
   además el único estado en que el comprador lo usa. */
function Abrir() {
  const {openQuoteDrawer} = useApp();
  useEffect(() => {
    openQuoteDrawer();
  }, [openQuoteDrawer]);
  return null;
}

/* $10,000 de subtotal en números redondos, para que los totales se lean solos. */
const QUOTE = [
  {id: 'i1', title: 'Termo', sku: 'TER-1', qty: 100, effectiveUnitPrice: 100, options: []},
];

function montar(props = {}) {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () => (
        <AppProvider isLoggedIn quote={QUOTE} {...props}>
          <Abrir />
          <QuoteDrawer />
        </AppProvider>
      ),
    },
  ]);
  return render(<Stub initialEntries={['/']} />);
}

/** El importe de la fila del resumen cuyo rótulo empieza así. */
function importe(rotulo) {
  const fila = screen
    .queryAllByText((t) => t.startsWith(rotulo))
    .map((el) => el.closest('.cart-summary-line'))
    .find(Boolean);
  return fila?.querySelector('.mono')?.textContent ?? null;
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('QuoteDrawer · cupón', () => {
  it('sin cupón el IVA sigue siendo el 16% del subtotal completo', () => {
    montar();
    expect(importe('Subtotal')).toBe('$10,000');
    expect(importe('IVA')).toBe('$1,600');
    expect(importe('Total')).toBe('$11,600');
    // No hay línea de descuento en el resumen (la etiqueta del campo no cuenta).
    expect(importe('Descuento')).toBeNull();
  });

  it('con cupón muestra la línea de descuento con su código y porcentaje', () => {
    montar({discount: {code: 'BIENVENIDOANDANAC', percentage: 20, title: 'Bienvenida'}});
    const linea = screen.queryAllByText((t) => t.startsWith('Descuento'))[0];
    expect(linea.textContent).toMatch(/BIENVENIDOANDANAC/);
    expect(linea.textContent).toMatch(/20\s*%/);
    expect(importe('Descuento')).toBe('-$2,000');
    // Y el cupón aplicado se puede retirar sin vaciar la lista.
    expect(screen.getByRole('button', {name: /quitar cupón/i})).toBeTruthy();
  });

  it('el IVA se calcula sobre el subtotal YA descontado, no sobre el original', () => {
    montar({discount: {code: 'BIENVENIDOANDANAC', percentage: 20, title: 'Bienvenida'}});
    expect(importe('Subtotal')).toBe('$10,000');
    // 16% de 8,000 = 1,280. Si saliera 1,600 estaríamos cobrando IVA del descuento.
    expect(importe('IVA')).toBe('$1,280');
    expect(importe('Total')).toBe('$9,280');
  });

  it('escribir un código y aplicarlo lo postea a /api/quote/discount', async () => {
    const peticiones = [];
    vi.stubGlobal('fetch', async (url, init) => {
      peticiones.push({url: String(url), body: new URLSearchParams(init.body)});
      return new Response(
        JSON.stringify({
          ok: true,
          items: QUOTE,
          discount: {code: 'BIENVENIDOANDANAC', percentage: 20, title: 'Bienvenida'},
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}},
      );
    });
    montar();
    const campo = screen.getByLabelText(/código de descuento/i);
    fireEvent.change(campo, {target: {value: 'BIENVENIDOANDANAC'}});
    await act(async () => {
      fireEvent.click(screen.getByRole('button', {name: /aplicar/i}));
    });
    expect(peticiones[0].url).toContain('/api/quote/discount');
    expect(peticiones[0].body.get('code')).toBe('BIENVENIDOANDANAC');
    expect(importe('Descuento')).toBe('-$2,000');
  });
});
