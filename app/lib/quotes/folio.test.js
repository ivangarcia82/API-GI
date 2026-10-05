import {describe, it, expect, beforeEach} from 'vitest';
import {createClient} from '@libsql/client';
import {migrate} from '../db/migrate.js';
import {folioVisible, formatFolio, nextFolio} from './folio.js';

describe('formatFolio', () => {
  it('arma el folio con la serie web y tres dígitos', () => {
    expect(formatFolio(1)).toBe('GIP.Web.Cotización_001');
    expect(formatFolio(42)).toBe('GIP.Web.Cotización_042');
  });

  it('no trunca cuando el consecutivo pasa de tres dígitos', () => {
    // Preferible un folio más largo a dos cotizaciones con el mismo.
    expect(formatFolio(1000)).toBe('GIP.Web.Cotización_1000');
  });
});

describe('nextFolio', () => {
  let db;
  beforeEach(async () => {
    db = createClient({url: ':memory:'});
    await migrate(db);
  });

  it('empieza en 001 y avanza de uno en uno', async () => {
    expect(await nextFolio(db)).toBe('GIP.Web.Cotización_001');
    expect(await nextFolio(db)).toBe('GIP.Web.Cotización_002');
    expect(await nextFolio(db)).toBe('GIP.Web.Cotización_003');
  });

  it('es un solo consecutivo: no reinicia con el año', async () => {
    await nextFolio(db);
    await nextFolio(db);
    expect(await nextFolio(db)).toBe('GIP.Web.Cotización_003');
  });

  it('no arrastra la cuenta de la serie anterior', async () => {
    // Las cotizaciones viejas (GIV.CDMX.2026…) tienen su propio contador.
    await db.execute({
      sql: `INSERT INTO folio_counters (serie, year, last) VALUES ('GIV.CDMX.', 2026, 57)`,
      args: [],
    });
    expect(await nextFolio(db)).toBe('GIP.Web.Cotización_001');
  });

  it('nunca entrega el mismo número a dos llamadas concurrentes', async () => {
    const folios = await Promise.all(Array.from({length: 25}, () => nextFolio(db)));
    expect(new Set(folios).size).toBe(25);
  });
});

describe('folioVisible', () => {
  it('muestra el folio cuando lo hay', () => {
    expect(folioVisible({id: 'uuid-largo', folio: 'GIV.CDMX.20260007'})).toBe(
      'GIV.CDMX.20260007',
    );
  });

  it('cae al id en cotizaciones anteriores al folio', () => {
    // No se numeran hacia atrás: ya circularon con su uuid.
    expect(folioVisible({id: 'uuid-viejo', folio: null})).toBe('uuid-viejo');
    expect(folioVisible({id: 'uuid-viejo'})).toBe('uuid-viejo');
  });

  it('ignora un folio en blanco', () => {
    expect(folioVisible({id: 'uuid-viejo', folio: '   '})).toBe('uuid-viejo');
  });

  it('devuelve cadena vacía sin cotización', () => {
    expect(folioVisible(null)).toBe('');
    expect(folioVisible({})).toBe('');
  });
});
