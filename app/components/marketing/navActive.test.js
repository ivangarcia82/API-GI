import {describe, it, expect} from 'vitest';
import {isNavActive} from './MarketingLayout';

describe('isNavActive', () => {
  it('matches home and servicios only exactly', () => {
    expect(isNavActive('/', '/')).toBe(true);
    expect(isNavActive('/', '/conocenos')).toBe(false);
    expect(isNavActive('/servicios', '/servicios')).toBe(true);
    expect(isNavActive('/servicios', '/servicios/promo')).toBe(false);
  });
  it('matches other routes on prefix', () => {
    expect(isNavActive('/blog', '/blog')).toBe(true);
    expect(isNavActive('/blog', '/blog/tendencias-2026')).toBe(true);
    expect(isNavActive('/conocenos', '/conocenos')).toBe(true);
  });
  it('ignores trailing slashes', () => {
    expect(isNavActive('/blog', '/blog/')).toBe(true);
  });
});
