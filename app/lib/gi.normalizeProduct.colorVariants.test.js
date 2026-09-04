/* La tarjeta de producto sólo conocía una variante (`variants(first: 1)`), y de
   ahí salía el id que el botón de cotizar mandaba al servidor. Para un cliente
   con paleta de marca eso podía ser una variante de un color que no puede
   pedir, así que la tarjeta necesita saber qué variante corresponde a cada
   tono. Ver brandVariantId en brand-colors.js. */
import {describe, it, expect} from 'vitest';
import {normalizeProduct} from './gi.js';

function nodo(options) {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'mochila-test',
    title: 'Mochila Test',
    featuredImage: {url: 'https://cdn.test/img.jpg', altText: 'Mochila'},
    priceRange: {minVariantPrice: {amount: '120.00', currencyCode: 'MXN'}},
    options,
    variants: {nodes: [{id: 'gid://variant/DEFECTO', availableForSale: true}]},
  };
}

const OPCION_COLOR = [
  {
    name: 'Color',
    optionValues: [
      {name: 'ROJO', firstSelectableVariant: {id: 'gid://variant/ROJO'}},
      {name: 'NEGRO', firstSelectableVariant: {id: 'gid://variant/NEGRO'}},
    ],
  },
];

describe('normalizeProduct · colorVariants', () => {
  it('empareja cada tono con su variante seleccionable', () => {
    expect(normalizeProduct(nodo(OPCION_COLOR)).colorVariants).toEqual([
      {name: 'ROJO', variantId: 'gid://variant/ROJO'},
      {name: 'NEGRO', variantId: 'gid://variant/NEGRO'},
    ]);
  });

  /* Las consultas de listado que no piden firstSelectableVariant siguen
     funcionando: el tono queda sin variante y brandVariantId lo salta. */
  it('deja la variante en null cuando la consulta no la pidió', () => {
    const sinVariante = [{name: 'Color', optionValues: [{name: 'ROJO'}]}];
    expect(normalizeProduct(nodo(sinVariante)).colorVariants).toEqual([
      {name: 'ROJO', variantId: null},
    ]);
  });

  it('devuelve una lista vacía si el producto no tiene opción de color', () => {
    const soloTalla = [{name: 'Talla', optionValues: [{name: 'CH'}]}];
    expect(normalizeProduct(nodo(soloTalla)).colorVariants).toEqual([]);
  });

  it('devuelve una lista vacía si el producto no tiene opciones', () => {
    expect(normalizeProduct(nodo([])).colorVariants).toEqual([]);
  });
});
