import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest';
import {isStubMode, adminFetch} from './client.js';

describe('isStubMode', () => {
  it('returns true when no admin token', () => {
    expect(isStubMode({})).toBe(true);
    expect(isStubMode({PRIVATE_ADMIN_API_TOKEN: ''})).toBe(true);
  });

  it('returns false when admin token present', () => {
    expect(isStubMode({PRIVATE_ADMIN_API_TOKEN: 'shpat_x'})).toBe(false);
  });

  it('throws in production without a token', () => {
    expect(() => isStubMode({ENVIRONMENT: 'production'})).toThrow(
      /production/i,
    );
  });

  it('does not throw in production with a token', () => {
    expect(
      isStubMode({ENVIRONMENT: 'production', PRIVATE_ADMIN_API_TOKEN: 't'}),
    ).toBe(false);
  });
});

describe('adminFetch stub mode', () => {
  let logSpy;
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs loudly and returns deterministic customerCreate stub', async () => {
    const data = await adminFetch(
      {},
      'mutation customerCreate($input: CustomerInput!) { customerCreate(input: $input) { customer { id } userErrors { field message } } }',
      {input: {email: 'a@b.com'}},
    );
    expect(logSpy).toHaveBeenCalled();
    expect(data.customerCreate.userErrors).toEqual([]);
    expect(data.customerCreate.customer.id).toMatch(
      /^gid:\/\/shopify\/Customer\/STUB-/,
    );
  });

  it('returns deterministic customers query stub (empty)', async () => {
    const data = await adminFetch(
      {},
      'query customers($q: String!) { customers(first: 1, query: $q) { edges { node { id } } } }',
      {q: 'email:a@b.com'},
    );
    expect(data.customers.edges).toEqual([]);
  });

  it('returns deterministic draftOrderCreate stub', async () => {
    const data = await adminFetch(
      {},
      'mutation draftOrderCreate($input: DraftOrderInput!) { draftOrderCreate(input: $input) { draftOrder { id invoiceUrl } userErrors { field message } } }',
      {input: {}},
    );
    expect(data.draftOrderCreate.userErrors).toEqual([]);
    expect(data.draftOrderCreate.draftOrder.id).toMatch(
      /^gid:\/\/shopify\/DraftOrder\/STUB-/,
    );
    expect(data.draftOrderCreate.draftOrder.invoiceUrl).toMatch(/^stub:\/\//);
  });
});

describe('adminFetch real mode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs to the admin endpoint with the access-token header', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({data: {ok: true}}), {
        status: 200,
        headers: {'content-type': 'application/json'},
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const env = {
      PRIVATE_ADMIN_API_TOKEN: 'shpat_x',
      PUBLIC_STORE_DOMAIN: 'demo.myshopify.com',
    };
    const data = await adminFetch(env, 'query { shop { name } }', {});
    expect(data).toEqual({ok: true});
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://demo.myshopify.com/admin/api/2026-04/graphql.json',
    );
    expect(init.method).toBe('POST');
    expect(init.headers['X-Shopify-Access-Token']).toBe('shpat_x');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      query: 'query { shop { name } }',
      variables: {},
    });
  });

  it('uses the configured API version', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({data: {}}), {status: 200}),
    );
    vi.stubGlobal('fetch', fetchMock);
    await adminFetch(
      {
        PRIVATE_ADMIN_API_TOKEN: 't',
        PUBLIC_STORE_DOMAIN: 'demo.myshopify.com',
        SHOPIFY_ADMIN_API_VERSION: '2025-10',
      },
      'query { shop { id } }',
      {},
    );
    expect(fetchMock.mock.calls[0][0]).toContain('/admin/api/2025-10/');
  });

  it('throws on graphql errors', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({errors: [{message: 'boom'}]}),
        {status: 200},
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      adminFetch(
        {PRIVATE_ADMIN_API_TOKEN: 't', PUBLIC_STORE_DOMAIN: 'd.myshopify.com'},
        'query { shop { id } }',
        {},
      ),
    ).rejects.toThrow(/boom/);
  });
});
