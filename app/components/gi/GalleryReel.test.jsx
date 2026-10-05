// @vitest-environment jsdom
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, cleanup, fireEvent, within} from '@testing-library/react';
import {useState} from 'react';
import {GalleryReel} from './GalleryReel.jsx';

afterEach(cleanup);

const fotos = (n) => Array.from({length: n}, (_, i) => ({url: `https://cdn/f${i + 1}.jpg`}));

function Montaje({n = 12, inicial = 0}) {
  const [activa, setActiva] = useState(inicial);
  return <GalleryReel images={fotos(n)} active={activa} onSelect={setActiva} title="Tarro Nayad" />;
}

describe('carrete de imágenes de la ficha', () => {
  it('pone las miniaturas en una sola tira, no en una rejilla que crece', () => {
    render(<Montaje n={30} />);
    const tira = screen.getByRole('list', {name: 'Imágenes del producto'});
    expect(within(tira).getAllByRole('button')).toHaveLength(30);
  });

  it('cuenta en qué foto vas', () => {
    render(<Montaje n={30} inicial={2} />);
    expect(screen.getByText('3 / 30')).toBeTruthy();
  });

  it('las flechas de la foto principal avanzan y retroceden, dando la vuelta', () => {
    render(<Montaje n={3} />);
    fireEvent.click(screen.getByRole('button', {name: 'Imagen siguiente'}));
    expect(screen.getByText('2 / 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Imagen anterior'}));
    fireEvent.click(screen.getByRole('button', {name: 'Imagen anterior'}));
    expect(screen.getByText('3 / 3')).toBeTruthy();
  });

  it('marca la miniatura activa y lleva a la que se toca', () => {
    render(<Montaje n={5} />);
    const quinta = screen.getByRole('button', {name: 'Ver imagen 5'});
    fireEvent.click(quinta);
    expect(quinta.getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('5 / 5')).toBeTruthy();
  });

  it('las flechas del teclado también cambian de foto', () => {
    render(<Montaje n={4} />);
    fireEvent.keyDown(screen.getByRole('button', {name: 'Ver imagen 1'}), {key: 'ArrowRight'});
    expect(screen.getByText('2 / 4')).toBeTruthy();
  });

  it('con una sola foto no muestra flechas, contador ni miniaturas', () => {
    render(<Montaje n={1} />);
    expect(screen.queryByRole('button', {name: 'Imagen siguiente'})).toBeNull();
    expect(screen.queryByRole('list', {name: 'Imágenes del producto'})).toBeNull();
  });

  it('acerca la miniatura activa deslizando sólo la tira, sin mover la página', () => {
    const tiraScroll = vi.fn();
    const paginaScroll = vi.fn();
    HTMLElement.prototype.scrollTo = tiraScroll;
    Element.prototype.scrollIntoView = paginaScroll;
    render(<Montaje n={20} />);
    fireEvent.click(screen.getByRole('button', {name: 'Imagen siguiente'}));
    expect(tiraScroll).toHaveBeenCalled();
    expect(paginaScroll).not.toHaveBeenCalled();
    delete HTMLElement.prototype.scrollTo;
    delete Element.prototype.scrollIntoView;
  });
});
