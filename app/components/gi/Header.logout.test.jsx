// @vitest-environment jsdom
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, cleanup, fireEvent, waitFor} from '@testing-library/react';
import {createRoutesStub} from 'react-router';

vi.mock('~/lib/AppContext', () => ({
  useApp: () => ({
    isLoggedIn: true,
    openQuoteDrawer: () => {},
    openSearch: () => {},
    quoteCount: 0,
  }),
}));

import {GiHeader} from './Header.jsx';

// Ver la nota en Header.giMkt.test.jsx: `globals: false` desactiva el
// auto-cleanup de Testing Library, hay que llamarlo explícitamente.
afterEach(cleanup);

// ALCANCE REAL DE ESTE TEST — leer antes de confiar en él.
//
// El bug que motivó este archivo (el clic cerraba el menú, eso desmontaba el
// <form> y el navegador cancelaba el envío con "Form submission canceled
// because the form is not connected") NO se reproduce en jsdom: jsdom despacha
// el evento `submit` sin aplicar la comprobación de "form conectado" que hace
// el navegador. Verificado: este test pasaba igual con el código roto.
//
// Lo que sí cubre: que el control siga apuntando a /auth/logout por POST. Atrapa
// una ruta mal escrita, un método cambiado o el botón eliminado.
// Lo que NO cubre: la condición de carrera entre desmontaje y envío. Esa sólo
// se verifica en un navegador real.
describe('GiHeader: cerrar sesión desde el menú del navbar', () => {
  it('envía POST a /auth/logout aunque el clic cierre el menú', async () => {
    const logoutAction = vi.fn(() => ({ok: true}));

    const Stub = createRoutesStub([
      {path: '/', Component: () => <GiHeader isLoggedIn />},
      {path: '/auth/logout', action: logoutAction},
    ]);
    render(<Stub initialEntries={['/']} />);

    // El menú de usuario está cerrado; el disparador es el chip del avatar.
    fireEvent.click(screen.getByText('GI'));
    fireEvent.click(await screen.findByText('Cerrar sesión'));

    // El control cierra el menú Y debe llegar al servidor. Si el cierre
    // desmonta el <form> antes de que salga el envío, esto queda en 0.
    await waitFor(() => expect(logoutAction).toHaveBeenCalledTimes(1));
  });
});
