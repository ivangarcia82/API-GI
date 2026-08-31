import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {formatFolio, nextFolio} from './folio.js';

describe('formatFolio', () => {
  it('arma el folio con la serie fija, el año y cuatro dígitos', () => {
    expect(formatFolio({year: 2026, n: 1})).toBe('GIV.CDMX.20260001');
    expect(formatFolio({year: 2026, n: 42})).toBe('GIV.CDMX.20260042');
    expect(formatFolio({year: 2027, n: 1})).toBe('GIV.CDMX.20270001');
  });

  it('no trunca cuando el consecutivo pasa de cuatro dígitos', () => {
    // Preferible un folio de cinco dígitos a dos cotizaciones con el mismo.
    expect(formatFolio({year: 2026, n: 12345})).toBe('GIV.CDMX.202612345');
  });
});

describe('nextFolio', () => {
  let db;
  beforeEach(async () => {
    db = createClient({url: ':memory:'});
    await migrate(db);
  });

  it('empieza en 0001 y avanza de uno en uno', async () => {
    expect(await nextFolio(db, {year: 2026})).toBe('GIV.CDMX.20260001');
    expect(await nextFolio(db, {year: 2026})).toBe('GIV.CDMX.20260002');
    expect(await nextFolio(db, {year: 2026})).toBe('GIV.CDMX.20260003');
  });

  it('reinicia el conteo en cada año', async () => {
    await nextFolio(db, {year: 2026});
    await nextFolio(db, {year: 2026});
    expect(await nextFolio(db, {year: 2027})).toBe('GIV.CDMX.20270001');
    // El año viejo sigue su propia cuenta, sin contaminarse.
    expect(await nextFolio(db, {year: 2026})).toBe('GIV.CDMX.20260003');
  });

  it('nunca entrega el mismo número a dos llamadas concurrentes', async () => {
    const folios = await Promise.all(
      Array.from({length: 25}, () => nextFolio(db, {year: 2026})),
    );
    expect(new Set(folios).size).toBe(25);
  });

  it('usa el año en curso cuando no se le indica uno', async () => {
    const folio = await nextFolio(db);
    expect(folio).toContain(String(new Date().getFullYear()));
  });
});
