// @vitest-environment jsdom
/* useDialogBehavior concentra lo que un cajón modal debe hacer y que es fácil
   olvidar por separado: que el fondo no siga desplazándose bajo el panel, que
   Escape lo cierre, y que el foco entre al abrir y vuelva al disparador al
   cerrar. Se probó aquí porque tres superficies (cotización, filtros, orden)
   dependen del mismo comportamiento y una regresión sería silenciosa. */
import {describe, it, expect, vi, afterEach} from 'vitest';
import {useRef, useState} from 'react';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import {useDialogBehavior} from './dialog.js';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

/* Disparador + panel, como en el catálogo: el panel siempre está montado y
   sólo cambia `open`. */
function Host({onClose = () => {}}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const cerrar = () => {
    onClose();
    setOpen(false);
  };
  useDialogBehavior({open, onClose: cerrar, panelRef});
  return (
    <>
      <button onClick={() => setOpen(true)}>Filtros</button>
      <div ref={panelRef}>
        <button>Cerrar</button>
        <button>Limpiar</button>
      </div>
    </>
  );
}

describe('useDialogBehavior', () => {
  it('bloquea el scroll del fondo mientras está abierto y lo devuelve al cerrar', () => {
    render(<Host />);
    expect(document.body.style.overflow).toBe('');

    fireEvent.click(screen.getByText('Filtros'));
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, {key: 'Escape'});
    expect(document.body.style.overflow).toBe('');
  });

  it('cierra con Escape', () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    fireEvent.click(screen.getByText('Filtros'));
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('no reacciona a Escape mientras está cerrado', () => {
    const onClose = vi.fn();
    render(<Host onClose={onClose} />);
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lleva el foco al panel al abrir y lo devuelve al disparador al cerrar', () => {
    render(<Host />);
    const disparador = screen.getByText('Filtros');
    disparador.focus();

    fireEvent.click(disparador);
    expect(document.activeElement).toBe(screen.getByText('Cerrar'));

    fireEvent.keyDown(document, {key: 'Escape'});
    expect(document.activeElement).toBe(disparador);
  });

  it('no mueve el foco al cerrar si nadie lo tenía al abrir', () => {
    /* Safari no enfoca botones al tocarlos: el disparador guardado acaba
       siendo el <body>. Enfocarlo mandaría al usuario al principio del
       documento, que es peor que dejar el foco donde está. */
    render(<Host />);
    // fireEvent.click despacha el evento sin enfocar el botón: justo lo que
    // hace Safari al tocarlo.
    fireEvent.click(screen.getByText('Filtros'));
    expect(document.activeElement).toBe(screen.getByText('Cerrar'));

    fireEvent.keyDown(document, {key: 'Escape'});
    expect(document.activeElement).not.toBe(document.body);
  });

  it('atrapa el tabulador dentro del panel', () => {
    render(<Host />);
    fireEvent.click(screen.getByText('Filtros'));
    const primero = screen.getByText('Cerrar');
    const ultimo = screen.getByText('Limpiar');

    ultimo.focus();
    fireEvent.keyDown(ultimo, {key: 'Tab'});
    expect(document.activeElement).toBe(primero);

    fireEvent.keyDown(primero, {key: 'Tab', shiftKey: true});
    expect(document.activeElement).toBe(ultimo);
  });
});
