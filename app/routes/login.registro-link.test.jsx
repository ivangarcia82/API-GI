// @vitest-environment jsdom
/* Quien llega al login desde una página interna (p. ej. /campana-mochilas) y
   todavía no tiene cuenta debe conservar su destino al pasar al registro. */
import {describe, it, expect, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import Login from './login.jsx';

function montar(redirectTo) {
  const Stub = createRoutesStub([
    {path: '/login', Component: Login, loader: () => ({registrado: false, redirectTo})},
  ]);
  render(<Stub initialEntries={['/login']} />);
}

afterEach(cleanup);

describe('login · enlace a registro', () => {
  it('lleva el destino al registro', async () => {
    montar('/campana-mochilas');
    const link = await screen.findByRole('link', {name: 'Regístrate aquí'});
    expect(link.getAttribute('href')).toBe('/registro?redirectTo=%2Fcampana-mochilas');
  });

  it('sin destino propio, el enlace queda limpio', async () => {
    montar('/account');
    const link = await screen.findByRole('link', {name: 'Regístrate aquí'});
    expect(link.getAttribute('href')).toBe('/registro');
  });
});
