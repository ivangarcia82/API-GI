import {describe, it, expect} from 'vitest';
import {CAMPANAS, campanasActivas, enVentana, mesDia, enColorDeCampana, etiquetasDe} from './campanas';

// Mediodía en México: sin ambigüedad de zona horaria.
const dia = (iso) => new Date(`${iso}T18:00:00Z`);

describe('ventanas de temporada', () => {
  it('usa la fecha de México, no la UTC del servidor', () => {
    // 1 de nov 03:00 UTC = 31 de oct 21:00 en Ciudad de México.
    expect(mesDia(new Date('2026-11-01T03:00:00Z'))).toBe('10-31');
  });

  it('una ventana que cruza el año vale en diciembre y en enero', () => {
    const v = {desde: '12-26', hasta: '01-15'};
    expect(enVentana(v, '12-31')).toBe(true);
    expect(enVentana(v, '01-10')).toBe(true);
    expect(enVentana(v, '06-01')).toBe(false);
  });

  it('a principios de octubre el home anuncia Octubre Rosa', () => {
    expect(campanasActivas(dia('2026-10-06')).map((c) => c.handle)).toEqual(['octubre-rosa']);
  });

  it('a finales de octubre se suma Agendas 2027', () => {
    expect(campanasActivas(dia('2026-10-26')).map((c) => c.handle)).toEqual(['octubre-rosa', 'agendas-2027']);
  });

  it('en diciembre: Navidad y luego Año Nuevo, con las agendas todo el tiempo', () => {
    expect(campanasActivas(dia('2026-12-10')).map((c) => c.handle)).toEqual(['navidad', 'agendas-2027']);
    expect(campanasActivas(dia('2026-12-31')).map((c) => c.handle)).toEqual(['ano-nuevo', 'agendas-2027']);
  });

  it('una campaña sin portada no sale en el home aunque sea su temporada', () => {
    expect(CAMPANAS.find((c) => c.handle === 'dia-de-muertos').portada).toBeNull();
    expect(campanasActivas(dia('2026-11-01')).map((c) => c.handle)).not.toContain('dia-de-muertos');
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
