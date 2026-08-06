// @vitest-environment jsdom
/* ProductCard: el comprador B2B compara abriendo varias fichas a la vez y
   cotiza en lote. Eso descansa en dos cosas que estas pruebas fijan: que el
   título sea un <a> de verdad (no una tarjeta con role="button", que no
   soporta cmd-click) y que el checkbox de selección avise hacia arriba. */
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import {createRoutesStub} from 'react-router';
import {ProductCard} from './ProductCard.jsx';
import {AppProvider} from '~/lib/AppContext.jsx';

const PRODUCTO = {
  id: 'gid://shopify/Product/1',
  handle: 'termo-carich',
  title: 'TERMO CARICH T 367',
  sku: 'T-367',
  image: 'https://cdn.example/termo.jpg',
  imageAlt: 'Termo',
  price: 129,
  currency: 'MXN',
  colors: [],
  isNew: false,
  isOffer: false,
  firstVariantId: 'gid://shopify/ProductVariant/9',
};

function montar(props = {}, {isLoggedIn = true} = {}) {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () => (
        <AppProvider isLoggedIn={isLoggedIn}>
          <ProductCard product={PRODUCTO} {...props} />
        </AppProvider>
      ),
    },
  ]);
  return render(<Stub initialEntries={['/']} />);
}

afterEach(cleanup);

describe('ProductCard como enlace real', () => {
  it('expone el título como <a> hacia la ficha', () => {
    montar();
    const enlace = screen.getByRole('link', {name: PRODUCTO.title});
    expect(enlace.getAttribute('href')).toBe(`/products/${PRODUCTO.handle}`);
  });

  it('ya no marca la tarjeta entera como role="button"', () => {
    const {container} = montar();
    expect(container.querySelector('[role="button"]')).toBeNull();
  });

  it('anuncia el estado del favorito con aria-pressed', () => {
    montar();
    const fav = screen.getByRole('button', {name: /favoritos/i});
    expect(fav.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('selección múltiple', () => {
  it('no pinta checkbox cuando la tarjeta no es seleccionable', () => {
    montar({selectable: false});
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('avisa hacia arriba con el producto al marcar', () => {
    const onToggleSelect = vi.fn();
    montar({selectable: true, selected: false, onToggleSelect});
    fireEvent.click(screen.getByRole('checkbox', {name: /Seleccionar/i}));
    expect(onToggleSelect).toHaveBeenCalledWith(PRODUCTO);
  });

  it('refleja el estado seleccionado en el checkbox y en la tarjeta', () => {
    const {container} = montar({selectable: true, selected: true, onToggleSelect: vi.fn()});
    expect(screen.getByRole('checkbox', {name: /Seleccionar/i}).checked).toBe(true);
    expect(container.querySelector('.pcard.is-selected')).not.toBeNull();
  });

  it('también ofrece selección en la vista de lista', () => {
    const onToggleSelect = vi.fn();
    montar({view: 'list', selectable: true, selected: false, onToggleSelect});
    fireEvent.click(screen.getByRole('checkbox', {name: /Seleccionar/i}));
    expect(onToggleSelect).toHaveBeenCalledWith(PRODUCTO);
  });
});
