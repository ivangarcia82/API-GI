// @vitest-environment jsdom
import {describe, it, expect, afterEach} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {render, screen, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {GiFooter} from './Footer.jsx';
import {ROUTES} from '~/lib/site-content';

afterEach(cleanup);

function renderFooter() {
  const Stub = createRoutesStub([{path: '/', Component: GiFooter}]);
  return render(<Stub initialEntries={['/']} />);
}

describe('footer legal', () => {
  it('enlaza el aviso de privacidad', () => {
    renderFooter();
    expect(screen.getByRole('link', {name: 'Aviso de privacidad'})).toHaveAttribute(
      'href',
      ROUTES.privacy,
    );
  });

  it('enlaza los términos y condiciones', () => {
    renderFooter();
    expect(screen.getByRole('link', {name: 'Términos y condiciones'})).toHaveAttribute(
      'href',
      ROUTES.terms,
    );
  });

  it('ROUTES.terms apunta al PDF acordado', () => {
    expect(ROUTES.terms).toBe('/legal/terminos-y-condiciones.pdf');
  });
});
