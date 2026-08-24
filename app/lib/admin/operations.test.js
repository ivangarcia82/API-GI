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
  getVariantInventory,
  listAdvisors,
  resolveAdvisorGid,
  setCustomerAdvisor,
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
    expect(lookupVars.q).toBe('email:"dup@b.com"');
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
      customerGid: null,
    });
    const [, query, vars] = adminFetch.mock.calls[0];
    expect(query).toContain('draftOrderCreate');
    expect(query).toContain('invoiceUrl');
    expect(vars.input).toBe(input);
  });

  it('returns the customer gid Shopify linked to the draft (for advisor lookup)', async () => {
    adminFetch.mockResolvedValueOnce({
      draftOrderCreate: {
        draftOrder: {
          id: 'gid://shopify/DraftOrder/88',
          invoiceUrl: 'https://shop/invoice/88',
          customer: {id: 'gid://shopify/Customer/555'},
        },
        userErrors: [],
      },
    });
    const out = await createDraftOrder({PRIVATE_ADMIN_API_TOKEN: 't'}, {lineItems: []});
    expect(out.customerGid).toBe('gid://shopify/Customer/555');
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

describe('getVariantInventory', () => {
  it('returns null in stub mode without calling adminFetch', async () => {
    isStubMode.mockReturnValue(true);
    expect(await getVariantInventory({}, 'gid://shopify/ProductVariant/1')).toBeNull();
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('returns the inventoryQuantity from the Admin API', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({node: {inventoryQuantity: 42}});
    expect(await getVariantInventory({}, 'gid://shopify/ProductVariant/1')).toBe(42);
  });

  it('returns null for a missing variant id or on error (e.g. no read_inventory)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    isStubMode.mockReturnValue(false);
    expect(await getVariantInventory({}, null)).toBeNull();
    adminFetch.mockRejectedValue(new Error('Access denied for inventoryQuantity'));
    expect(await getVariantInventory({}, 'gid://shopify/ProductVariant/1')).toBeNull();
    warn.mockRestore();
  });
});

function advisorNode(handle, nombre, puesto, status = 'ACTIVE') {
  return {
    handle,
    displayName: nombre,
    capabilities: status === null ? null : {publishable: {status}},
    fields: [
      {key: 'nombre', value: nombre},
      {key: 'puesto', value: puesto},
      {key: 'correo', value: `${handle}@generandoideas.com`},
    ],
  };
}

describe('listAdvisors', () => {
  it('shapes active entries as {handle, nombre, puesto}', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {nodes: [advisorNode('laura-vega', 'Laura Vega', 'Inside Sales Executive')]},
    });

    const advisors = await listAdvisors({});

    expect(advisors).toEqual([
      {handle: 'laura-vega', nombre: 'Laura Vega', puesto: 'Inside Sales Executive'},
    ]);
  });

  it('excludes the marketing fallback entry from the pickable list', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {
        nodes: [
          advisorNode('marketing', 'Marketing', 'Marketing'),
          advisorNode('laura-vega', 'Laura Vega', 'Inside Sales Executive'),
        ],
      },
    });

    const advisors = await listAdvisors({});

    expect(advisors.map((a) => a.handle)).toEqual(['laura-vega']);
  });

  it('excludes DRAFT entries', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {
        nodes: [
          advisorNode('ariana-flores', 'Ariana Flores', 'Inside Sales Executive', 'DRAFT'),
          advisorNode('laura-vega', 'Laura Vega', 'Inside Sales Executive'),
        ],
      },
    });

    const advisors = await listAdvisors({});

    expect(advisors.map((a) => a.handle)).toEqual(['laura-vega']);
  });

  it('keeps entries whose publishable capability is absent', async () => {
    // Shopify only reports a status when the definition enables the
    // publishable capability. A missing status must not empty the whole select.
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {nodes: [advisorNode('laura-vega', 'Laura Vega', 'Inside Sales', null)]},
    });

    const advisors = await listAdvisors({});

    expect(advisors.map((a) => a.handle)).toEqual(['laura-vega']);
  });

  it('sorts by name so accented names land in the right place', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {
        nodes: [
          advisorNode('noe-sanchez', 'Noé Sánchez', 'Account Executive'),
          advisorNode('ailine-gamboa', 'Ailine Gamboa', 'Strategic Sales'),
          advisorNode('martin-rocha', 'Martín Rocha', 'Customer Success'),
        ],
      },
    });

    const advisors = await listAdvisors({});

    expect(advisors.map((a) => a.nombre)).toEqual([
      'Ailine Gamboa',
      'Martín Rocha',
      'Noé Sánchez',
    ]);
  });

  it('falls back to the display name when the nombre field is missing', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {
        nodes: [
          {
            handle: 'sin-campos',
            displayName: 'Sin Campos',
            capabilities: {publishable: {status: 'ACTIVE'}},
            fields: [],
          },
        ],
      },
    });

    const advisors = await listAdvisors({});

    expect(advisors).toEqual([{handle: 'sin-campos', nombre: 'Sin Campos', puesto: ''}]);
  });

  it('returns an empty list when the response has no metaobjects', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({});

    await expect(listAdvisors({})).resolves.toEqual([]);
  });

  it('returns a deterministic list in stub mode without calling adminFetch', async () => {
    isStubMode.mockReturnValue(true);

    const advisors = await listAdvisors({});

    expect(advisors.length).toBeGreaterThan(0);
    expect(advisors.every((a) => a.handle && a.nombre)).toBe(true);
    expect(advisors.some((a) => a.handle === 'marketing')).toBe(false);
    expect(adminFetch).not.toHaveBeenCalled();
  });
});

