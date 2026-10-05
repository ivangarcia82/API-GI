// @vitest-environment jsdom
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, cleanup, within} from '@testing-library/react';
import {createRoutesStub} from 'react-router';

// Ver _index.giMkt.test.jsx: GSAP necesita matchMedia al cargarse, y
// matches:true fuerza prefersReducedMotion() para saltar animaciones.
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

import ServiceDetail, {loader} from './servicios.$id.jsx';
import {SERVICE_DETAIL_IDS} from '~/lib/site-content';

afterEach(cleanup);

async function abrir(id) {
  const Stub = createRoutesStub([{path: '/servicios/:id', Component: ServiceDetail, loader}]);
  render(<Stub initialEntries={[`/servicios/${id}`]} />);
  // Espera a que el loader resuelva y la página pinte su título.
  await screen.findByRole('heading', {level: 1});
}

const tituloH2 = (texto) =>
  screen.getAllByRole('heading', {level: 2}).find((h) => h.textContent.trim() === texto);

describe('páginas de servicio: cambios generales', () => {
  it.each(SERVICE_DETAIL_IDS)('%s dice "Lo que nos diferencia" con "diferencia" en naranja', async (id) => {
    await abrir(id);
    const h = tituloH2('Lo que nos diferencia');
    expect(h, 'falta el título').toBeTruthy();
    expect(within(h).getByText('diferencia').classList.contains('text-accent')).toBe(true);
  });

  it.each(SERVICE_DETAIL_IDS)('%s ya no tiene "Lo que incluye" ni "Cómo trabajamos"', async (id) => {
    await abrir(id);
    expect(screen.queryByText(/Lo que\s+incluye/)).toBeNull();
    expect(screen.queryByText(/Cómo trabajamos/i)).toBeNull();
    expect(screen.queryByText('Briefing')).toBeNull();
  });
});

describe('Print Shop', () => {
  it('abre con "Lo que nos distingue" y la tabla de técnicas', async () => {
    await abrir('print-shop');
    const h = tituloH2('Lo que nos distingue');
    expect(within(h).getByText('distingue').classList.contains('text-accent')).toBe(true);
    const tabla = screen.getByRole('table');
    for (const t of ['Tampografía', 'Serigrafía', 'Grabado láser', 'Bordado']) {
      expect(within(tabla).getByText(t)).toBeTruthy();
    }
    expect(within(tabla).getByText('Gorras, camisas, chamarras, mochilas')).toBeTruthy();
  });

  it('tiene el proceso de 5 pasos y la capacidad operativa', async () => {
    await abrir('print-shop');
    expect(tituloH2('De tu idea al producto terminado')).toBeTruthy();
    expect(screen.getByText('Recomendación de la técnica adecuada')).toBeTruthy();
    expect(tituloH2('Capacidad operativa')).toBeTruthy();
    expect(screen.getByText('Cumplimiento de tiempos de entrega')).toBeTruthy();
  });
});

describe('Promotional Workshop', () => {
  it('usa el texto nuevo, las 3 experiencias y los 6 pasos', async () => {
    await abrir('promotional-workshop');
    expect(screen.getByText('Tu marca no solo se ve, se siente y se experimenta.')).toBeTruthy();
    expect(tituloH2('Elige la experiencia a tu medida')).toBeTruthy();
    expect(screen.getByText('El arte de la personalización en vivo')).toBeTruthy();
    expect(tituloH2('De la idea a la ejecución, en 6 pasos')).toBeTruthy();
    expect(screen.getByText('Damos seguimiento')).toBeTruthy();
    expect(screen.getByText(/Un workshop personalizado, diseñado para inspirar/)).toBeTruthy();
  });
});

describe('Importaciones', () => {
  it('tiene el título, el mapa con puertos y los 12 años', async () => {
    await abrir('importaciones');
    expect(screen.getByText('Importamos mucho más que productos.')).toBeTruthy();
    const mapa = screen.getByRole('img', {name: /presencia internacional/i});
    expect(mapa).toBeTruthy();
    for (const p of ['Shenzhen', 'Ningbo', 'Xiamen']) expect(screen.getAllByText(new RegExp(p)).length).toBeGreaterThan(0);
    expect(screen.getByText('Más de 12 años desarrollando proyectos')).toBeTruthy();
  });

  it('el proceso horizontal va de la idea a la entrega', async () => {
    await abrir('importaciones');
    expect(tituloH2('Nuestro proceso')).toBeTruthy();
    for (const p of ['Idea', 'Diseño', 'Muestra', 'Producción', 'Control de calidad', 'Importación', 'Entrega']) {
      expect(screen.getAllByText(p).length).toBeGreaterThan(0);
    }
  });

  it('cierra con "Sabías que…" y el CTA a contacto', async () => {
    await abrir('importaciones');
    expect(screen.getByText(/desarrollo exclusivo puede ayudarte a diferenciarte/)).toBeTruthy();
    const cta = screen.getByRole('link', {name: /Quiero desarrollar mi proyecto/});
    expect(cta.getAttribute('href')).toBe('/contacto');
  });
});

describe('Digital Evolution', () => {
  it('usa la propuesta nueva y un CTA general', async () => {
    await abrir('digital-evolution');
    expect(screen.getByText('Tienda corporativa a tu medida')).toBeTruthy();
    expect(screen.getByText('Portales de obsequios')).toBeTruthy();
    const cta = screen.getByRole('link', {name: /Hablemos de tu proyecto digital/});
    expect(cta.getAttribute('href')).toBe('/contacto');
  });
});
