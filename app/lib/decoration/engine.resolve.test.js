import {describe, it, expect} from 'vitest';
import {
  getTechniques,
  resolveTechniqueKey,
  getMeasures,
  calcDecoration,
} from './engine.js';

describe('getTechniques delimiter', () => {
  it('splits the real comma-separated store value', () => {
    expect(
      getTechniques('Tampografía, Serigrafía, Grabado en láser, Impresión Digital, DTF UV'),
    ).toEqual(['Tampografía', 'Serigrafía', 'Grabado en láser', 'Impresión Digital', 'DTF UV']);
  });
  it('falls back to dash when there is no comma (legacy)', () => {
    expect(getTechniques('SERIGRAFÍA-BORDADO')).toEqual(['SERIGRAFÍA', 'BORDADO']);
  });
  it('parses a JSON-array string (list metafield)', () => {
    expect(getTechniques('["SERIGRAFÍA","BORDADO"]')).toEqual(['SERIGRAFÍA', 'BORDADO']);
  });
});

describe('resolveTechniqueKey', () => {
  it('matches differently-cased labels (Serigrafía -> SERIGRAFÍA)', () => {
    expect(resolveTechniqueKey('Serigrafía')).toBe('SERIGRAFÍA');
  });
  it('maps reworded labels via alias (Grabado en láser -> GRABADO LÁSER)', () => {
    expect(resolveTechniqueKey('Grabado en láser')).toBe('GRABADO LÁSER');
  });
  it('returns null for techniques with no pricing entry', () => {
    expect(resolveTechniqueKey('Tampografía')).toBeNull();
    expect(resolveTechniqueKey('Impresión Digital')).toBeNull();
  });
});

describe('engine consumes resolved technique', () => {
  it('getMeasures works with a store-cased technique', () => {
    expect(getMeasures('Serigrafía', 'TEXTIL').length).toBeGreaterThan(0);
  });
  it('calcDecoration prices a store-cased technique', () => {
    const r = calcDecoration('Serigrafía', 'TEXTIL', 300, '4 x 4');
    expect(r.error).toBeNull();
    expect(r.totalPrice).toBeCloseTo((300 * 3.33) / 0.67, 4);
  });
});
