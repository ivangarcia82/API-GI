import {describe, it, expect} from 'vitest';
import {PRICE_MATRIX, getTechniques, getMeasures} from './engine.js';

describe('PRICE_MATRIX parity with scripthhglobal.liquid', () => {
  it('has exactly the 9 technique keys with identical accents/casing', () => {
    expect(Object.keys(PRICE_MATRIX)).toEqual([
      'SERIGRAFÍA',
      'BORDADO',
      'PARCHE SUBLIMADO',
      'VINIL IMPRIMIBLE Y DTF',
      'IMPRESIÓN UV PLANA FULL COLOR',
      'IMPRESIÓN 360° FULL COLOR',
      'SUBLIMACION',
      'GRABADO LÁSER',
      'GOTA DE RESINA',
    ]);
  });

  it('SERIGRAFÍA surfaces and an exact row match the Liquid', () => {
    expect(Object.keys(PRICE_MATRIX['SERIGRAFÍA'])).toEqual([
      'ACERO / METAL / MADERA / PLÁSTICO',
      'TEXTIL',
      'RUBBER / VIDRIO',
      'TRANSFER',
    ]);
    expect(PRICE_MATRIX['SERIGRAFÍA']['TEXTIL']).toEqual([
      {medida: '4 x 4', precioMinimo: 3.33, precioMaximo: 1641.8, cantidadMinima: 300},
      {medida: '10 x 10', precioMinimo: 3.33, precioMaximo: 1641.8, cantidadMinima: 300},
      {medida: '18 x 18', precioMinimo: 3.33, precioMaximo: 1641.8, cantidadMinima: 300},
    ]);
  });

  it('preserves the mixed-case "10 X 10" key under SERIGRAFÍA/ACERO', () => {
    const rows = PRICE_MATRIX['SERIGRAFÍA']['ACERO / METAL / MADERA / PLÁSTICO'];
    expect(rows.map((r) => r.medida)).toEqual(['4 x 4', '10 X 10', '15 x 15']);
  });

  it('GRABADO LÁSER "14 x 21" row matches the Liquid exactly', () => {
    const rows = PRICE_MATRIX['GRABADO LÁSER']['MADERA / METAL / VIDRIO'];
    expect(rows[5]).toEqual({medida: '14 x 21', precioMinimo: 20, precioMaximo: 20.85, cantidadMinima: 1});
  });
});

describe('getTechniques', () => {
  it('parses a dash-delimited single_line_text_field', () => {
    expect(getTechniques('SERIGRAFÍA-BORDADO-SUBLIMACION')).toEqual([
      'SERIGRAFÍA',
      'BORDADO',
      'SUBLIMACION',
    ]);
  });

  it('parses a JSON-array string from list.single_line_text_field', () => {
    expect(getTechniques('["SERIGRAFÍA", "BORDADO"]')).toEqual(['SERIGRAFÍA', 'BORDADO']);
  });

  it('trims and drops empty entries', () => {
    expect(getTechniques(' SERIGRAFÍA - - BORDADO ')).toEqual(['SERIGRAFÍA', 'BORDADO']);
  });

  it('returns [] for null/empty', () => {
    expect(getTechniques(null)).toEqual([]);
    expect(getTechniques('')).toEqual([]);
    expect(getTechniques(undefined)).toEqual([]);
  });

  it('falls back to dash split when JSON is malformed', () => {
    expect(getTechniques('[SERIGRAFÍA-BORDADO')).toEqual(['[SERIGRAFÍA', 'BORDADO']);
  });
});

describe('getMeasures', () => {
  it('returns measures for an exact surface membership (uppercased)', () => {
    expect(getMeasures('SERIGRAFÍA', 'textil')).toEqual(['4 x 4', '10 x 10', '18 x 18']);
  });

  it('matches a multi-surface key by exact membership, not substring', () => {
    expect(getMeasures('SERIGRAFÍA', 'metal')).toEqual(['4 x 4', '10 X 10', '15 x 15']);
  });

  it('returns [] for an unknown technique', () => {
    expect(getMeasures('NOPE', 'textil')).toEqual([]);
  });

  it('falls back to the most expensive group for an unknown surface', () => {
    // 'papel' matches no SERIGRAFÍA group ⇒ fall back to RUBBER / VIDRIO.
    expect(getMeasures('SERIGRAFÍA', 'papel')).toEqual(['4 x 4', '10 x 10', '18 x 18']);
  });
});
