import {describe, it, expect} from 'vitest';
import * as C from './site-content';

describe('site-content', () => {
  it('exposes marketing collections with expected sizes', () => {
    expect(C.SERVICES).toHaveLength(5);
    expect(C.SERVICE_DETAIL_IDS).toEqual([
      'promo', 'print-shop', 'promotional-workshop', 'digital-evolution', 'importaciones',
    ]);
    // Los artículos del blog viven en ~/lib/blog (blog.test.js).
    expect(C.BLOG_POSTS).toBeUndefined();
    expect(C.OFFICES.map((o) => o.id)).toEqual(['cdmx', 'sonora', 'yucatan']);
    expect(C.NAV_ITEMS.map((n) => n.href)).toEqual([
      '/', '/conocenos', '/servicios', '/catalogo', '/blog', '/contacto',
    ]);
  });

  /* Decisión del negocio (26-nov-2026): sólo se publica la dirección de la
     sucursal de CDMX. Las otras dos se nombran, sin dirección. */
  it('sólo la sucursal de CDMX lleva dirección', () => {
    const conDireccion = C.OFFICES.filter((o) => o.address).map((o) => o.id);
    expect(conDireccion).toEqual(['cdmx']);
    expect(JSON.stringify(C.OFFICES)).not.toMatch(/Navarrete|Calle 60/);
  });

  it('every SERVICE has a matching SERVICE_DETAILS entry', () => {
    for (const s of C.SERVICES) expect(C.SERVICE_DETAILS[s.id]).toBeTruthy();
  });

  it('las vacantes sólo vienen del CMS', () => {
    expect(C.JOBS).toBeUndefined();
  });

  it('ROUTES.estore points to the internal Shopify catalog', () => {
    expect(C.ROUTES.estore).toBe('/catalogo');
    expect(C.ROUTES.service('promo')).toBe('/servicios/promo');
  });

  it('does not export dropped flipbook/product data', () => {
    expect(C.CATALOGS).toBeUndefined();
    expect(C.PRODUCTS).toBeUndefined();
  });
});
