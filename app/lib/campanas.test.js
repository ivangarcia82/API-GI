import {describe, it, expect} from 'vitest';
import {CAMPANAS, campanasActivas, enColorDeCampana, etiquetasDe} from './campanas';

describe('campañas en el home', () => {
  it('salen todas las que tienen portada, en el orden de la lista', () => {
    expect(campanasActivas().map((c) => c.handle)).toEqual([
      'octubre-rosa',
      'navidad',
      'ano-nuevo',
      'agendas-2027',
    ]);
  });

  it('una campaña sin portada no sale', () => {
    expect(CAMPANAS.find((c) => c.handle === 'dia-de-muertos').portada).toBeNull();
    expect(campanasActivas().map((c) => c.handle)).not.toContain('dia-de-muertos');
  });

  it('Año Nuevo junta la etiqueta del Excel y la del equipo', () => {
    expect(etiquetasDe(CAMPANAS.find((c) => c.handle === 'ano-nuevo'))).toEqual([
      'Campaña_AnoNuevo',
      'Campaña_Año Nuevo',
    ]);
  });

  it('cada campaña tiene su etiqueta Campaña_ y un handle único', () => {
    expect(new Set(CAMPANAS.map((c) => c.handle)).size).toBe(CAMPANAS.length);
    for (const c of CAMPANAS) {
      expect(c.tag).toMatch(/^Campaña_[A-Za-z0-9]+$/);
      // La etiqueta que pone el script siempre la junta la colección.
      expect(etiquetasDe(c)).toContain(c.tag);
    }
  });
});

describe('enColorDeCampana', () => {
  const mapa = {
    'octubre-rosa': {
      'dv-a2148': {
        sku: 'A2148.05',
        variantId: 'gid://shopify/ProductVariant/2',
        opciones: [{name: 'Color', value: 'ROSA'}],
        imagen: 'https://cdn/rosa.jpg',
      },
    },
  };
  const producto = {
    handle: 'dv-a2148',
    image: 'https://cdn/negro.jpg',
    firstVariantId: 'gid://shopify/ProductVariant/1',
    sku: 'A2148.01',
  };

  it('enseña la foto, la variante y el enlace del color de la campaña', () => {
    const p = enColorDeCampana('octubre-rosa', producto, mapa);
    expect(p.image).toBe('https://cdn/rosa.jpg');
    expect(p.firstVariantId).toBe('gid://shopify/ProductVariant/2');
    expect(p.sku).toBe('A2148.05');
    expect(p.url).toBe('/products/dv-a2148?Color=ROSA');
  });

  it('deja igual lo que no tiene color fijado', () => {
    expect(enColorDeCampana('octubre-rosa', {...producto, handle: 'otro'}, mapa)).toEqual({
      ...producto,
      handle: 'otro',
    });
    expect(enColorDeCampana('navidad', producto, mapa)).toBe(producto);
  });
});
