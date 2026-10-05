// @vitest-environment jsdom
import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest';
import {render, cleanup, act} from '@testing-library/react';

const navigate = vi.fn();
vi.mock('react-router', () => ({useNavigate: () => navigate}));

import {AutoLoadMore} from './AutoLoadMore.jsx';

/* IntersectionObserver de mentira: guarda el callback para dispararlo a mano. */
let disparar;
let observados;
beforeEach(() => {
  navigate.mockReset();
  observados = [];
  window.IntersectionObserver = vi.fn(function (cb, opts) {
    disparar = (visible) => cb([{isIntersecting: visible}]);
    this.opts = opts;
    this.observe = (el) => observados.push(el);
    this.disconnect = vi.fn();
  });
});
afterEach(() => {
  cleanup();
  delete window.IntersectionObserver;
});

describe('carga automática al llegar al final', () => {
  it('pide la siguiente página cuando el final entra en pantalla', () => {
    render(<AutoLoadMore nextPageUrl="/catalogo?cursor=abc&direction=next" state={{pagination: 1}} isLoading={false} />);
    expect(observados).toHaveLength(1);
    act(() => disparar(true));
    expect(navigate).toHaveBeenCalledWith('/catalogo?cursor=abc&direction=next', {
      replace: true,
      preventScrollReset: true,
      state: {pagination: 1},
    });
  });

  it('se adelanta: empieza a cargar antes de tocar el final', () => {
    render(<AutoLoadMore nextPageUrl="/x" state={null} isLoading={false} />);
    expect(window.IntersectionObserver.mock.instances[0].opts.rootMargin).toMatch(/px/);
  });

  it('no repite la petición mientras la página anterior sigue cargando', () => {
    render(<AutoLoadMore nextPageUrl="/x" state={null} isLoading />);
    act(() => disparar(true));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('no hace nada si el final no está a la vista', () => {
    render(<AutoLoadMore nextPageUrl="/x" state={null} isLoading={false} />);
    act(() => disparar(false));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sin IntersectionObserver no rompe (queda el botón de respaldo)', () => {
    delete window.IntersectionObserver;
    expect(() => render(<AutoLoadMore nextPageUrl="/x" state={null} isLoading={false} />)).not.toThrow();
  });
});

describe('una página por cada llegada al final', () => {
  it('no encadena páginas si el final sigue a la vista después de cargar', () => {
    const {rerender} = render(<AutoLoadMore nextPageUrl="/p2" state={null} isLoading={false} />);
    act(() => disparar(true));
    expect(navigate).toHaveBeenCalledTimes(1);
    // Llega la página 2 y el navegador deja el final a la vista (scroll
    // anchoring): no debe pedir la 3 por su cuenta.
    rerender(<AutoLoadMore nextPageUrl="/p3" state={null} isLoading={false} />);
    act(() => disparar(true));
    expect(navigate).toHaveBeenCalledTimes(1);
    // Cuando el usuario sigue bajando, el final sale y vuelve a entrar.
    act(() => disparar(false));
    act(() => disparar(true));
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenLastCalledWith('/p3', expect.anything());
  });
});
