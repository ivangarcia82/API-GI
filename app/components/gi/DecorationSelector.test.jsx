// @vitest-environment jsdom
import {describe, it, expect, vi, afterEach} from 'vitest';
import '@testing-library/jest-dom/vitest';
import {render, screen, fireEvent, cleanup} from '@testing-library/react';
import DecorationSelector from './DecorationSelector.jsx';

afterEach(cleanup);

const product = {techniques: ['SERIGRAFÍA', 'BORDADO'], surface: 'TEXTIL'};

describe('DecorationSelector', () => {
  it('renders nothing when product has no techniques', () => {
    const {container} = render(
      <DecorationSelector product={{techniques: [], surface: ''}} qty={1} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('lists Sin decorado plus the product techniques as buttons', () => {
    render(<DecorationSelector product={product} qty={1} onChange={() => {}} />);
    expect(screen.getByRole('button', {name: /sin decorado/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /SERIGRAFÍA/})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /BORDADO/})).toBeInTheDocument();
  });

  it('renders NO prices — only the technique/size pickers (prices live in the PDP price bar)', () => {
    render(<DecorationSelector product={product} qty={300} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', {name: /SERIGRAFÍA/}));
    fireEvent.click(screen.getByRole('button', {name: '4 x 4'}));
    const root = screen.getByTestId('decoration-selector');
    expect(root).not.toHaveTextContent(/\$|MXN|incluye|cargo fijo|desde/i);
  });

  it('shows no error after picking only a technique (before a measure)', () => {
    render(<DecorationSelector product={product} qty={300} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', {name: /SERIGRAFÍA/}));
    expect(screen.getByTestId('decoration-selector')).toHaveAttribute('data-deco-error', 'false');
    expect(screen.queryByTestId('deco-error')).not.toBeInTheDocument();
    expect(screen.queryByText(/medida no encontrada/i)).not.toBeInTheDocument();
  });

  it('populates measures after picking a technique and emits inputs', () => {
    const onChange = vi.fn();
    render(<DecorationSelector product={product} qty={300} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', {name: /SERIGRAFÍA/}));
    expect(screen.getByRole('button', {name: '4 x 4'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '10 x 10'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '18 x 18'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '4 x 4'}));
    expect(onChange).toHaveBeenLastCalledWith({technique: 'SERIGRAFÍA', surface: 'TEXTIL', size: '4 x 4', qty: 300});
  });

  it('Sin decorado emits an N/A size and shows no measure picker', () => {
    const onChange = vi.fn();
    render(<DecorationSelector product={product} qty={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', {name: /sin decorado/i}));
    expect(screen.queryByText(/elige la medida/i)).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({technique: 'Sin decorado', surface: 'TEXTIL', size: 'N/A', qty: 5});
  });

  it('unknown surface still offers a (fallback) size and emits without error', () => {
    const onChange = vi.fn();
    render(
      <DecorationSelector
        product={{techniques: ['SERIGRAFÍA'], surface: 'PAPEL'}}
        qty={300}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', {name: /SERIGRAFÍA/}));
    fireEvent.click(screen.getByRole('button', {name: '4 x 4'}));
    expect(screen.getByTestId('decoration-selector')).toHaveAttribute('data-deco-error', 'false');
    expect(onChange).toHaveBeenLastCalledWith({technique: 'SERIGRAFÍA', surface: 'PAPEL', size: '4 x 4', qty: 300});
  });
});

describe('Sin decorado por defecto', () => {
  it('arranca con "Sin decorado" elegido y lo anuncia', () => {
    const onChange = vi.fn();
    render(<DecorationSelector product={product} qty={50} onChange={onChange} />);
    const sin = screen.getByRole('button', {name: 'Sin decorado'});
    expect(sin.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', {name: 'SERIGRAFÍA'}).getAttribute('aria-pressed')).toBe('false');
    // La ficha recibe la elección desde el primer render: el precio y la
    // línea que se cotiza ya son "sin decorado" sin que el usuario toque nada.
    expect(onChange).toHaveBeenLastCalledWith({technique: 'Sin decorado', surface: 'TEXTIL', size: 'N/A', qty: 50});
  });
});
