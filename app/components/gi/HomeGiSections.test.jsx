// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {ServicesStrip, ClientTestimonials, AboutTeaser} from './HomeGiSections';
import {SERVICES, TESTIMONIALS} from '~/lib/site-content';

function renderWithRouter(ui) {
  const Stub = createRoutesStub([{path: '/', Component: () => ui}]);
  return render(<Stub initialEntries={['/']} />);
}

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
  it('AboutTeaser renders a Conócenos CTA', () => {
    renderWithRouter(<AboutTeaser />);
    expect(screen.getByText(/Conócenos/i)).toBeInTheDocument();
  });
});
