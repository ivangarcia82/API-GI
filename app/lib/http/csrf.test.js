import {describe, it, expect} from 'vitest';
import {assertSameOrigin} from './csrf.js';

function makeRequest({origin, referer} = {}) {
  const headers = {};
  if (origin !== undefined) headers.Origin = origin;
  if (referer !== undefined) headers.Referer = referer;
  return new Request('https://shop.example.com/auth/login', {
    method: 'POST',
    headers,
  });
}

describe('assertSameOrigin', () => {
  it('passes when Origin matches the request origin', () => {
    expect(() => assertSameOrigin(makeRequest({origin: 'https://shop.example.com'}))).not.toThrow();
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(() =>
      assertSameOrigin(makeRequest({referer: 'https://shop.example.com/login'})),
    ).not.toThrow();
  });

  it('throws 403 when Origin is cross-site', async () => {
    let thrown;
    try {
      assertSameOrigin(makeRequest({origin: 'https://evil.example.com'}));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(403);
  });

  it('default-denies when neither Origin nor Referer is present', () => {
    let thrown;
    try {
      assertSameOrigin(makeRequest({}));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(403);
  });
});
