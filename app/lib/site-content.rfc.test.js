import {describe, it, expect} from 'vitest';
import {BRAND} from './site-content.js';

describe('BRAND · datos fiscales', () => {
  it('el RFC tiene el formato de persona moral: 3 letras, fecha y homoclave', () => {
    // 12 caracteres. Un typo aquí sale impreso en cada cotización.
    expect(BRAND.rfc).toMatch(/^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$/);
    expect(BRAND.rfc).toHaveLength(12);
  });

  it('la fecha del RFC es real', () => {
    const [, yy, mm, dd] = BRAND.rfc.match(/^[A-ZÑ&]{3}(\d{2})(\d{2})(\d{2})/);
    expect(Number(mm)).toBeGreaterThanOrEqual(1);
    expect(Number(mm)).toBeLessThanOrEqual(12);
    expect(Number(dd)).toBeGreaterThanOrEqual(1);
    expect(Number(dd)).toBeLessThanOrEqual(31);
    expect(Number(yy)).toBeGreaterThan(0);
  });
});
