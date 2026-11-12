/* Decisión del negocio (12-nov-2026): los buscadores y los asistentes de IA
   no deben leer precios en los datos estructurados. La ficha declara qué
   producto es y su clave; el precio se consulta en la página o al cotizar. */
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

  it('no declara oferta: sin precio no hay oferta válida que publicar', () => {
    expect('offers' in esquema(producto())).toBe(false);
  });

  it('no deja el precio en ninguna parte del bloque', () => {
    const texto = JSON.stringify(esquema(producto()));
    expect(texto).not.toMatch(/price/i);
    expect(texto).not.toContain('133');
  });

  it('no declara clave si la variante no la trae', () => {
    expect('sku' in esquema(producto({sku: null}))).toBe(false);
  });
});
