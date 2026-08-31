// @vitest-environment jsdom
import {describe, it, expect, afterEach} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {render, screen, fireEvent, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import Registro from './registro.jsx';
import {AREAS, COMO_NOS_CONOCISTE, UBICACIONES} from './registro.catalogos.js';

afterEach(cleanup);

function renderRegistro() {
  const Stub = createRoutesStub([
    {path: '/registro', Component: Registro, loader: () => ({advisors: []})},
  ]);
  return render(<Stub initialEntries={['/registro']} />);
}

async function llenarPaso1() {
  renderRegistro();
  fireEvent.change(await screen.findByLabelText('Nombre'), {target: {value: 'Ana'}});
  fireEvent.change(screen.getByLabelText('Apellido'), {target: {value: 'Pérez'}});
  fireEvent.change(screen.getByLabelText('Correo corporativo'), {
    target: {value: 'ana@acme.mx'},
  });
  fireEvent.change(screen.getByLabelText('Contraseña'), {target: {value: 'secreto123'}});
}

async function irAPaso2() {
  await llenarPaso1();
  fireEvent.change(screen.getByLabelText('Teléfono'), {target: {value: '5512345678'}});
  fireEvent.click(screen.getByRole('button', {name: /continuar/i}));
  await screen.findByText(/paso 2\/3/);
}

async function irAPaso3() {
  await irAPaso2();
  fireEvent.change(screen.getByLabelText('Empresa'), {target: {value: 'Acme'}});
  fireEvent.change(screen.getByLabelText('Razón social'), {
    target: {value: 'Acme S.A. de C.V.'},
  });
  fireEvent.change(screen.getByLabelText('Cargo'), {target: {value: 'Compradora'}});
  fireEvent.change(screen.getByLabelText('Área'), {target: {value: AREAS[0]}});
  fireEvent.change(screen.getByLabelText('Volumen mensual estimado'), {
    target: {value: 'Menos de $50,000 MXN'},
  });
  fireEvent.click(screen.getByLabelText('No, es mi primera vez'));
  fireEvent.click(screen.getByRole('button', {name: /continuar/i}));
  await screen.findByText(/paso 3\/3/);
}

describe('registro · campos obligatorios nuevos', () => {
  it('no avanza del paso 1 sin teléfono', async () => {
    await llenarPaso1();
    fireEvent.click(screen.getByRole('button', {name: /continuar/i}));
    expect(await screen.findByText('Ingresa tu teléfono.')).toBeInTheDocument();
    expect(screen.getByText(/paso 1\/3/)).toBeInTheDocument();
  });

  it('la razón social ya no se anuncia como opcional', async () => {
    await irAPaso2();
    expect(screen.queryByLabelText(/Razón social \(opcional\)/)).toBeNull();
    expect(screen.getByLabelText('Razón social')).toBeInTheDocument();
  });

  it('el paso 2 pide cargo y área', async () => {
    await irAPaso2();
    expect(screen.getByLabelText('Cargo')).toBeInTheDocument();
    const area = screen.getByLabelText('Área');
    for (const op of AREAS) expect(area).toHaveTextContent(op);
  });

  it('no avanza del paso 2 sin razón social, cargo ni área', async () => {
    await irAPaso2();
    fireEvent.change(screen.getByLabelText('Empresa'), {target: {value: 'Acme'}});
    fireEvent.change(screen.getByLabelText('Volumen mensual estimado'), {
      target: {value: 'Menos de $50,000 MXN'},
    });
    fireEvent.click(screen.getByLabelText('No, es mi primera vez'));
    fireEvent.click(screen.getByRole('button', {name: /continuar/i}));
    expect(await screen.findByText('Ingresa la razón social.')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu cargo.')).toBeInTheDocument();
    expect(screen.getByText('Selecciona tu área.')).toBeInTheDocument();
  });
});

describe('registro · paso 3', () => {
  it('ofrece los catálogos de origen y ubicación', async () => {
    await irAPaso3();
    const origen = screen.getByLabelText('¿Cómo nos conociste?');
    for (const op of COMO_NOS_CONOCISTE) expect(origen).toHaveTextContent(op);
    expect(screen.getByLabelText('¿Dónde te encuentras ubicado?')).toHaveTextContent(
      UBICACIONES[0],
    );
  });

  it('tiene dos aceptaciones legales separadas y un newsletter opcional', async () => {
    await irAPaso3();
    expect(screen.getByRole('checkbox', {name: /aviso de privacidad/i})).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {name: /términos y condiciones/i}),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: /novedades/i})).not.toBeRequired();
  });

  it('bloquea el envío mientras falte una aceptación legal', async () => {
    await irAPaso3();
    fireEvent.change(screen.getByLabelText('¿Cómo nos conociste?'), {
      target: {value: COMO_NOS_CONOCISTE[0]},
    });
    fireEvent.change(screen.getByLabelText('¿Dónde te encuentras ubicado?'), {
      target: {value: UBICACIONES[0]},
    });
    fireEvent.click(screen.getByRole('checkbox', {name: /aviso de privacidad/i}));
    fireEvent.click(screen.getByRole('button', {name: /crear cuenta/i}));
    expect(
      await screen.findByText('Debes aceptar los términos y condiciones.'),
    ).toBeInTheDocument();
  });

  it('bloquea el envío sin origen ni ubicación', async () => {
    await irAPaso3();
    fireEvent.click(screen.getByRole('checkbox', {name: /aviso de privacidad/i}));
    fireEvent.click(screen.getByRole('checkbox', {name: /términos y condiciones/i}));
    fireEvent.click(screen.getByRole('button', {name: /crear cuenta/i}));
    expect(await screen.findByText('Cuéntanos cómo nos conociste.')).toBeInTheDocument();
    expect(screen.getByText('Selecciona dónde te encuentras.')).toBeInTheDocument();
  });
});
