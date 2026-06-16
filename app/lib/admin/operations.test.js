import {describe, it, expect, vi, beforeEach} from 'vitest';

const adminFetch = vi.fn();
const isStubMode = vi.fn(() => true);
vi.mock('./client.js', () => ({
  adminFetch: (...args) => adminFetch(...args),
  isStubMode: (...args) => isStubMode(...args),
}));

import {
  createCustomer,
  createDraftOrder,
  getCustomerAdvisor,
} from './operations.js';

beforeEach(() => {
  adminFetch.mockReset();
  isStubMode.mockReset();
  isStubMode.mockReturnValue(true);
});

describe('createCustomer', () => {
  it('returns the created gid on success', async () => {
    adminFetch.mockResolvedValueOnce({
      customerCreate: {
        customer: {id: 'gid://shopify/Customer/123'},
        userErrors: [],
      },
    });
    const out = await createCustomer(
      {PRIVATE_ADMIN_API_TOKEN: 't'},
      {email: 'a@b.com', firstName: 'A', lastName: 'B'},
    );
    expect(out).toEqual({gid: 'gid://shopify/Customer/123'});
    expect(adminFetch).toHaveBeenCalledTimes(1);
    const [, , vars] = adminFetch.mock.calls[0];
    expect(vars.input.email).toBe('a@b.com');
    expect(vars.input.firstName).toBe('A');
    expect(vars.input.lastName).toBe('B');
  });

  it('reuses the existing gid on TAKEN userError (idempotent)', async () => {
    adminFetch
      .mockResolvedValueOnce({
        customerCreate: {
          customer: null,
          userErrors: [
            {field: ['email'], message: 'Email has already been taken'},
          ],
        },
      })
      .mockResolvedValueOnce({
        customers: {
          edges: [{node: {id: 'gid://shopify/Customer/999'}}],
        },
      });
    const out = await createCustomer(
      {PRIVATE_ADMIN_API_TOKEN: 't'},
      {email: 'dup@b.com'},
    );
    expect(out).toEqual({gid: 'gid://shopify/Customer/999'});
    expect(adminFetch).toHaveBeenCalledTimes(2);
    const [, , lookupVars] = adminFetch.mock.calls[1];
    expect(lookupVars.q).toBe("email:'dup@b.com'");
  });

  it('throws on a non-TAKEN userError', async () => {
    adminFetch.mockResolvedValueOnce({
      customerCreate: {
        customer: null,
        userErrors: [{field: ['email'], message: 'Email is invalid'}],
      },
    });
    await expect(
      createCustomer({PRIVATE_ADMIN_API_TOKEN: 't'}, {email: 'bad'}),
    ).rejects.toThrow(/invalid/i);
  });

  it('omits null name fields from the input', async () => {
    adminFetch.mockResolvedValueOnce({
      customerCreate: {
        customer: {id: 'gid://shopify/Customer/1'},
        userErrors: [],
      },
    });
    await createCustomer({PRIVATE_ADMIN_API_TOKEN: 't'}, {email: 'x@y.com'});
    const [, , vars] = adminFetch.mock.calls[0];
    expect(vars.input).toEqual({email: 'x@y.com'});
  });
});

describe('createDraftOrder', () => {
  it('passes the shaped input through and returns gid + invoiceUrl', async () => {
    adminFetch.mockResolvedValueOnce({
      draftOrderCreate: {
        draftOrder: {
          id: 'gid://shopify/DraftOrder/77',
          invoiceUrl: 'https://shop/invoice/77',
        },
        userErrors: [],
      },
    });
    const input = {
      purchasingEntity: {customerId: 'gid://shopify/Customer/123'},
      email: 'a@b.com',
      presentmentCurrencyCode: 'MXN',
      note: 'hi',
      lineItems: [
        {
          title: 'Mug — SERIGRAFIA 4 x 4',
          quantity: 300,
          originalUnitPriceWithCurrency: {amount: '4.97', currencyCode: 'MXN'},
          customAttributes: [{key: 'Decorado', value: 'SERIGRAFIA - 4 x 4'}],
        },
      ],
    };
    const out = await createDraftOrder({PRIVATE_ADMIN_API_TOKEN: 't'}, input);
    expect(out).toEqual({
      gid: 'gid://shopify/DraftOrder/77',
      invoiceUrl: 'https://shop/invoice/77',
    });
    const [, query, vars] = adminFetch.mock.calls[0];
    expect(query).toContain('draftOrderCreate');
    expect(query).toContain('invoiceUrl');
    expect(vars.input).toBe(input);
  });

  it('throws on draft order userErrors', async () => {
    adminFetch.mockResolvedValueOnce({
      draftOrderCreate: {
        draftOrder: null,
        userErrors: [{field: ['email'], message: 'bad email'}],
      },
    });
    await expect(
      createDraftOrder({PRIVATE_ADMIN_API_TOKEN: 't'}, {lineItems: []}),
    ).rejects.toThrow(/bad email/);
  });
});

const GID = 'gid://shopify/Customer/123';

function metaobjectResponse(fields) {
  return {
    customer: {
      metafield: {
        reference: {
          type: 'ejecutiva_de_venta',
          fields,
        },
      },
    },
  };
}

describe('getCustomerAdvisor', () => {
  it('flattens metaobject fields and extracts the correo email', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue(
      metaobjectResponse([
        {key: 'nombre', value: 'María López'},
        {key: 'correo', value: 'maria@generandoideas.com'},
        {key: 'telefono', value: '55 1234 5678'},
      ]),
    );

    const advisor = await getCustomerAdvisor({}, GID);

    expect(advisor.email).toBe('maria@generandoideas.com');
    expect(advisor.fields).toEqual({
      nombre: 'María López',
      correo: 'maria@generandoideas.com',
      telefono: '55 1234 5678',
    });
    // The Admin query was sent with the customer gid.
    expect(adminFetch).toHaveBeenCalledWith({}, expect.any(String), {gid: GID});
  });

  it('returns a null-safe shape when the metafield is absent', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({customer: {metafield: null}});

    const advisor = await getCustomerAdvisor({}, GID);

    expect(advisor).toEqual({email: null, fields: {}});
  });

  it('returns a null-safe shape when the customer is null', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({customer: null});

    const advisor = await getCustomerAdvisor({}, GID);

    expect(advisor).toEqual({email: null, fields: {}});
  });

  it('returns email:null when the reference has no correo field', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue(
      metaobjectResponse([{key: 'nombre', value: 'Sin correo'}]),
    );

    const advisor = await getCustomerAdvisor({}, GID);

    expect(advisor.email).toBeNull();
    expect(advisor.fields.nombre).toBe('Sin correo');
  });

  it('returns a deterministic advisor in stub mode without calling adminFetch', async () => {
    isStubMode.mockReturnValue(true);

    const advisor = await getCustomerAdvisor({}, GID);

    expect(advisor.email).toBe('asesor-stub@example.com');
    expect(advisor.fields.correo).toBe('asesor-stub@example.com');
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('returns a null-safe shape when customerGid is missing', async () => {
    isStubMode.mockReturnValue(false);

    const advisor = await getCustomerAdvisor({}, null);

    expect(advisor).toEqual({email: null, fields: {}});
    expect(adminFetch).not.toHaveBeenCalled();
  });
});
