import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';

describe('panel de login', () => {
  it('no contiene el testimonio fabricado', () => {
    const src = readFileSync('app/routes/login.jsx', 'utf8');
    expect(src).not.toMatch(/MARIANA RUIZ/i);
    expect(src).not.toMatch(/BANORTE/i);
  });

  it('no quedan datos demo de REVIEWS en gi.js', () => {
    const src = readFileSync('app/lib/gi.js', 'utf8');
    expect(src).not.toMatch(/export const REVIEWS/);
  });
});
