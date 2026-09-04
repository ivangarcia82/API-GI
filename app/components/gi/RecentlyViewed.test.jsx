// @vitest-environment jsdom
// app/components/gi/RecentlyViewed.test.jsx
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';

// `vitest.config.js` corre con `globals: false`, así que el auto-cleanup de
// Testing Library (que depende de un `afterEach` global) nunca se activa.
// Sin esto, el render del primer test queda en el DOM y contamina el conteo
// de tarjetas del segundo.
afterEach(cleanup);

const brandColors = {value: []};
vi.mock('~/lib/AppContext', () => ({
  useApp: () => ({brandColors: brandColors.value, isLoggedIn: false, favs: [], toggleFav: () => {}}),
  useToast: () => () => {},
}));

vi.mock('~/components/gi/ProductCard', () => ({
  ProductCard: ({product}) => <div data-testid="card">{product.title}</div>,
}));

import {RecentlyViewed} from './RecentlyViewed.jsx';

const HISTORIAL = [
  {id: '1', title: 'Rojo', image: 'https://img/1.jpg', colors: ['ROJO']},
  {id: '2', title: 'Verde', image: 'https://img/2.jpg', colors: ['VERDE']},
];

beforeEach(() => {
  window.localStorage.setItem('gi_recently_viewed', JSON.stringify(HISTORIAL));
  brandColors.value = [];
});

describe('RecentlyViewed · colores de marca', () => {
  it('sin paleta muestra todo el historial', () => {
    render(<RecentlyViewed current={{id: '99'}} />);
    expect(screen.getAllByTestId('card')).toHaveLength(2);
  });

  /* El historial es de localStorage y puede traer productos vistos antes de
     que le asignaran la paleta, o desde otra cuenta en el mismo navegador. */
  it('con paleta oculta lo que está fuera de ella', () => {
    brandColors.value = ['rojo'];
    render(<RecentlyViewed current={{id: '99'}} />);
    expect(screen.getAllByTestId('card')).toHaveLength(1);
    expect(screen.getByText('Rojo')).toBeTruthy();
  });
});
