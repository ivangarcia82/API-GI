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

function montar(
  props = {},
  {isLoggedIn = true, producto = PRODUCTO, brandColors = []} = {},
) {
  const Stub = createRoutesStub([
    {
      path: '/',
      Component: () => (
        <AppProvider isLoggedIn={isLoggedIn} brandColors={brandColors}>
          <ProductCard product={producto} {...props} />
        </AppProvider>
      ),
    },
  ]);
  return render(<Stub initialEntries={['/']} />);
}

afterEach(cleanup);
/* El carrito de invitado vive en localStorage y sobrevive al desmontaje: sin
   limpiarlo, la prueba siguiente monta con sesión, dispara la migración y ve
   una petición a /api/quote/merge que no pidió. */
afterEach(() => window.localStorage.clear());

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

/* El precio dejó de estar tras el login: un comprador que compara proveedores
   no crea una cuenta para saber si estamos en su rango. Lo que sigue cerrado
   es cotizar. */
describe('precio visible sin sesión', () => {
  it('muestra el precio en la cuadrícula aunque no haya sesión', () => {
    montar({}, {isLoggedIn: false});
    expect(screen.getByText('$129')).toBeTruthy();
    expect(screen.queryByText(/Precio para clientes/i)).toBeNull();
  });

  it('muestra el precio en la vista de lista aunque no haya sesión', () => {
    montar({view: 'list'}, {isLoggedIn: false});
    expect(screen.getByText('$129')).toBeTruthy();
    expect(screen.queryByText(/Inicia sesión/i)).toBeNull();
  });

  it('dice a quién preguntar cuando el producto no trae precio', () => {
    // normalizeProduct deja price en null si la variante no tiene precio
    // (gi.js). formatPrice devuelve '' con null, así que sin esta rama la
    // tarjeta pintaba "desde" seguido de un hueco.
    montar({}, {isLoggedIn: false, producto: {...PRODUCTO, price: null}});
    expect(screen.getByText(/Consultar con asesor/i)).toBeTruthy();
    expect(screen.queryByText('desde')).toBeNull();
  });

  /* Cotizar dejó de estar tras el login: el invitado arma su lista y la cuenta
     se le pide al enviarla, con el trabajo ya hecho enfrente. */
  it('deja cotizar sin sesión', () => {
    montar({}, {isLoggedIn: false});
    expect(screen.getByRole('button', {name: /Añadir a cotización/i})).toBeTruthy();
  });

  it('sin sesión guarda en el navegador y no llama al servidor', async () => {
    const enviadas = capturarCotizadas();
    window.localStorage.clear();
    montar({}, {isLoggedIn: false});
    fireEvent.click(screen.getByRole('button', {name: /Añadir a cotización/i}));

    await vi.waitFor(() => {
      const guardado = JSON.parse(window.localStorage.getItem('gi_quote') || '{}');
      expect(guardado.lines?.[0]?.variantId).toBe(PRODUCTO.firstVariantId);
    });
    // Sin sesión el servidor rechazaría la petición con un redirect a /login,
    // así que ni se intenta: el carrito del invitado es puramente local.
    expect(enviadas).toHaveLength(0);
  });
});

/* Un cliente con paleta de marca no puede ver ni cotizar tonos que no son
   suyos: la fila de swatches de la tarjeta los enseñaba todos, y el botón de
   cotizar mandaba `firstVariantId`, que es la primera variante que devolvió la
   consulta y puede ser de cualquier color. */

const CON_COLORES = {
  ...PRODUCTO,
  colors: ['AZUL', 'ROJO', 'VERDE'],
  firstVariantId: 'gid://variant/AZUL',
  colorVariants: [
    {name: 'AZUL', variantId: 'gid://variant/AZUL'},
    {name: 'ROJO', variantId: 'gid://variant/ROJO'},
    {name: 'VERDE', variantId: 'gid://variant/VERDE'},
  ],
};

/* addToQuote habla con /api/quote/add por `fetch`, así que la variante que se
   cotiza de verdad se lee del cuerpo de esa petición. Es la aserción honesta:
   observa lo que sale hacia el servidor, no un doble nuestro. */
function capturarCotizadas() {
  const enviadas = [];
  vi.stubGlobal('fetch', async (url, init) => {
    if (String(url).includes('/api/quote/')) {
      enviadas.push(new URLSearchParams(init.body));
    }
    return new Response(JSON.stringify({ok: true, items: []}), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    });
  });
  return enviadas;
}

afterEach(() => vi.unstubAllGlobals());

/** Los tonos que la tarjeta está pintando, por su `title`. */
const tonosPintados = () =>
  [...document.querySelectorAll('[title]')]
    .map((el) => el.getAttribute('title'))
    .filter((t) => CON_COLORES.colors.includes(t));

describe('ProductCard · colores de marca', () => {
  it('sin paleta pinta todos los tonos', () => {
    montar({}, {producto: CON_COLORES});
    expect(tonosPintados()).toEqual(['AZUL', 'ROJO', 'VERDE']);
  });

  it('con paleta pinta sólo los tonos de la marca', () => {
    montar({}, {producto: CON_COLORES, brandColors: ['rojo']});
    expect(tonosPintados()).toEqual(['ROJO']);
  });

  it('cotiza la variante del color de la marca, no la primera de la consulta', async () => {
    const enviadas = capturarCotizadas();
    montar({}, {producto: CON_COLORES, brandColors: ['rojo']});
    fireEvent.click(screen.getByRole('button', {name: 'Añadir a cotización'}));
    await vi.waitFor(() => expect(enviadas).toHaveLength(1));
    expect(enviadas[0].get('variantId')).toBe('gid://variant/ROJO');
  });

  it('sin paleta cotiza la variante por defecto', async () => {
    const enviadas = capturarCotizadas();
    montar({}, {producto: CON_COLORES});
    fireEvent.click(screen.getByRole('button', {name: 'Añadir a cotización'}));
    await vi.waitFor(() => expect(enviadas).toHaveLength(1));
    expect(enviadas[0].get('variantId')).toBe('gid://variant/AZUL');
  });
});
