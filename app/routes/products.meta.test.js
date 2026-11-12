/* La ficha enseña clave, precio de lista y existencia a cualquier visitante.
   Los datos estructurados tienen que decir lo mismo: es lo que leen los
   buscadores y los asistentes de IA para recomendar un producto concreto. */
import {describe, it, expect} from 'vitest';
import {meta} from './products.$handle.jsx';

const ORIGEN = 'https://generandoideas.com';
const producto = (variante = {}) => ({
  title: 'CABLE CONECTOR USB CLICK A2558',
  handle: 'dv-a2558',
  description: 'Cable conector USB con adaptador dúo.',
  featuredImage: {url: 'https://cdn.example/a2558.jpg'},
  selectedOrFirstAvailableVariant: {
    sku: 'A2558.01',
    availableForSale: true,
    price: {amount: '133.0', currencyCode: 'MXN'},
    ...variante,
  },
});

const esquema = (p) =>
  meta({data: {origin: ORIGEN, product: p}}).find((d) => d['script:ld+json'])['script:ld+json'];

describe('ficha de producto: datos estructurados', () => {
  it('declara la clave de la variante que se enseña', () => {
    expect(esquema(producto()).sku).toBe('A2558.01');
  });

  it('declara el precio de lista en pesos y sin IVA, como lo dice la ficha', () => {
    const {offers} = esquema(producto());
    expect(offers).toMatchObject({
      '@type': 'Offer',
      url: `${ORIGEN}/products/dv-a2558`,
      price: 133,
      priceCurrency: 'MXN',
      priceSpecification: {valueAddedTaxIncluded: false},
    });
  });

  it('marca la existencia igual que la etiqueta En stock / Agotado', () => {
    expect(esquema(producto()).offers.availability).toBe('https://schema.org/InStock');
    expect(esquema(producto({availableForSale: false})).offers.availability).toBe(
      'https://schema.org/OutOfStock',
    );
  });

  it('no inventa una oferta cuando el producto no tiene precio', () => {
    expect(esquema(producto({price: null})).offers).toBeUndefined();
    expect(esquema(producto({price: {amount: '0.0', currencyCode: 'MXN'}})).offers).toBeUndefined();
  });

  it('no declara clave si la variante no la trae', () => {
    expect('sku' in esquema(producto({sku: null}))).toBe(false);
  });
});
