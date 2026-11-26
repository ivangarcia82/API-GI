// @vitest-environment jsdom
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, cleanup} from '@testing-library/react';
import {createRoutesStub} from 'react-router';

// jsdom no implementa window.matchMedia. `~/lib/motion` (importado
// transitivamente por ProcessSection/ImpactBand/MarketingLayout) registra
// GSAP ScrollTrigger al cargarse, lo cual requiere matchMedia; vi.hoisted()
// adelanta este stub por encima de los imports estáticos para que exista
// antes de esa carga. matches:true además fuerza prefersReducedMotion(),
// así ProcessSection/CountUp se saltan las animaciones GSAP/rAF bajo jsdom.
vi.hoisted(() => {
  window.matchMedia =
    window.matchMedia ||
    vi.fn().mockImplementation((q) => ({
      matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
    }));
});

vi.mock('~/lib/AppContext', () => ({
  useApp: () => ({
    isLoggedIn: false,
    openQuoteDrawer: () => {},
    openSearch: () => {},
    quoteCount: 0,
  }),
}));

import Homepage, {meta} from './_index.jsx';

const datosLoader = {
  isShopLinked: true,
  categoryCards: [],
  campanas: [],
  products: [],
};

// `vitest.config.js` corre con `globals: false`, así que el auto-cleanup de
// Testing Library (que depende de encontrar un `afterEach` global) nunca se
// activa. Sin este `afterEach(cleanup)` explícito, los 3 `render()` de este
// archivo se acumulan en `document.body` entre tests y `findByText` puede
// toparse con nodos de un test anterior — no determinista según cuánto tarde
// el árbol en asentarse.
afterEach(cleanup);

describe('home: secciones de marketing', () => {
  it('envuelve ImpactBand en un ancestro .gi-mkt', async () => {
    const Stub = createRoutesStub([
      {path: '/', Component: Homepage, loader: () => datosLoader},
    ]);
    render(<Stub initialEntries={['/']} />);

    // createRoutesStub resuelve el loader de forma asíncrona (aunque el
    // loader en sí sea síncrono): react-router renderiza un fallback vacío
    // durante esa carga inicial. findByText espera a que el home real
    // termine de hidratar antes de buscar el texto.
    const label = await screen.findByText('Clientes');
    expect(label.closest('.gi-mkt')).not.toBeNull();
  });

  it('envuelve ProcessSection en un ancestro .gi-mkt', async () => {
    const Stub = createRoutesStub([
      {path: '/', Component: Homepage, loader: () => datosLoader},
    ]);
    render(<Stub initialEntries={['/']} />);

    // "Briefing" es el primer paso de STEPS en ProcessSection.jsx: texto
    // real y estable, único en el árbol renderizado del home.
    const step = await screen.findByText('Briefing');
    expect(step.closest('.gi-mkt')).not.toBeNull();
  });

  it('envuelve ClosingCTA en un ancestro .gi-mkt', async () => {
    const Stub = createRoutesStub([
      {path: '/', Component: Homepage, loader: () => datosLoader},
    ]);
    render(<Stub initialEntries={['/']} />);

    // "Cotizar" es el texto del CTA final en ClosingCTA.jsx: texto real y
    // estable, único en el árbol renderizado del home.
    const cta = await screen.findByText('Cotizar');
    expect(cta.closest('.gi-mkt')).not.toBeNull();
  });
});

describe('home: hero', () => {
  it('el collage muestra imágenes de categorías, no de productos', async () => {
    const Stub = createRoutesStub([
      {
        path: '/',
        Component: Homepage,
        loader: () => ({
          ...datosLoader,
          categoryCards: [
            {handle: 'bebidas', name: 'Bebidas', icon: 'drink', image: 'https://cdn/cat-bebidas.jpg'},
            {handle: 'hogar', name: 'Hogar', icon: 'home', image: 'https://cdn/cat-hogar.jpg'},
          ],
          products: [{id: 'p1', handle: 'taza', title: 'Taza', image: 'https://cdn/producto.jpg', colors: []}],
        }),
      },
    ]);
    const {container} = render(<Stub initialEntries={['/']} />);
    await screen.findByRole('heading', {level: 1});
    const srcs = [...container.querySelectorAll('.hero-collage img')].map((i) => i.getAttribute('src'));
    expect(srcs).toContain('https://cdn/cat-bebidas.jpg');
    expect(srcs).not.toContain('https://cdn/producto.jpg');
  });
});

/* Un asistente de IA o un buscador decide de qué trata el sitio con la
   descripción y el primer párrafo. Si ahí no dice qué se vende ni en qué país,
   no hay forma de que lo recomiende a quien busca promocionales en México. */
describe('home: qué somos y dónde', () => {
  it('la descripción dice qué se vende y en qué país, sin jerga técnica', () => {
    const {content} = meta().find((d) => d.name === 'description');
    expect(content).toMatch(/artículos promocionales/i);
    expect(content).toContain('México');
    expect(content).not.toMatch(/headless/i);
  });

  it('el primer párrafo dice que son promocionales para empresas en México', async () => {
    const Stub = createRoutesStub([
      {path: '/', Component: Homepage, loader: () => datosLoader},
    ]);
    render(<Stub initialEntries={['/']} />);
    const parrafo = await screen.findByText(/artículos promocionales/i, {selector: '.home-hero-sub'});
    expect(parrafo.textContent).toMatch(/empresas en México/);
  });

  /* Cifras confirmadas por el negocio (26-nov-2026): el catálogo tiene más de
     7,000 productos (no 1,800) y los clientes son más de 400 (los 2,700 que
     decía la banda eran usuarios mal etiquetados). */
  it('el inicio dice las cifras confirmadas', async () => {
    const Stub = createRoutesStub([
      {path: '/', Component: Homepage, loader: () => datosLoader},
    ]);
    const {container} = render(<Stub initialEntries={['/']} />);
    const parrafo = await screen.findByText(/artículos promocionales/i, {selector: '.home-hero-sub'});
    expect(parrafo.textContent).toMatch(/Más de 7,000 artículos/);
    expect(container.textContent).toMatch(/7,000\+ productos/);
    expect(container.textContent).toMatch(/\+\s*400/);
    expect(container.textContent).not.toMatch(/1,800|2,700/);
  });
});
