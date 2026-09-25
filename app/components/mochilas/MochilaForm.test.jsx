// @vitest-environment jsdom
import {forwardRef} from 'react';
import {describe, it, expect, afterEach, vi} from 'vitest';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import {MochilaForm} from './MochilaForm.jsx';

const SELECTION = {
  line: {id: 'takayama', name: 'Takayama'},
  product: {id: 'p1', name: 'Zen'},
  variant: {id: 'v1', color: 'Negro', image: 'https://cdn/zen.png', imageAlt: null},
};

function fakeFetcher(data) {
  return {
    state: 'idle',
    data,
    Form: forwardRef(function FakeForm({children, ...props}, ref) {
      return (
        <form ref={ref} {...props}>
          {children}
        </form>
      );
    }),
  };
}

function montar({selection = SELECTION, data} = {}) {
  const onChange = vi.fn();
  render(
    <MochilaForm
      fetcher={fakeFetcher(data)}
      collaborator={{email: 'ana@generandoideas.com', fullName: 'Ana López'}}
      selection={selection}
      onChange={onChange}
    />,
  );
  return {onChange};
}

afterEach(cleanup);

describe('MochilaForm · tu mochila', () => {
  it('sin elección invita a ver modelos y no deja enviar', () => {
    const {onChange} = montar({selection: null});
    expect(screen.getByText('Aún no eliges tu mochila')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Ver modelos'}));
    expect(onChange).toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Enviar mi elección'}).disabled).toBe(true);
  });

  it('con elección muestra la mochila y la manda como variantId', () => {
    const {onChange} = montar();
    expect(screen.getByText('Takayama Zen')).toBeTruthy();
    expect(screen.getByText('Negro')).toBeTruthy();
    expect(document.querySelector('input[name="variantId"]').value).toBe('v1');
    fireEvent.click(screen.getByRole('button', {name: 'Cambiar'}));
    expect(onChange).toHaveBeenCalled();
  });
});

describe('MochilaForm · datos', () => {
  it('prellena el nombre y muestra el correo de sólo lectura', () => {
    montar();
    expect(screen.getByLabelText('Nombre completo').value).toBe('Ana López');
    const correo = screen.getByLabelText('Correo');
    expect(correo.value).toBe('ana@generandoideas.com');
    expect(correo.readOnly).toBe(true);
    expect(correo.getAttribute('name')).toBeNull();
  });

  it('pide la dirección sólo con envío a domicilio', () => {
    montar();
    expect(screen.queryByLabelText('Código postal')).toBeNull();
    fireEvent.click(screen.getByLabelText(/Envío a domicilio/));
    expect(screen.getByLabelText('Código postal')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/En la oficina/));
    expect(screen.queryByLabelText('Código postal')).toBeNull();
  });

  it('liga cada error a su campo', () => {
    montar({data: {ok: false, errors: {phone: 'El teléfono debe tener 10 dígitos.'}}});
    const tel = screen.getByLabelText('Teléfono (WhatsApp)');
    expect(tel.getAttribute('aria-invalid')).toBe('true');
    const errorId = tel.getAttribute('aria-describedby');
    expect(document.getElementById(errorId).textContent).toBe('El teléfono debe tener 10 dígitos.');
  });

  it('muestra el error general', () => {
    montar({data: {ok: false, formError: 'No pudimos enviar tu elección, intenta de nuevo.'}});
    expect(screen.getByRole('alert').textContent).toMatch('No pudimos enviar');
  });
});
