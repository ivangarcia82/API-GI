// @vitest-environment jsdom
import {describe, it, expect, afterEach, vi} from 'vitest';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {MochilaForm} from './MochilaForm.jsx';

const LINES = [
  {
    id: 'takayama',
    name: 'Takayama',
    products: [
      {
        id: 'p1',
        handle: 'zen',
        name: 'Zen',
        description: '',
        variants: [{id: 'v1', color: 'Negro', image: null, imageAlt: null}],
      },
      {
        id: 'p2',
        handle: 'sack',
        name: 'Sack',
        description: '',
        variants: [
          {id: 'v2', color: 'Azul / Negro', image: null, imageAlt: null},
          {id: 'v3', color: 'Negro', image: null, imageAlt: null},
        ],
      },
    ],
  },
  {
    id: 'wagner',
    name: 'Wagner',
    products: [
      {
        id: 'p3',
        handle: 'arx',
        name: 'Armor Max',
        description: '',
        variants: [{id: 'w1', color: 'Negro / Gris', image: null, imageAlt: null}],
      },
    ],
  },
];

function montar() {
  const onSelectVariant = vi.fn();
  const Stub = createRoutesStub([
    {
      path: '/campana-mochilas',
      Component: () => (
        <MochilaForm
          lines={LINES}
          collaborator={{email: 'ana@generandoideas.com', fullName: 'Ana López'}}
          selectedVariantId=""
          onSelectVariant={onSelectVariant}
        />
      ),
      action: () => ({ok: true}),
    },
  ]);
  render(<Stub initialEntries={['/campana-mochilas']} />);
  return {onSelectVariant};
}

afterEach(cleanup);

describe('MochilaForm', () => {
  it('prellena el nombre y muestra el correo sin dejarlo editar', () => {
    montar();
    expect(screen.getByLabelText('Nombre completo').value).toBe('Ana López');
    expect(screen.getByText('ana@generandoideas.com')).toBeTruthy();
    expect(screen.queryByLabelText('Correo')).toBeNull();
  });

  it('agrupa las opciones por línea, una por color, y avisa al elegir', () => {
    const {onSelectVariant} = montar();
    const select = screen.getByLabelText('Mochila');
    const groups = [...select.querySelectorAll('optgroup')].map((g) => g.label);
    expect(groups).toEqual(['Takayama', 'Wagner']);
    expect(select.querySelectorAll('option:not([value=""])')).toHaveLength(4);
    fireEvent.change(select, {target: {value: 'w1'}});
    expect(onSelectVariant).toHaveBeenCalledWith('w1');
  });

  it('pide la dirección sólo si es foráneo', () => {
    montar();
    expect(screen.queryByLabelText('Código postal')).toBeNull();
    fireEvent.click(screen.getByLabelText('Sí, necesito envío'));
    expect(screen.getByLabelText('Código postal')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('No, recojo en oficina'));
    expect(screen.queryByLabelText('Código postal')).toBeNull();
  });
});
