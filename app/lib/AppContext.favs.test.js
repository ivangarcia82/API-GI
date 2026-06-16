import {describe, it, expect} from 'vitest';
import {reconcileFavs} from './AppContext.jsx';

describe('reconcileFavs', () => {
  it('returns the server list verbatim when provided an array', () => {
    expect(reconcileFavs(['a', 'b'], ['a'])).toEqual(['a', 'b']);
  });

  it('falls back to the optimistic list when server list is missing', () => {
    expect(reconcileFavs(undefined, ['a', 'b'])).toEqual(['a', 'b']);
    expect(reconcileFavs(null, ['x'])).toEqual(['x']);
  });

  it('falls back to the optimistic list when server value is not an array', () => {
    expect(reconcileFavs('nope', ['a'])).toEqual(['a']);
  });

  it('returns an empty array when the server clears the list', () => {
    expect(reconcileFavs([], ['a', 'b'])).toEqual([]);
  });
});
