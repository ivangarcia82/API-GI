// @vitest-environment jsdom
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';

// Ver _index.giMkt.test.jsx: GSAP necesita matchMedia al cargarse.
vi.hoisted(() => {
  window.matchMedia =
    window.matchMedia ||
    vi.fn().mockImplementation((q) => ({
      matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
    }));
});

vi.mock('~/lib/AppContext', () => ({
  useApp: () => ({isLoggedIn: false, openQuoteDrawer: () => {}, openSearch: () => {}, quoteCount: 0}),
}));

import Conocenos from './conocenos.jsx';

afterEach(cleanup);

async function abrir() {
  const Stub = createRoutesStub([{path: '/conocenos', Component: Conocenos}]);
  const {container} = render(<Stub initialEntries={['/conocenos']} />);
  await screen.findByRole('heading', {level: 1});
  return container;
}

describe('Conócenos', () => {
  it('el encabezado ya no dice "Conócenos"', async () => {
    const c = await abrir();
    const eyebrow = c.querySelector('.about-hero .eyebrow');
    expect(eyebrow.textContent.trim()).toBe('Desde 2013');
  });

  it('el título "Líderes en la industria promocional" va debajo de la foto', async () => {
    const c = await abrir();
    const foto = c.querySelector('.about-intro figure');
    const titulo = screen.getByRole('heading', {name: 'Líderes en la industria promocional'});
    // DOCUMENT_POSITION_FOLLOWING: el título aparece después de la foto.
    expect(foto.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('separa el texto después de "un producto con logo."', async () => {
    const c = await abrir();
    const parrafos = [...c.querySelectorAll('.about-copy p')].map((p) => p.textContent.replace(/\s+/g, ' ').trim());
    expect(parrafos[0]).toMatch(/un producto con logo\.$/);
    expect(parrafos[1]).toMatch(/^Necesitan un socio/);
  });

  it('cierra con el mismo diseño que el home', async () => {
    const c = await abrir();
    expect(c.querySelector('.about-cta')).toBeNull();
    expect(c.querySelector('section.closing')).not.toBeNull();
  });
});