describe('resolveAdvisorGid', () => {
  it('resolves a handle to its metaobject gid', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjectByHandle: {id: 'gid://shopify/Metaobject/194049835311'},
    });

    const gid = await resolveAdvisorGid({}, 'marketing');

    expect(gid).toBe('gid://shopify/Metaobject/194049835311');
    const [, , vars] = adminFetch.mock.calls[0];
    expect(vars.handle).toEqual({type: 'ejecutiva_de_venta', handle: 'marketing'});
  });

  it('returns null for a handle that does not exist', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({metaobjectByHandle: null});

    await expect(resolveAdvisorGid({}, 'no-existe')).resolves.toBeNull();
  });

  it('returns null without querying when no handle is given', async () => {
    isStubMode.mockReturnValue(false);

    await expect(resolveAdvisorGid({}, '')).resolves.toBeNull();
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('returns a deterministic gid in stub mode without calling adminFetch', async () => {
    isStubMode.mockReturnValue(true);

    await expect(resolveAdvisorGid({}, 'marketing')).resolves.toMatch(
      /^gid:\/\/shopify\/Metaobject\/STUB-/,
    );
    expect(adminFetch).not.toHaveBeenCalled();
  });
});

describe('setCustomerAdvisor', () => {
  const ADVISOR_GID = 'gid://shopify/Metaobject/194049835311';

  it('writes the metaobject reference to custom.ejecutiva_de_venta', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({metafieldsSet: {metafields: [{id: 'x'}], userErrors: []}});

    await setCustomerAdvisor({}, GID, ADVISOR_GID);

    const [, , vars] = adminFetch.mock.calls[0];
    expect(vars.metafields).toEqual([
      {
        ownerId: GID,
        namespace: 'custom',
        key: 'ejecutiva_de_venta',
        type: 'metaobject_reference',
        value: ADVISOR_GID,
      },
    ]);
  });

  it('throws when Shopify reports userErrors', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metafieldsSet: {
        metafields: [],
        userErrors: [{field: ['value'], message: 'Value is invalid'}],
      },
    });

    await expect(setCustomerAdvisor({}, GID, ADVISOR_GID)).rejects.toThrow(/Value is invalid/);
  });

  it('does nothing when either gid is missing', async () => {
    isStubMode.mockReturnValue(false);

    await setCustomerAdvisor({}, GID, null);
    await setCustomerAdvisor({}, null, ADVISOR_GID);

    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('is a no-op in stub mode', async () => {
    isStubMode.mockReturnValue(true);

    await setCustomerAdvisor({}, GID, ADVISOR_GID);

    expect(adminFetch).not.toHaveBeenCalled();
  });
});
