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
      <DecorationSelector product={{techniques: [], surface: ''}} basePrice={40.6} qty={1} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('lists Sin decorado plus the product techniques', () => {
    render(<DecorationSelector product={product} basePrice={40.6} qty={1} onChange={() => {}} />);
    const techSelect = screen.getByLabelText(/tipo de decorado/i);
    const values = Array.from(techSelect.querySelectorAll('option')).map((o) => o.value);
    expect(values).toContain('Sin decorado');
    expect(values).toContain('SERIGRAFÍA');
    expect(values).toContain('BORDADO');
  });

  it('populates measures after picking a technique and emits inputs', () => {
    const onChange = vi.fn();
    render(<DecorationSelector product={product} basePrice={40.6} qty={300} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/tipo de decorado/i), {target: {value: 'SERIGRAFÍA'}});
    const measure = screen.getByLabelText(/medida/i);
    const opts = Array.from(measure.querySelectorAll('option')).map((o) => o.value);
    expect(opts).toEqual(expect.arrayContaining(['4 x 4', '10 x 10', '18 x 18']));
    fireEvent.change(measure, {target: {value: '4 x 4'}});
    expect(onChange).toHaveBeenLastCalledWith({technique: 'SERIGRAFÍA', surface: 'TEXTIL', size: '4 x 4', qty: 300});
  });

  it('shows a single integrated unit price above the minimum', () => {
    render(<DecorationSelector product={product} basePrice={40.6} qty={300} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText(/tipo de decorado/i), {target: {value: 'SERIGRAFÍA'}});
    fireEvent.change(screen.getByLabelText(/medida/i), {target: {value: '4 x 4'}});
    // base 40.60 + (1491.0447.../300) = 45.5701... ⇒ round2 45.57
    expect(screen.getByTestId('deco-unit-price')).toHaveTextContent('45.57');
    expect(screen.getByTestId('deco-included')).toHaveTextContent(/incluye decorado/i);
  });

  it('shows the fixed-charge message below minimum', () => {
    render(<DecorationSelector product={product} basePrice={40.6} qty={1} onChange={() => {}} />);
    fireEvent.change(screen.getByLabelText(/tipo de decorado/i), {target: {value: 'SERIGRAFÍA'}});
    fireEvent.change(screen.getByLabelText(/medida/i), {target: {value: '4 x 4'}});
    expect(screen.getByTestId('deco-fixed-charge')).toHaveTextContent(/cargo fijo de decorado/i);
    expect(screen.getByTestId('deco-fixed-charge')).toHaveTextContent('300');
  });

  it('Sin decorado yields base price and disables measures', () => {
    const onChange = vi.fn();
    render(<DecorationSelector product={product} basePrice={40.6} qty={5} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/tipo de decorado/i), {target: {value: 'Sin decorado'}});
    expect(screen.getByLabelText(/medida/i)).toBeDisabled();
    expect(screen.getByTestId('deco-unit-price')).toHaveTextContent('40.60');
    expect(onChange).toHaveBeenLastCalledWith({technique: 'Sin decorado', surface: 'TEXTIL', size: 'N/A', qty: 5});
  });

  it('signals error state when surface does not match (data-deco-error)', () => {
    render(
      <DecorationSelector
        product={{techniques: ['SERIGRAFÍA'], surface: 'PAPEL'}}
        basePrice={40.6}
        qty={300}
        onChange={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText(/tipo de decorado/i), {target: {value: 'SERIGRAFÍA'}});
    const root = screen.getByTestId('decoration-selector');
    expect(root).toHaveAttribute('data-deco-error', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(/superficie no encontrada/i);
  });
});
