// @vitest-environment jsdom
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';

vi.mock('~/lib/AppContext', () => ({
  useApp: () => ({
    isLoggedIn: false,
    openQuoteDrawer: () => {},
    openSearch: () => {},
    quoteCount: 0,
  }),
}));

import {GiHeader} from './Header.jsx';

// `vitest.config.js` corre con `globals: false`, así que el auto-cleanup de
// Testing Library (que depende de encontrar un `afterEach` global) nunca se
// activa. Sin este `afterEach(cleanup)` explícito, los `render()` de este
// archivo se acumulan en `document.body` entre tests.
afterEach(cleanup);

describe('GiHeader: SocialIcons namespaceado bajo .gi-mkt', () => {
  it('envuelve SocialIcons (variant="nav") en un ancestro .gi-mkt', async () => {
    const Stub = createRoutesStub([
      {path: '/', Component: () => <GiHeader isLoggedIn={false} />},
    ]);
    render(<Stub initialEntries={['/']} />);

    // SocialIcons pone aria-label={it.label} en cada <a>; "Instagram" es
    // texto/atributo real y estable (SocialIcons.jsx línea 5), único en el
    // header renderizado.
    const instagramLink = await screen.findByLabelText('Instagram');
    expect(instagramLink.closest('.gi-mkt')).not.toBeNull();
  });
});
