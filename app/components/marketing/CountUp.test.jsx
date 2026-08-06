// @vitest-environment jsdom
import {describe, it, expect, vi, beforeAll} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {render, screen} from '@testing-library/react';

// jsdom no implementa window.matchMedia. `~/lib/motion` (importado
// transitivamente por CountUp) registra GSAP ScrollTrigger al cargarse, lo
// cual requiere matchMedia; vi.hoisted() adelanta este stub por encima de
// los imports estáticos para que exista antes de esa carga.
vi.hoisted(() => {
  window.matchMedia =
    window.matchMedia ||
    vi.fn().mockImplementation((q) => ({
      matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
    }));
});

import {CountUp} from './CountUp';

beforeAll(() => {
  // jsdom: forzar reduced-motion → CountUp muestra el valor final de inmediato.
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  }));
});

describe('CountUp', () => {
  it('renders the final formatted value under reduced motion', () => {
    render(<CountUp value={2700} prefix="+" />);
    expect(screen.getByText('+2,700')).toBeInTheDocument();
  });

  /* La banda de estadísticas de la home se publicaba como "+0 / +0 / +0 / 0.0"
     en cualquier render que no hiciera scroll: captura de página completa,
     impresión, exportar a PDF. El valor inicial es el final justamente para
     que eso no vuelva a pasar. */
  it('muestra la cifra real, no 0, cuando nadie ha hecho scroll', () => {
    window.matchMedia = vi.fn().mockImplementation((q) => ({
      matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
    }));
    render(<CountUp value={67000} prefix="+" />);
    expect(screen.getByText('+67,000')).toBeInTheDocument();
    expect(screen.queryByText('+0')).toBeNull();
  });
});
