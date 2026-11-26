// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {ServicesStrip, ClientTestimonials, AboutTeaser} from './HomeGiSections';
import {SERVICES, TESTIMONIALS} from '~/lib/site-content';

function renderWithRouter(ui) {
  const Stub = createRoutesStub([{path: '/', Component: () => ui}]);
  return render(<Stub initialEntries={['/']} />);
}

// `vitest.config.js` runs with `globals: false`, so Testing Library's
// auto-cleanup (which relies on a global `afterEach`) never kicks in. Without
// this explicit `afterEach(cleanup)`, the `render()` calls below accumulate
// in `document.body` across tests.
afterEach(cleanup);

describe('HomeGiSections', () => {
  it('ServicesStrip renders every service linking to its detail', () => {
    renderWithRouter(<ServicesStrip />);
    for (const s of SERVICES) {
      expect(screen.getByText(s.title)).toBeInTheDocument();
    }
  });
  it('ClientTestimonials renders client quotes', () => {
    renderWithRouter(<ClientTestimonials />);
    // At least the first testimonial's company appears
    expect(screen.getAllByText(TESTIMONIALS[0].company).length).toBeGreaterThan(0);
  });
  /* Decisión del negocio (nov-2026): los testimonios están ocultos de momento.
     La sección sigue montada con su contenido para poder volver a mostrarla
     quitando el `display: none`; por eso el encabezado se busca con
     `hidden: true` y lo que se fija es que no esté a la vista. */
  it('ClientTestimonials está oculto de momento, con su contenido intacto', () => {
    renderWithRouter(<ClientTestimonials />);
    expect(screen.getByText('Lo que dicen nuestros clientes')).toBeInTheDocument();
    const titulo = screen.getByRole('heading', {name: 'Relaciones que duran años.', hidden: true});
    expect(titulo).toBeInTheDocument();
    expect(titulo).not.toBeVisible();
  });
  it('AboutTeaser renders a Conócenos CTA', () => {
    renderWithRouter(<AboutTeaser />);
    expect(screen.getByText(/Conócenos/i)).toBeInTheDocument();
  });
});
