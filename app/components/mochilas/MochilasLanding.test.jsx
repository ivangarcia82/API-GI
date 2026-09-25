// @vitest-environment jsdom
/* El detalle de un modelo: se usa con teclado (chips de color) y en pantallas
   bajas su contenido se desplaza dentro del modal, no la página detrás. */
import {describe, it, expect, afterEach, vi} from 'vitest';
import {render, screen, cleanup, fireEvent, within} from '@testing-library/react';
import {createRoutesStub} from 'react-router';

vi.mock('~/lib/motion', () => ({
  initMotion: () => {},
  destroyMotion: () => {},
  prefersReducedMotion: () => true,
  gsap: {},
  ScrollTrigger: {},
}));

import MochilasLanding from './MochilasLanding.jsx';

const LINES = [
  {
    id: 'wagner',
    name: 'Wagner',
    products: [
      {
        id: 'p1',
        handle: 'spa',
        name: 'Space',
        description: 'Poliéster.',
        variants: [
          {id: 'w1', color: 'Azul', image: null, imageAlt: null},
          {id: 'w2', color: 'Negro', image: null, imageAlt: null},
        ],
      },
    ],
  },
];

function montar() {
  const Stub = createRoutesStub([
    {
      path: '/campana-mochilas',
      Component: () => (
        <MochilasLanding
          lines={LINES}
          collaborator={{email: 'ana@generandoideas.com', fullName: 'Ana López'}}
        />
      ),
    },
  ]);
  render(<Stub initialEntries={['/campana-mochilas']} />);
  fireEvent.click(screen.getByRole('button', {name: 'Ver detalle'}));
  return screen.getByRole('dialog');
}

afterEach(cleanup);

describe('MochilasLanding · detalle', () => {
  it('cambiar de color con el teclado no regresa el foco al botón de cerrar', () => {
    const dialog = montar();
    const negro = within(dialog).getByRole('button', {name: 'Negro'});
    negro.focus();
    fireEvent.click(negro);
    expect(negro.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(negro);
  });

  it('el detalle se desplaza por sí mismo aunque Lenis controle la página', () => {
    const dialog = montar();
    expect(dialog.hasAttribute('data-lenis-prevent')).toBe(true);
  });
});
