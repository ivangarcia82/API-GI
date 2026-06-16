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

  it('lists Sin decorado plus the product techniques as buttons', () => {
    render(<DecorationSelector product={product} basePrice={40.6} qty={1} onChange={() => {}} />);
    expect(screen.getByRole('button', {name: /sin decorado/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /SERIGRAFÍA/})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /BORDADO/})).toBeInTheDocument();
  });

  it('shows a "desde $X/pz" hint on a technique chip', () => {
    render(<DecorationSelector product={product} basePrice={40.6} qty={1} onChange={() => {}} />);
    // SERIGRAFÍA/TEXTIL min precioMinimo 3.33 ⇒ 3.33/0.67 = 4.97
    expect(screen.getByRole('button', {name: /SERIGRAFÍA/})).toHaveTextContent('desde $4.97/pz');
  });

  it('populates measures after picking a technique and emits inputs', () => {
    const onChange = vi.fn();
    render(<DecorationSelector product={product} basePrice={40.6} qty={300} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', {name: /SERIGRAFÍA/}));
    expect(screen.getByRole('button', {name: '4 x 4'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '10 x 10'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '18 x 18'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '4 x 4'}));
    expect(onChange).toHaveBeenLastCalledWith({technique: 'SERIGRAFÍA', surface: 'TEXTIL', size: '4 x 4', qty: 300});
  });

  it('shows a single integrated unit price above the minimum', () => {
    render(<DecorationSelector product={product} basePrice={40.6} qty={300} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', {name: /SERIGRAFÍA/}));
    fireEvent.click(screen.getByRole('button', {name: '4 x 4'}));
    // base 40.60 + (1491.0447.../300) = 45.5701... ⇒ round2 45.57
    expect(screen.getByTestId('deco-unit-price')).toHaveTextContent('45.57');
    expect(screen.getByTestId('deco-included')).toHaveTextContent(/incluye decorado/i);
  });

  it('shows the fixed-charge message below minimum', () => {
    render(<DecorationSelector product={product} basePrice={40.6} qty={1} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', {name: /SERIGRAFÍA/}));
    fireEvent.click(screen.getByRole('button', {name: '4 x 4'}));
    expect(screen.getByTestId('deco-fixed-charge')).toHaveTextContent(/cargo fijo de decorado/i);
    expect(screen.getByTestId('deco-fixed-charge')).toHaveTextContent('300');
  });

  it('Sin decorado yields base price and shows no measure picker', () => {
    const onChange = vi.fn();
    render(<DecorationSelector product={product} basePrice={40.6} qty={5} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', {name: /sin decorado/i}));
    expect(screen.queryByText(/elige la medida/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('deco-unit-price')).toHaveTextContent('40.60');
    expect(onChange).toHaveBeenLastCalledWith({technique: 'Sin decorado', surface: 'TEXTIL', size: 'N/A', qty: 5});
  });

  it('quotes silently for an unknown surface — never discloses the fallback material/rate', () => {
    render(
      <DecorationSelector
        product={{techniques: ['SERIGRAFÍA'], surface: 'PAPEL'}}
        basePrice={40.6}
        qty={300}
        onChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', {name: /SERIGRAFÍA/}));
    fireEvent.click(screen.getByRole('button', {name: '4 x 4'}));
    const root = screen.getByTestId('decoration-selector');
    expect(root).toHaveAttribute('data-deco-error', 'false');
    // Customer never sees the fallback surface key or any "highest rate" note.
    expect(screen.queryByTestId('deco-fallback')).not.toBeInTheDocument();
    expect(root).not.toHaveTextContent(/RUBBER|VIDRIO|tarifa|estimad/i);
    // base 40.60 + (2686.56/300) = 49.55... ⇒ round2 49.56 (priced via the fallback)
    expect(screen.getByTestId('deco-unit-price')).toHaveTextContent('49.56');
  });
});
