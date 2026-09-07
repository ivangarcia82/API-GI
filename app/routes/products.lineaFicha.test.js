import {describe, it, expect} from 'vitest';
import {lineaDeFicha} from './products.$handle.jsx';

/* La línea que arma la ficha viaja a dos destinos distintos: con sesión, al
   servidor, que sólo lee variante/técnica/sustrato/talla/cantidad y vuelve a
   pedirle todo lo demás a Shopify; sin ella, al carrito de invitado, que pinta
   el cajón con lo que traiga la línea. Por eso tiene que llevar AMBAS cosas. */
const PRODUCTO = {id: 'gid://p1', handle: 'termo-carich', title: 'TERMO CARICH T 367'};
const VARIANTE = {id: 'gid://v9', sku: 'T-367', selectedOptions: [{name: 'Color', value: 'ROJO'}]};

const armar = (over = {}) =>
  lineaDeFicha({
    product: PRODUCTO,
    selectedVariant: VARIANTE,
    mainImage: 'https://cdn.example/termo.jpg',
    unit: 129,
    decoDetail: null,
    qty: 50,
    ...over,
  });

describe('lineaDeFicha', () => {
  it('lleva las cinco claves que el servidor lee', () => {
    const linea = armar({
      decoDetail: {technique: 'BORDADO', surface: 'TEXTIL', size: '8 x 8'},
    });
    expect(linea).toMatchObject({
      variantId: 'gid://v9',
      technique: 'BORDADO',
      surface: 'TEXTIL',
      size: '8 x 8',
      qty: 50,
    });
  });

  it('lleva el precio de lista, o el cajón del invitado pintaría $0', () => {
    expect(armar().price).toBe(129);
  });

  it('sobrevive a un producto sin precio sin inventarse uno', () => {
    expect(armar({unit: null}).price).toBeNull();
  });

  it('asume "Sin decorado" mientras el selector no ha dicho nada', () => {
    const linea = armar();
    expect(linea.technique).toBe('Sin decorado');
    expect(linea.surface).toBe('');
    expect(linea.size).toBe('');
  });

  it('lleva título e imagen para que el invitado reconozca su línea', () => {
    const linea = armar();
    expect(linea.title).toBe('TERMO CARICH T 367');
    expect(linea.image).toBe('https://cdn.example/termo.jpg');
    expect(linea.handle).toBe('termo-carich');
  });
});
