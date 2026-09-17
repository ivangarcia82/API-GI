// @vitest-environment jsdom
/* Los dos portales donde se lee una cotización ya enviada: el del cliente y el
   del ejecutivo. Si ahí el total no incluye el descuento, la persona que
   atiende la llamada y la que la hace están mirando números distintos. */
import {describe, it, expect, afterEach} from 'vitest';
import {render, cleanup, screen} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {AppProvider} from '~/lib/AppContext';
import AsesorDetalle from './asesor.cotizaciones.$id.jsx';
import ClienteDetalle from './account.cotizaciones.$id.jsx';

const ITEMS = [
  {id: 'i1', title: 'Termo', qty: 100, effectiveUnitPrice: 100, technique: 'Sin decorado'},
];

const QUOTE = {
  id: 'q1',
  folio: 'GIV.CDMX.20260007',
  status: 'submitted',
  notes: null,
  deadline: null,
  createdAt: '2026-09-01T00:00:00Z',
};

function montar(Componente, {quote, envolver = false}) {
  const datos = {
    quote,
    items: ITEMS,
    comprador: {email: 'a@b.com', firstName: 'Ana'},
    advisor: {email: null, fields: {}},
  };
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () =>
        envolver ? (
          <AppProvider isLoggedIn quote={[]}>
            <Componente />
          </AppProvider>
        ) : (
          <Componente />
        ),
      loader: () => datos,
    },
  ]);
  return render(<Stub initialEntries={['/']} />);
}

/** El texto de la caja/fila de totales. */
const textoDe = (re) => screen.getByText(re).closest('*').textContent;

afterEach(cleanup);

describe('portal del ejecutivo · cupón', () => {
  it('sin cupón muestra el subtotal completo', async () => {
    montar(AsesorDetalle, {quote: QUOTE});
    expect(await screen.findByText(/Subtotal:/)).toBeTruthy();
    expect(textoDe(/Subtotal:/)).toMatch(/\$10,000/);
    expect(screen.queryByText(/Descuento/)).toBeNull();
  });

  it('con cupón muestra el descuento y el total ya descontado', async () => {
    montar(AsesorDetalle, {
      quote: {...QUOTE, discountCode: 'BIENVENIDOANDANAC', discountPercentage: 20},
    });
    expect(await screen.findByText(/Descuento/)).toBeTruthy();
    expect(textoDe(/Descuento/)).toMatch(/BIENVENIDOANDANAC/);
    expect(textoDe(/Descuento/)).toMatch(/\$2,000/);
    expect(textoDe(/Total:/)).toMatch(/\$8,000/);
  });
});

describe('portal del cliente · cupón', () => {
  it('sin cupón el pie de la tabla sigue siendo el total de siempre', async () => {
    montar(ClienteDetalle, {quote: QUOTE, envolver: true});
    expect(await screen.findByText(/Total · 100 pz/)).toBeTruthy();
    expect(screen.queryByText(/Descuento/)).toBeNull();
  });

  it('con cupón el pie desglosa el descuento antes del total', async () => {
    montar(ClienteDetalle, {
      quote: {...QUOTE, discountCode: 'BIENVENIDOANDANAC', discountPercentage: 20},
      envolver: true,
    });
    const fila = (await screen.findByText(/Descuento/)).closest('tr');
    expect(fila.textContent).toMatch(/BIENVENIDOANDANAC/);
    expect(fila.textContent).toMatch(/\$2,000/);
    expect(screen.getByText(/Total · 100 pz/).closest('tr').textContent).toMatch(/\$8,000/);
  });
});
