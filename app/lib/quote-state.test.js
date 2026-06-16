import {describe, it, expect} from 'vitest';
import {mergeQuoteState, quotePieceCount} from './quote-state.js';

const item = (over = {}) => ({
  id: 'i1',
  variantId: 'gid://v1',
  productHandle: 'tote',
  title: 'Tote',
  qty: 10,
  baseUnitPrice: 25,
  technique: 'Sin decorado',
  surface: '',
  size: '',
  decorationTotal: 0,
  effectiveUnitPrice: 25,
  ...over,
});

describe('mergeQuoteState', () => {
  it('replaces client list with the authoritative server items', () => {
    const prev = [item({id: 'i1', qty: 5, effectiveUnitPrice: 999})];
    const server = {id: 'q1', status: 'draft', items: [item({id: 'i1', qty: 10, effectiveUnitPrice: 25})]};
    const next = mergeQuoteState(prev, server);
    expect(next).toHaveLength(1);
    expect(next[0].qty).toBe(10);
    expect(next[0].effectiveUnitPrice).toBe(25); // server price wins, never client
  });

  it('returns an empty array when the server draft has no items', () => {
    expect(mergeQuoteState([item()], {id: 'q1', status: 'draft', items: []})).toEqual([]);
  });

  it('returns an empty array when the server quote is null (no draft yet)', () => {
    expect(mergeQuoteState([item()], null)).toEqual([]);
  });

  it('ignores a malformed server response and keeps prev (defensive on optimistic failure)', () => {
    const prev = [item({id: 'i1'})];
    expect(mergeQuoteState(prev, undefined)).toBe(prev);
    expect(mergeQuoteState(prev, {id: 'q1'})).toBe(prev); // no items array
  });

  it('keys strictly by server id, dropping client-only optimistic rows', () => {
    const prev = [item({id: 'temp-optimistic'}), item({id: 'i1'})];
    const server = {id: 'q1', status: 'draft', items: [item({id: 'i1', qty: 7})]};
    const next = mergeQuoteState(prev, server);
    expect(next.map((i) => i.id)).toEqual(['i1']);
    expect(next[0].qty).toBe(7);
  });
});

describe('quotePieceCount', () => {
  it('sums qty across items', () => {
    expect(quotePieceCount([item({qty: 3}), item({id: 'i2', qty: 4})])).toBe(7);
  });
  it('returns 0 for empty', () => {
    expect(quotePieceCount([])).toBe(0);
  });
  it('treats missing/NaN qty as 0', () => {
    expect(quotePieceCount([item({qty: undefined}), item({id: 'i2', qty: 5})])).toBe(5);
  });
});
