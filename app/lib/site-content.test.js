import {describe, it, expect} from 'vitest';
import * as C from './site-content';

describe('site-content', () => {
  it('exposes marketing collections with expected sizes', () => {
    expect(C.SERVICES).toHaveLength(5);
    expect(C.SERVICE_DETAIL_IDS).toEqual([
      'promo', 'print-shop', 'promotional-workshop', 'digital-evolution', 'importaciones',
    ]);
    expect(C.BLOG_POSTS.length).toBeGreaterThanOrEqual(6);
    expect(C.JOBS).toHaveLength(6);
    expect(C.OFFICES.map((o) => o.id)).toEqual(['cdmx', 'sonora', 'yucatan']);
    expect(C.NAV_ITEMS.map((n) => n.href)).toEqual([
      '/', '/conocenos', '/servicios', '/catalogo', '/blog', '/contacto',
    ]);
  });

  it('every SERVICE has a matching SERVICE_DETAILS entry', () => {
    for (const s of C.SERVICES) expect(C.SERVICE_DETAILS[s.id]).toBeTruthy();
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
