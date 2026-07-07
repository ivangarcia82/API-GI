import {describe, it, expect} from 'vitest';
import {formatCount} from './format';

describe('formatCount', () => {
  it('groups thousands with en-US separators', () => {
    expect(formatCount({value: 2700})).toBe('2,700');
    expect(formatCount({value: 67000})).toBe('67,000');
  });
  it('applies prefix, suffix and decimals', () => {
    expect(formatCount({prefix: '+', value: 12})).toBe('+12');
    expect(formatCount({value: 4.9, decimals: 1})).toBe('4.9');
    expect(formatCount({value: 140, suffix: '+'})).toBe('140+');
  });
});
