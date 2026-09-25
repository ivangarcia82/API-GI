// @vitest-environment jsdom
/* La landing: pestañas por línea, elegir directo desde la tarjeta, la barra
   con la elección y el detalle del modelo. */
import {describe, it, expect, afterEach, vi} from 'vitest';
import {render, screen, cleanup, fireEvent, within} from '@testing-library/react';
import {createRoutesStub} from 'react-router';

vi.mock('~/lib/motion', () => ({
  initMotion: () => {},
  destroyMotion: () => {},
  prefersReducedMotion: () => true,
}));

import MochilasLanding from './MochilasLanding.jsx';

const LINES = [
  {
    id: 'takayama',
    name: 'Takayama',
    products: [
      {
        id: 'p1',
        handle: 'zen',
        name: 'Zen',
        description: 'Curpiel texturizado.',
        variants: [{id: 'v1', color: 'Negro', image: 'https://cdn/zen.png', imageAlt: null}],
      },
    ],
  },
  {
    id: 'wagner',
    name: 'Wagner',
    products: [
      {
        id: 'p2',
        handle: 'spa',
        name: 'Space',
        description: 'Poliéster.',
        variants: [
          {id: 'w1', color: 'Azul', image: 'https://cdn/spa-a.png', imageAlt: null},
          {id: 'w2', color: 'Negro', image: 'https://cdn/spa-n.png', imageAlt: null},
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
      action: () => ({ok: true}),
    },
  ]);
  render(<Stub initialEntries={['/campana-mochilas']} />);
}

const card = (name) => screen.getByRole('article', {name});

afterEach(cleanup);

describe('MochilasLanding · líneas', () => {
  it('muestra una línea a la vez y cambia con las pestañas', () => {
    montar();
    expect(screen.getByRole('tab', {name: /Takayama/}).getAttribute('aria-selected')).toBe('true');
    expect(card('Zen')).toBeTruthy();
    expect(screen.queryByRole('article', {name: 'Space'})).toBeNull();

    fireEvent.click(screen.getByRole('tab', {name: /Wagner/}));
    expect(card('Space')).toBeTruthy();
    expect(screen.queryByRole('article', {name: 'Zen'})).toBeNull();
  });

  it('con un solo color lo muestra como texto, con varios como opciones', () => {
    montar();
    expect(within(card('Zen')).queryByRole('radio')).toBeNull();
    expect(within(card('Zen')).getByText('Negro')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', {name: /Wagner/}));
    expect(within(card('Space')).getAllByRole('radio')).toHaveLength(2);
  });
});

describe('MochilasLanding · elegir', () => {
  it('elegir desde la tarjeta la marca y aparece en la barra y en el formulario', () => {
    montar();
    expect(screen.queryByRole('region', {name: 'Tu elección'})).toBeNull();

    fireEvent.click(within(card('Zen')).getByRole('button', {name: 'Elegir esta'}));

    expect(within(card('Zen')).getByRole('button', {name: 'Elegida'})).toBeTruthy();
    const barra = screen.getByRole('region', {name: 'Tu elección'});
    expect(within(barra).getByText('Takayama Zen · Negro')).toBeTruthy();
    expect(document.querySelector('input[name="variantId"]').value).toBe('v1');
  });

  it('cambiar el color de la tarjeta elige ese color', () => {
    montar();
    fireEvent.click(screen.getByRole('tab', {name: /Wagner/}));
    fireEvent.click(within(card('Space')).getByRole('radio', {name: 'Negro'}));
    fireEvent.click(within(card('Space')).getByRole('button', {name: 'Elegir esta'}));
    expect(document.querySelector('input[name="variantId"]').value).toBe('w2');
  });
});

describe('MochilasLanding · detalle', () => {
  function abrirSpace() {
    montar();
    fireEvent.click(screen.getByRole('tab', {name: /Wagner/}));
    fireEvent.click(within(card('Space')).getByRole('button', {name: 'Ver detalles de Space'}));
    return screen.getByRole('dialog', {name: 'Space'});
  }

  it('se desplaza por sí mismo aunque Lenis controle la página', () => {
    expect(abrirSpace().hasAttribute('data-lenis-prevent')).toBe(true);
  });

  it('cambiar de color con el teclado no regresa el foco al botón de cerrar', () => {
    const dialog = abrirSpace();
    const negro = within(dialog).getByRole('radio', {name: 'Negro'});
    negro.focus();
    fireEvent.click(negro);
    expect(negro.checked).toBe(true);
    expect(document.activeElement).toBe(negro);
  });

  it('elegir desde el detalle cierra el detalle y marca la mochila', () => {
    const dialog = abrirSpace();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Elegir esta'}));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('input[name="variantId"]').value).toBe('w1');
  });
});
