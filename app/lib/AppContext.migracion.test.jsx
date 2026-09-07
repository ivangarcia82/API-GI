// @vitest-environment jsdom
/* La migración del carrito de invitado es la pieza que decide si el usuario
   nuevo termina su cotización o la abandona. Estas pruebas fijan las dos cosas
   que importan: que se dispare sola en la primera carga con sesión, y que un
   fallo NO se lleve el carrito por delante. */
import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest';
import {render, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {AppProvider} from './AppContext.jsx';
import {serializeGuestQuote, normalizeGuestLine} from './quote-guest.js';

function sembrarCarrito() {
  const ahora = Date.now();
  const lineas = [
    normalizeGuestLine(
      {variantId: 'gid://v1', technique: 'Sin decorado', qty: 120, title: 'Termo', baseUnitPrice: 129},
      ahora,
    ),
    normalizeGuestLine(
      {variantId: 'gid://v2', technique: 'BORDADO', surface: 'TEXTIL', size: '8 x 8', qty: 100, baseUnitPrice: 85},
      ahora,
    ),
  ];
  window.localStorage.setItem('gi_quote', serializeGuestQuote(lineas, ahora));
}

/** Intercepta las peticiones y deja elegir qué contesta /api/quote/merge. */
function interceptar(respuesta) {
  const peticiones = [];
  vi.stubGlobal('fetch', async (url, init) => {
    peticiones.push({url: String(url), body: new URLSearchParams(init.body)});
    return respuesta();
  });
  return peticiones;
}

const ok = (data) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: {'Content-Type': 'application/json'},
  });

function montar({isLoggedIn}) {
  const Stub = createRoutesStub([
    {path: '/', Component: () => <AppProvider isLoggedIn={isLoggedIn} quote={[]} />},
  ]);
  return render(<Stub initialEntries={['/']} />);
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('migración del carrito de invitado al entrar', () => {
  it('sube el carrito guardado en la primera carga con sesión', async () => {
    const peticiones = interceptar(() => ok({ok: true, items: [], migradas: 2, descartadas: 0}));
    sembrarCarrito();
    montar({isLoggedIn: true});

    await vi.waitFor(() => expect(peticiones).toHaveLength(1));
    expect(peticiones[0].url).toContain('/api/quote/merge');
    const enviadas = JSON.parse(peticiones[0].body.get('lines'));
    expect(enviadas).toHaveLength(2);
    expect(enviadas[0]).toEqual({
      variantId: 'gid://v1',
      technique: 'Sin decorado',
      surface: '',
      size: '',
      qty: 120,
    });
  });

  it('no manda precios: el servidor los vuelve a pedir a Shopify', async () => {
    const peticiones = interceptar(() => ok({ok: true, items: [], migradas: 2, descartadas: 0}));
    sembrarCarrito();
    montar({isLoggedIn: true});

    await vi.waitFor(() => expect(peticiones).toHaveLength(1));
    expect(peticiones[0].body.get('lines')).not.toContain('baseUnitPrice');
    expect(peticiones[0].body.get('lines')).not.toContain('129');
  });

  it('vacía el carrito local sólo cuando el servidor confirmó', async () => {
    interceptar(() => ok({ok: true, items: [], migradas: 2, descartadas: 0}));
    sembrarCarrito();
    montar({isLoggedIn: true});

    await vi.waitFor(() => expect(window.localStorage.getItem('gi_quote')).toBeNull());
  });

  it('CONSERVA el carrito local si la migración falla', async () => {
    interceptar(() => new Response('boom', {status: 500}));
    sembrarCarrito();
    const antes = window.localStorage.getItem('gi_quote');
    montar({isLoggedIn: true});

    // Se le da tiempo de sobra a la petición y a su manejo de error.
    await vi.waitFor(() => expect(document.querySelector('.toast-stack')).toBeTruthy());
    await new Promise((r) => setTimeout(r, 50));
    expect(window.localStorage.getItem('gi_quote')).toBe(antes);
  });

  it('lo conserva también si la red se cae a media petición', async () => {
    interceptar(() => Promise.reject(new Error('sin red')));
    sembrarCarrito();
    const antes = window.localStorage.getItem('gi_quote');
    montar({isLoggedIn: true});

    await new Promise((r) => setTimeout(r, 50));
    expect(window.localStorage.getItem('gi_quote')).toBe(antes);
  });

  it('no molesta al servidor cuando el invitado no traía nada', async () => {
    const peticiones = interceptar(() => ok({ok: true, items: []}));
    montar({isLoggedIn: true});

    await new Promise((r) => setTimeout(r, 50));
    expect(peticiones).toHaveLength(0);
  });

  /* Sin sesión el sobre se reescribe en cada render (sello de tiempo nuevo y
     precios recalculados), así que se compara el contenido y no el texto. */
  it('no migra nada mientras siga sin sesión', async () => {
    const peticiones = interceptar(() => ok({ok: true, items: []}));
    sembrarCarrito();
    montar({isLoggedIn: false});

    await new Promise((r) => setTimeout(r, 50));
    expect(peticiones).toHaveLength(0);
    const guardado = JSON.parse(window.localStorage.getItem('gi_quote'));
    expect(guardado.lines.map((l) => [l.variantId, l.qty])).toEqual([
      ['gid://v1', 120],
      ['gid://v2', 100],
    ]);
  });
});
