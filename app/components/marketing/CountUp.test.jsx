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
});
