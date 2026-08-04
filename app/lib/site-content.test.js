import {describe, it, expect} from 'vitest';
import * as C from './site-content';

describe('site-content', () => {
  it('exposes marketing collections with expected sizes', () => {
    expect(C.SERVICES).toHaveLength(5);
    expect(C.SERVICE_DETAIL_IDS).toEqual([
      'promo', 'print-shop', 'promotional-workshop', 'digital-evolution', 'importaciones',
    ]);
    expect(C.BLOG_POSTS.length).toBeGreaterThanOrEqual(6);
    expect(C.JOBS).toHaveLength(5);
    expect(C.OFFICES.map((o) => o.id)).toEqual(['cdmx', 'sonora', 'yucatan']);
    expect(C.NAV_ITEMS.map((n) => n.href)).toEqual([
      '/', '/conocenos', '/servicios', '/catalogo', '/blog', '/contacto',
    ]);
  });

  it('every SERVICE has a matching SERVICE_DETAILS entry', () => {
    for (const s of C.SERVICES) expect(C.SERVICE_DETAILS[s.id]).toBeTruthy();
  });

  it('every JOB is complete and usable as a page', () => {
    for (const j of C.JOBS) {
      expect(typeof j.id).toBe('number');
      for (const campo of ['title', 'dept', 'location', 'type', 'salary']) {
        expect(j[campo], `${j.title} → ${campo}`).toBeTruthy();
      }
      for (const lista of ['offer', 'requirements', 'responsibilities']) {
        expect(j[lista].length, `${j.title} → ${lista}`).toBeGreaterThan(0);
      }
    }
  });

  it('no JOB id is reused', () => {
    // El id es la URL (/bolsa-de-trabajo/:id). Si al rotar vacantes se
    // reasigna un id ya usado, quien tenga el enlace guardado abre una vacante
    // distinta en vez de caer en el listado.
    const ids = C.JOBS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
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
