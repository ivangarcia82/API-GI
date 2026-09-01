// @vitest-environment jsdom
import {describe, it, expect, afterEach} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import {PH} from './ui.jsx';

afterEach(() => {
  cleanup();
  delete HTMLImageElement.prototype._fakeComplete;
});

/* Simula una imagen que el navegador YA terminó de cargar antes de hidratar,
   que es lo que ocurre cuando viene de caché. */
function conImagenYaCargada(valor = true) {
  Object.defineProperty(HTMLImageElement.prototype, 'complete', {
    configurable: true,
    get: () => valor,
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
    configurable: true,
    get: () => (valor ? 800 : 0),
  });
}

describe('PH · carrera de hidratación', () => {
  it('muestra la imagen si ya estaba cargada antes de montar', () => {
    // Sin esto, onLoad nunca dispara y la imagen se queda en opacity 0
    // enseñando el placeholder hasta que el usuario refresca.
    conImagenYaCargada(true);
    render(<PH src="https://cdn/x.jpg" alt="Taza" label="Taza" />);
    expect(screen.getByAltText('Taza')).toHaveStyle({opacity: '1'});
  });

  it('espera al onLoad cuando todavía no ha cargado', () => {
    conImagenYaCargada(false);
    render(<PH src="https://cdn/x.jpg" alt="Taza" label="Taza" />);
    const img = screen.getByAltText('Taza');
    expect(img).toHaveStyle({opacity: '0'});
    fireEvent.load(img);
    expect(img).toHaveStyle({opacity: '1'});
  });

  it('sigue enseñando la etiqueta mientras no hay imagen visible', () => {
    conImagenYaCargada(false);
    render(<PH src="https://cdn/x.jpg" alt="Taza" label="Sin foto" />);
    expect(screen.getByText('Sin foto')).toBeInTheDocument();
  });

  it('oculta la imagen y deja la etiqueta si falla la carga', () => {
    conImagenYaCargada(false);
    render(<PH src="https://cdn/roto.jpg" alt="Taza" label="Sin foto" />);
    fireEvent.error(screen.getByAltText('Taza'));
    expect(screen.queryByAltText('Taza')).toBeNull();
    expect(screen.getByText('Sin foto')).toBeInTheDocument();
  });

  it('sin src no pinta imagen', () => {
    conImagenYaCargada(true);
    render(<PH label="Sin foto" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Sin foto')).toBeInTheDocument();
  });
});
