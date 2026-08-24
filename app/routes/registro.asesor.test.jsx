// @vitest-environment jsdom
import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {render, screen, fireEvent, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import Registro from './registro.jsx';
import {UNKNOWN_ADVISOR} from '~/lib/auth/advisor-choice.js';

afterEach(cleanup);

const ASESORES = [
  {handle: 'ailine-gamboa', nombre: 'Ailine Gamboa', puesto: 'Strategic Sales Jr. Executive'},
  {handle: 'laura-vega', nombre: 'Laura Vega', puesto: 'Inside Sales Executive'},
];

function renderRegistro(advisors = ASESORES) {
  const Stub = createRoutesStub([
    {path: '/registro', Component: Registro, loader: () => ({advisors})},
  ]);
  return render(<Stub initialEntries={['/registro']} />);
}

async function irAPaso2(advisors) {
  renderRegistro(advisors);
  // El stub con loader monta de forma asíncrona: espera al primer campo.
  fireEvent.change(await screen.findByLabelText('Nombre'), {target: {value: 'Ana'}});
  fireEvent.change(screen.getByLabelText('Apellido'), {target: {value: 'Pérez'}});
  fireEvent.change(screen.getByLabelText('Correo corporativo'), {
    target: {value: 'ana@empresa.mx'},
  });
  fireEvent.change(screen.getByLabelText('Contraseña'), {target: {value: 'secreto123'}});
  fireEvent.click(screen.getByRole('button', {name: /continuar/i}));
  await screen.findByText(/paso 2\/3/);
}

function llenarEmpresa() {
  fireEvent.change(screen.getByLabelText('Empresa'), {target: {value: 'Acme'}});
  fireEvent.change(screen.getByLabelText('Volumen mensual estimado'), {
    target: {value: 'Menos de $50,000 MXN'},
  });
}

function clickContinuar() {
  fireEvent.click(screen.getByRole('button', {name: /continuar/i}));
}

/** El input oculto que realmente se postea. */
function hidden(name) {
  return document.querySelector(`input[type="hidden"][name="${name}"]`);
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ok: true, json: async () => ({disponible: true})});
});

describe('Registro · ejecutiva de venta', () => {
  it('pregunta si ya es cliente y oculta el select hasta que responde que sí', async () => {
    await irAPaso2();

    expect(screen.getByText(/¿ya eres cliente/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/ejecutivo de venta/i)).not.toBeInTheDocument();
  });

  it('muestra el select con los asesores del loader al decir que sí', async () => {
    await irAPaso2();

    fireEvent.click(screen.getByLabelText(/sí, ya soy cliente/i));

    const select = screen.getByLabelText(/ejecutivo de venta/i);
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', {name: /Ailine Gamboa/})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: /Laura Vega/})).toBeInTheDocument();
  });

  it('nunca ofrece Marketing como asesor seleccionable', async () => {
    // El loader ya lo filtra; esto blinda el contrato desde la UI.
    await irAPaso2([...ASESORES, {handle: 'marketing', nombre: 'Marketing', puesto: 'Marketing'}]);

    fireEvent.click(screen.getByLabelText(/sí, ya soy cliente/i));

    // Aserción por value, no por texto: un match por nombre pasaría en falso
    // si la opción se renderizara como "Marketing — Marketing".
    const values = screen.getAllByRole('option').map((o) => o.value);
    expect(values).not.toContain('marketing');
    expect(values).toContain('laura-vega');
  });

  it('ofrece "No conozco a mi asesor asignado" como opción del select', async () => {
    await irAPaso2();

    fireEvent.click(screen.getByLabelText(/sí, ya soy cliente/i));

    const opcion = screen.getByRole('option', {name: 'No conozco a mi asesor asignado'});
    expect(opcion).toBeInTheDocument();
    expect(opcion).toHaveValue(UNKNOWN_ADVISOR);
  });

  it('no deja avanzar a un cliente que no eligió asesor', async () => {
    await irAPaso2();
    llenarEmpresa();
    fireEvent.click(screen.getByLabelText(/sí, ya soy cliente/i));

    clickContinuar();

    expect(screen.getByText(/paso 2\/3/)).toBeInTheDocument();
    expect(screen.getByText(/elige a tu ejecutivo de venta/i)).toBeInTheDocument();
  });

  it('deja avanzar a quien todavía no es cliente, sin pedirle asesor', async () => {
    await irAPaso2();
    llenarEmpresa();

    fireEvent.click(screen.getByLabelText(/no, es mi primera vez/i));
    clickContinuar();

    expect(await screen.findByText(/paso 3\/3/)).toBeInTheDocument();
  });

  it('postea el handle elegido en el campo oculto advisor', async () => {
    await irAPaso2();
    fireEvent.click(screen.getByLabelText(/sí, ya soy cliente/i));

    fireEvent.change(screen.getByLabelText(/ejecutivo de venta/i), {
      target: {value: 'laura-vega'},
    });

    expect(hidden('esCliente')).toHaveValue('si');
    expect(hidden('advisor')).toHaveValue('laura-vega');
  });

  it('no bloquea el registro cuando la lista de asesores viene vacía', async () => {
    // El loader degradó (Admin API caída / stub sin token): decir "sí" no debe
    // dejar al usuario atorado sin nada que elegir.
    await irAPaso2([]);
    llenarEmpresa();

    fireEvent.click(screen.getByLabelText(/sí, ya soy cliente/i));
    clickContinuar();

    expect(await screen.findByText(/paso 3\/3/)).toBeInTheDocument();
    expect(hidden('advisor')).toHaveValue(UNKNOWN_ADVISOR);
  });
});
