// @vitest-environment jsdom
/* Bloque de precio de la ficha. El precio es sólo para quien inició sesión
   (decisión del negocio, 12-nov-2026): sin sesión la ficha no enseña importes
   y dice cómo verlos. */
import {describe, it, expect, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {PdpPrice} from './PdpPrice.jsx';

const PRECIO = {
  unit: 133,
  effUnit: 133,
  effTotal: 13300,
  compareAt: null,
  decoTotal: 0,
  qty: 100,
  currency: 'MXN',
};

function montar(props) {
  const Stub = createRoutesStub([
    {path: '/products/:handle', Component: () => <PdpPrice {...PRECIO} {...props} />},
  ]);
  return render(<Stub initialEntries={['/products/taza?Color=ROJO']} />);
}

afterEach(cleanup);

describe('precio de la ficha', () => {
  it('con sesión muestra precio por pieza, total y la nota de precio de lista', () => {
    const {container} = montar({isLoggedIn: true});
    expect(screen.getByText('$133')).toBeTruthy();
    expect(screen.getByText('$13,300')).toBeTruthy();
    expect(container.textContent).toMatch(/MXN · sin IVA · precio de lista/);
  });

  it('sin sesión no muestra ningún importe, aunque el dato venga', () => {
    const {container} = montar({isLoggedIn: false});
    expect(container.textContent).not.toMatch(/\$|133|precio de lista/);
  });

  it('sin sesión dice que el precio es para clientes y cómo entrar', () => {
    montar({isLoggedIn: false});
    expect(screen.getByText(/Precios solo para clientes registrados/i)).toBeTruthy();
    // De vuelta a la misma ficha y al color que estaba viendo.
    const volverA = '?redirectTo=%2Fproducts%2Ftaza%3FColor%3DROJO';
    expect(screen.getByRole('link', {name: /Crear cuenta/i}).getAttribute('href')).toBe(
      `/registro${volverA}`,
    );
    expect(screen.getByRole('link', {name: /Iniciar sesión/i}).getAttribute('href')).toBe(
      `/login${volverA}`,
    );
  });

  it('con sesión y sin precio manda con el asesor', () => {
    const {container} = montar({isLoggedIn: true, unit: null, effUnit: null, effTotal: null});
    expect(screen.getByText(/Consultar con asesor/i)).toBeTruthy();
    expect(container.textContent).not.toMatch(/\$/);
  });
});
