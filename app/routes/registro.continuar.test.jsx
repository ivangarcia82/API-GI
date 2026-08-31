// @vitest-environment jsdom
import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest';
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

function fillStep1Valid() {
  fireEvent.change(screen.getByLabelText('Nombre'), {target: {value: 'Ana'}});
  fireEvent.change(screen.getByLabelText('Apellido'), {target: {value: 'Pérez'}});
  fireEvent.change(screen.getByLabelText('Correo corporativo'), {target: {value: 'ana@empresa.mx'}});
  fireEvent.change(screen.getByLabelText('Contraseña'), {target: {value: 'secreto123'}});
  fireEvent.change(screen.getByLabelText('Teléfono'), {target: {value: '5512345678'}});
}

function clickContinuar() {
  fireEvent.click(screen.getByRole('button', {name: /continuar/i}));
}

describe('Registro: continuar() — paso 1', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('a) con campos inválidos, muestra error y NO avanza; no llama a fetch', async () => {
    renderRegistro();
    expect(screen.getByText(/paso 1\/3/)).toBeInTheDocument();

    clickContinuar();

    // El error de validación es síncrono; no hace falta esperar un fetch.
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(screen.getByText(/paso 1\/3/)).toBeInTheDocument();
    expect(screen.getByLabelText('Correo corporativo')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('b) paso 1 válido pero {disponible:false} -> muestra correo tomado y NO avanza', async () => {
    global.fetch.mockResolvedValue({ok: true, json: async () => ({disponible: false})});
    renderRegistro();
    fillStep1Valid();

    clickContinuar();

    expect(await screen.findByText('Ese correo ya está registrado.')).toBeInTheDocument();
    expect(screen.getByText(/paso 1\/3/)).toBeInTheDocument();
  });

  it('c) paso 1 válido y {disponible:true} -> avanza al paso 2', async () => {
    global.fetch.mockResolvedValue({ok: true, json: async () => ({disponible: true})});
    renderRegistro();
    fillStep1Valid();

    clickContinuar();

    expect(await screen.findByText(/paso 2\/3/)).toBeInTheDocument();
    expect(screen.getByLabelText('Empresa')).toBeInTheDocument();
  });

  it('d) el fetch rechaza (fallo de red) -> avanza igual (fail-open)', async () => {
    global.fetch.mockRejectedValue(new Error('network fail'));
    renderRegistro();
    fillStep1Valid();

    clickContinuar();

    expect(await screen.findByText(/paso 2\/3/)).toBeInTheDocument();
    expect(screen.getByLabelText('Empresa')).toBeInTheDocument();
  });

  it('e) res no-ok (p.ej. 500) -> avanza igual, no se lee como "correo tomado"', async () => {
    global.fetch.mockResolvedValue({ok: false, status: 500, json: async () => ({disponible: false})});
    renderRegistro();
    fillStep1Valid();

    clickContinuar();

    expect(await screen.findByText(/paso 2\/3/)).toBeInTheDocument();
    expect(screen.queryByText('Ese correo ya está registrado.')).not.toBeInTheDocument();
  });
});
