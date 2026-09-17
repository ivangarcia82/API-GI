// @vitest-environment jsdom
/* El cupón vive en el contexto junto a la lista, pero NO es parte de la lista:
   viaja aparte porque un descuento es del documento, no de una línea. Estas
   pruebas fijan que el servidor manda y que un rechazo no borra lo aplicado. */
import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest';
import {render, cleanup, act} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {AppProvider, useApp} from './AppContext.jsx';

let api;

function Sonda() {
  api = useApp();
  return null;
}

function montar(props = {}) {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () => (
        <AppProvider isLoggedIn quote={[]} {...props}>
          <Sonda />
        </AppProvider>
      ),
    },
  ]);
  return render(<Stub initialEntries={['/']} />);
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {status, headers: {'Content-Type': 'application/json'}});

function interceptar(responder) {
  const peticiones = [];
  vi.stubGlobal('fetch', async (url, init) => {
    peticiones.push({url: String(url), body: new URLSearchParams(init.body)});
    return responder(peticiones.length);
  });
  return peticiones;
}

beforeEach(() => {
  api = null;
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AppContext · cupón', () => {
  it('arranca sin cupón cuando el loader no trae ninguno', () => {
    montar();
    expect(api.quoteDiscount).toBeNull();
  });

  it('toma el cupón que ya venía guardado en la cotización del servidor', () => {
    montar({discount: {code: 'BIENVENIDOANDANAC', percentage: 20, title: 'Bienvenida'}});
    expect(api.quoteDiscount).toEqual({
      code: 'BIENVENIDOANDANAC',
      percentage: 20,
      title: 'Bienvenida',
    });
  });

  it('aplicar un cupón lo postea y guarda lo que contestó el servidor', async () => {
    const peticiones = interceptar(() =>
      json({
        ok: true,
        items: [],
        discount: {code: 'BIENVENIDOANDANAC', percentage: 20, title: 'Bienvenida'},
      }),
    );
    montar();
    await act(async () => {
      await api.applyQuoteDiscount('  bienvenidoandanac ');
    });
    expect(peticiones[0].url).toContain('/api/quote/discount');
    expect(peticiones[0].body.get('code')).toBe('bienvenidoandanac');
    // El 20% que se pinta es el que mandó Shopify, no uno que escribimos aquí.
    expect(api.quoteDiscount.percentage).toBe(20);
  });

  it('un cupón rechazado lanza el mensaje del servidor y NO borra el que ya estaba', async () => {
    interceptar(() => json({error: 'Ese código no existe en nuestra tienda.'}, 422));
    montar({discount: {code: 'VIEJO', percentage: 10, title: 'Viejo'}});
    await act(async () => {
      await expect(api.applyQuoteDiscount('NOEXISTE')).rejects.toThrow(/no existe/i);
    });
    expect(api.quoteDiscount).toEqual({code: 'VIEJO', percentage: 10, title: 'Viejo'});
  });

  it('quitar el cupón lo postea como clear y lo deja en null', async () => {
    const peticiones = interceptar(() => json({ok: true, items: [], discount: null}));
    montar({discount: {code: 'BIENVENIDOANDANAC', percentage: 20, title: 'Bienvenida'}});
    await act(async () => {
      await api.removeQuoteDiscount();
    });
    expect(peticiones[0].body.get('clear')).toBe('true');
    expect(api.quoteDiscount).toBeNull();
  });
});
