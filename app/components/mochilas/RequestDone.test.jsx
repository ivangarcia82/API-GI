// @vitest-environment jsdom
import {describe, it, expect, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
import {RequestDone} from './RequestDone.jsx';

afterEach(cleanup);

const REQUEST = {
  line: 'Wagner',
  model: 'Space',
  color: 'Azul',
  image: 'https://cdn/spa.png',
  foraneo: true,
  createdAt: '2026-09-25T17:00:00.000Z',
};

describe('RequestDone', () => {
  it('confirma la mochila, la entrega y a quién escribir para cambiarla', () => {
    render(<RequestDone request={REQUEST} collaborator={{fullName: 'Ana López', email: 'ana@generandoideas.com'}} />);
    expect(screen.getByRole('heading', {level: 1}).textContent).toMatch('Ana');
    expect(screen.getByText('Wagner Space')).toBeTruthy();
    expect(screen.getByText('Azul')).toBeTruthy();
    expect(screen.getByText('Envío foráneo')).toBeTruthy();
    expect(screen.getByText(/25 de septiembre/)).toBeTruthy();
    expect(screen.getByRole('link', {name: 'igarcia@generandoideas.com'}).getAttribute('href')).toBe(
      'mailto:igarcia@generandoideas.com',
    );
    expect(screen.getByRole('img').getAttribute('src')).toBe('https://cdn/spa.png');
  });

  it('entrega en oficina y sin fecha cuando acaba de enviarse', () => {
    render(
      <RequestDone
        request={{...REQUEST, foraneo: false, createdAt: undefined}}
        collaborator={{fullName: '', email: 'ana@generandoideas.com'}}
      />,
    );
    expect(screen.getByText('Entrega en oficina')).toBeTruthy();
    expect(screen.queryByText(/de septiembre/)).toBeNull();
  });
});

describe('RequestDone · iniciales', () => {
  const quien = {fullName: 'Ana López', email: 'ana@generandoideas.com'};

  it('confirma las iniciales que se grabarán', () => {
    render(<RequestDone request={{...REQUEST, initials: 'ALG'}} collaborator={quien} />);
    expect(screen.getByText('Iniciales')).toBeTruthy();
    expect(screen.getByText('ALG')).toBeTruthy();
  });

  it('una solicitud anterior al campo no muestra la fila', () => {
    render(<RequestDone request={REQUEST} collaborator={quien} />);
    expect(screen.queryByText('Iniciales')).toBeNull();
  });
});

describe('RequestDone · sede', () => {
  it('dice a qué sede va el envío', () => {
    render(
      <RequestDone
        request={{...REQUEST, sede: 'Yucatán · Sucursal'}}
        collaborator={{fullName: 'Ana López', email: 'ana@generandoideas.com'}}
      />,
    );
    expect(screen.getByText('Envío a Yucatán · Sucursal')).toBeTruthy();
  });
});
