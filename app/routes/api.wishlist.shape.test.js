import {describe, it, expect} from 'vitest';
import * as route from './api.wishlist.jsx';

describe('api.wishlist route module shape', () => {
  it('exports an action function', () => {
    expect(typeof route.action).toBe('function');
  });
  it('exports a loader function', () => {
    expect(typeof route.loader).toBe('function');
  });
  it('does not export a default component (resource route)', () => {
    expect(route.default).toBeUndefined();
  });
});
