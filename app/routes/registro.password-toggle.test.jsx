// @vitest-environment jsdom
import {describe, it, expect, afterEach} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {render, screen, fireEvent, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import Registro from './registro.jsx';

// `vitest.config.js` corre con `globals: false`, así que el auto-cleanup de
// Testing Library nunca se activa solo. Ver Header.giMkt.test.jsx.
afterEach(cleanup);

function renderRegistro() {
  const Stub = createRoutesStub([{path: '/registro', Component: Registro}]);
  return render(<Stub initialEntries={['/registro']} />);
}

describe('Registro: toggle de ver/ocultar contraseña — paso 1', () => {
  it('empieza oculta (type=password) con botón "Mostrar contraseña"', () => {
    renderRegistro();

    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('type', 'password');

    const boton = screen.getByRole('button', {name: 'Mostrar contraseña'});
    expect(boton).toHaveAttribute('aria-pressed', 'false');
  });

  it('al hacer click, muestra el texto y cambia el botón a "Ocultar contraseña"', () => {
    renderRegistro();

    const input = screen.getByLabelText('Contraseña');
    const boton = screen.getByRole('button', {name: 'Mostrar contraseña'});

    fireEvent.click(boton);

    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', {name: 'Ocultar contraseña'})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('al hacer click dos veces, vuelve a ocultar la contraseña', () => {
    renderRegistro();

    const boton = () => screen.getByRole('button', {name: /contraseña/i});

    fireEvent.click(boton());
    fireEvent.click(boton());

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', {name: 'Mostrar contraseña'})).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('el botón es type="button" para no enviar el formulario', () => {
    renderRegistro();
    expect(screen.getByRole('button', {name: 'Mostrar contraseña'})).toHaveAttribute(
      'type',
      'button',
    );
  });
});
