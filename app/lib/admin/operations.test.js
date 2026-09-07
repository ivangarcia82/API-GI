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
  getAdvisorByHandle,
  listAdvisors,
  resolveAdvisorGid,
  setCustomerAdvisor,
  addCustomerTags,
  setCustomerRequestedAdvisor,
  setDraftOrderAdvisor,
  getCustomerBrandColors,
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

    expect(advisor).toEqual({email: null, gid: null, handle: null, fields: {}});
  });

  it('returns a null-safe shape when the customer is null', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({customer: null});

    const advisor = await getCustomerAdvisor({}, GID);

    expect(advisor).toEqual({email: null, gid: null, handle: null, fields: {}});
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

    expect(advisor).toEqual({email: null, gid: null, handle: null, fields: {}});
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

function advisorNode(handle, nombre, puesto, status = 'ACTIVE', correo) {
  return {
    handle,
    displayName: nombre,
    capabilities: status === null ? null : {publishable: {status}},
    fields: [
      {key: 'nombre', value: nombre},
      {key: 'puesto', value: puesto},
      {key: 'correo', value: correo ?? `${handle}@generandoideas.com`},
    ],
  };
}

describe('listAdvisors', () => {
  it('shapes active entries as {handle, nombre, puesto, correo}', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {nodes: [advisorNode('laura-vega', 'Laura Vega', 'Inside Sales Executive')]},
    });

    const advisors = await listAdvisors({});

    expect(advisors).toEqual([
      {
        handle: 'laura-vega',
        nombre: 'Laura Vega',
        puesto: 'Inside Sales Executive',
        correo: 'laura-vega@generandoideas.com',
      },
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

    expect(advisors).toEqual([
      {handle: 'sin-campos', nombre: 'Sin Campos', puesto: '', correo: ''},
    ]);
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

describe('getAdvisorByHandle', () => {
  it('returns the advisor fields for a known handle', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjectByHandle: {
        id: 'gid://shopify/Metaobject/1',
        handle: 'ailine-gamboa',
        displayName: 'Ailine Gamboa',
        fields: [
          {key: 'nombre', value: 'Ailine Gamboa'},
          {key: 'puesto', value: 'Strategic Sales Jr. Executive'},
          {key: 'correo', value: 'agamboa@generandoideas.com'},
        ],
      },
    });

    const advisor = await getAdvisorByHandle({}, 'ailine-gamboa');

    expect(advisor).toEqual({
      gid: 'gid://shopify/Metaobject/1',
      handle: 'ailine-gamboa',
      nombre: 'Ailine Gamboa',
      puesto: 'Strategic Sales Jr. Executive',
      correo: 'agamboa@generandoideas.com',
    });
  });

  it('returns correo:null when the entry has no email', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjectByHandle: {
        id: 'gid://shopify/Metaobject/2',
        handle: 'sin-correo',
        displayName: 'Sin Correo',
        fields: [{key: 'nombre', value: 'Sin Correo'}],
      },
    });

    const advisor = await getAdvisorByHandle({}, 'sin-correo');

    expect(advisor.correo).toBeNull();
    expect(advisor.nombre).toBe('Sin Correo');
  });

  it('returns null for a handle that does not exist', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({metaobjectByHandle: null});

    await expect(getAdvisorByHandle({}, 'no-existe')).resolves.toBeNull();
  });

  it('returns null without querying when no handle is given', async () => {
    isStubMode.mockReturnValue(false);

    await expect(getAdvisorByHandle({}, '')).resolves.toBeNull();
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('returns a deterministic advisor with an email in stub mode', async () => {
    isStubMode.mockReturnValue(true);

    const advisor = await getAdvisorByHandle({}, 'marketing');

    expect(advisor.handle).toBe('marketing');
    expect(advisor.correo).toMatch(/@/);
    expect(adminFetch).not.toHaveBeenCalled();
  });
});

describe('addCustomerTags', () => {
  beforeEach(() => {
    isStubMode.mockReturnValue(false);
  });

  it('etiqueta al customer con la mutación tagsAdd', async () => {
    adminFetch.mockResolvedValueOnce({tagsAdd: {userErrors: []}});
    await addCustomerTags({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://shopify/Customer/7', [
      'lead-pendiente',
    ]);
    const [, query, vars] = adminFetch.mock.calls[0];
    expect(query).toMatch(/tagsAdd/);
    expect(vars).toEqual({id: 'gid://shopify/Customer/7', tags: ['lead-pendiente']});
  });

  it('no llama al Admin API sin gid o sin etiquetas', async () => {
    await addCustomerTags({PRIVATE_ADMIN_API_TOKEN: 't'}, null, ['x']);
    await addCustomerTags({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://shopify/Customer/7', []);
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('no llama al Admin API en modo stub', async () => {
    isStubMode.mockReturnValue(true);
    await addCustomerTags({}, 'gid://shopify/Customer/7', ['lead-pendiente']);
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('lanza cuando Shopify devuelve userErrors', async () => {
    adminFetch.mockResolvedValueOnce({
      tagsAdd: {userErrors: [{field: 'tags', message: 'inválido'}]},
    });
    await expect(
      addCustomerTags({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://shopify/Customer/7', ['x']),
    ).rejects.toThrow(/addCustomerTags userErrors/);
  });
});

describe('createCustomer · consentimiento de marketing', () => {
  it('manda emailMarketingConsent cuando el usuario se suscribió', async () => {
    adminFetch.mockResolvedValueOnce({
      customerCreate: {customer: {id: 'gid://shopify/Customer/7'}, userErrors: []},
    });
    await createCustomer(
      {PRIVATE_ADMIN_API_TOKEN: 't'},
      {email: 'a@b.mx', newsletterOptIn: true},
    );
    const consent = adminFetch.mock.calls[0][2].input.emailMarketingConsent;
    expect(consent.marketingState).toBe('SUBSCRIBED');
    expect(consent.marketingOptInLevel).toBe('SINGLE_OPT_IN');
    expect(typeof consent.consentUpdatedAt).toBe('string');
  });

  it('omite emailMarketingConsent cuando no se suscribió', async () => {
    adminFetch.mockResolvedValueOnce({
      customerCreate: {customer: {id: 'gid://shopify/Customer/7'}, userErrors: []},
    });
    await createCustomer({PRIVATE_ADMIN_API_TOKEN: 't'}, {email: 'a@b.mx'});
    expect('emailMarketingConsent' in adminFetch.mock.calls[0][2].input).toBe(false);
  });
});

describe('createCustomer · nota del registro', () => {
  it('manda la nota cuando se proporciona', async () => {
    adminFetch.mockResolvedValueOnce({
      customerCreate: {customer: {id: 'gid://shopify/Customer/7'}, userErrors: []},
    });
    await createCustomer(
      {PRIVATE_ADMIN_API_TOKEN: 't'},
      {email: 'a@b.mx', note: 'Empresa: Acme'},
    );
    expect(adminFetch.mock.calls[0][2].input.note).toBe('Empresa: Acme');
  });

  it('omite note cuando no hay nota que escribir', async () => {
    adminFetch.mockResolvedValueOnce({
      customerCreate: {customer: {id: 'gid://shopify/Customer/7'}, userErrors: []},
    });
    await createCustomer({PRIVATE_ADMIN_API_TOKEN: 't'}, {email: 'a@b.mx'});
    expect('note' in adminFetch.mock.calls[0][2].input).toBe(false);
  });
});

describe('listAdvisors · líderes fuera del select', () => {
  it('excluye a quien lidera a alguien en la matriz de managers', async () => {
    // Un cliente lo es de alguien del equipo, no de su líder. La exclusión sale
    // de la matriz para no mantener una lista de nombres aparte.
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {
        nodes: [
          advisorNode('jesus-rios', 'Jesús Ríos', 'Sales Manager', 'ACTIVE', 'jrios@generandoideas.com'),
          advisorNode('laura-vega', 'Laura Vega', 'Inside Sales', 'ACTIVE', 'lvega@generandoideas.com'),
        ],
      },
    });

    const advisors = await listAdvisors({});

    expect(advisors.map((a) => a.handle)).toEqual(['laura-vega']);
  });

  it('ignora mayúsculas al comparar el correo del líder', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {
        nodes: [
          advisorNode('seide', 'Seide Jiménez', 'Manager', 'ACTIVE', 'SJimenez@GenerandoIdeas.com'),
        ],
      },
    });

    expect(await listAdvisors({})).toEqual([]);
  });
});

/* La regla de "un líder no se ofrece" se pensó para un piso de ventas donde el
   jefe reparte cuentas entre seis. En Sonora y Mérida el equipo entero es una
   persona, así que su Local Sales Manager sí atiende clientes: excluirlo
   borraba a la mitad de la oficina del formulario de registro. El puesto lo
   mantiene marketing en Shopify, así que una promoción se refleja sola. */
describe('listAdvisors · el líder de una oficina regional sí atiende', () => {
  const gabriela = () =>
    advisorNode(
      'gabriela-maldonado',
      'Gabriela Maldonado',
      'Local Sales Manager',
      'ACTIVE',
      'merida2@generandoideas.com',
    );

  it('ofrece al Local Sales Manager aunque lidere a alguien', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({metaobjects: {nodes: [gabriela()]}});

    expect((await listAdvisors({})).map((a) => a.handle)).toEqual(['gabriela-maldonado']);
  });

  it('sigue ocultando a los demás líderes', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {
        nodes: [
          gabriela(),
          advisorNode('jesus-rios', 'Jesús Ríos', 'Strategic Sales Manager', 'ACTIVE', 'jrios@generandoideas.com'),
          advisorNode('seide', 'Seide Jiménez', 'Inside Sales Manager', 'ACTIVE', 'sjimenez@generandoideas.com'),
        ],
      },
    });

    expect((await listAdvisors({})).map((a) => a.handle)).toEqual(['gabriela-maldonado']);
  });

  /* El puesto es texto libre que alguien teclea en el admin. */
  it('tolera mayúsculas y espacios sobrantes en el puesto', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {
        nodes: [
          advisorNode('carlos-marmolejo', 'Carlos Marmolejo', '  local  SALES manager ', 'ACTIVE', 'sonora@generandoideas.com'),
        ],
      },
    });

    expect((await listAdvisors({})).map((a) => a.handle)).toEqual(['carlos-marmolejo']);
  });

  it('el puesto no rescata a quien no es líder ni cambia nada para él', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {
        nodes: [
          advisorNode('laura-vega', 'Laura Vega', 'Inside Sales Executive', 'ACTIVE', 'lvega@generandoideas.com'),
        ],
      },
    });

    expect((await listAdvisors({})).map((a) => a.handle)).toEqual(['laura-vega']);
  });

  /* El puesto sólo levanta la exclusión de líder: un borrador o el entry de
     respaldo siguen fuera pase lo que pase. */
  it('no rescata a un Local Sales Manager en borrador', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValue({
      metaobjects: {
        nodes: [
          advisorNode('gabriela-maldonado', 'Gabriela Maldonado', 'Local Sales Manager', 'DRAFT', 'merida2@generandoideas.com'),
        ],
      },
    });

    expect(await listAdvisors({})).toEqual([]);
  });
});

describe('setCustomerRequestedAdvisor', () => {
  beforeEach(() => {
    isStubMode.mockReturnValue(false);
  });

  it('escribe el reclamo en ejecutiva_solicitada, no en ejecutiva_de_venta', async () => {
    adminFetch.mockResolvedValueOnce({metafieldsSet: {metafields: [{id: 'm1'}], userErrors: []}});
    await setCustomerRequestedAdvisor(
      {PRIVATE_ADMIN_API_TOKEN: 't'},
      'gid://shopify/Customer/7',
      'gid://shopify/Metaobject/3',
    );
    const [campo] = adminFetch.mock.calls[0][2].metafields;
    expect(campo).toEqual({
      ownerId: 'gid://shopify/Customer/7',
      namespace: 'custom',
      key: 'ejecutiva_solicitada',
      type: 'metaobject_reference',
      value: 'gid://shopify/Metaobject/3',
    });
  });

  it('no llama al Admin API sin gid de cliente o de asesor', async () => {
    await setCustomerRequestedAdvisor({PRIVATE_ADMIN_API_TOKEN: 't'}, null, 'gid://m/1');
    await setCustomerRequestedAdvisor({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://c/1', null);
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('lanza cuando Shopify devuelve userErrors', async () => {
    adminFetch.mockResolvedValueOnce({
      metafieldsSet: {metafields: [], userErrors: [{field: 'value', message: 'inválido'}]},
    });
    await expect(
      setCustomerRequestedAdvisor({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://c/1', 'gid://m/1'),
    ).rejects.toThrow(/setCustomerRequestedAdvisor userErrors/);
  });

  it('sigue sin tocar ejecutiva_de_venta: eso lo hace marketing al validar', async () => {
    adminFetch.mockResolvedValueOnce({metafieldsSet: {metafields: [], userErrors: []}});
    await setCustomerRequestedAdvisor({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://c/1', 'gid://m/1');
    const keys = adminFetch.mock.calls[0][2].metafields.map((m) => m.key);
    expect(keys).not.toContain('ejecutiva_de_venta');
  });
});

describe('getCustomerAdvisor · gid del metaobject', () => {
  it('devuelve el gid además del correo, para poder referenciarlo', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValueOnce({
      customer: {
        metafield: {
          reference: {
            id: 'gid://shopify/Metaobject/55',
            type: 'ejecutiva_de_venta',
            fields: [{key: 'correo', value: 'lvega@generandoideas.com'}],
          },
        },
      },
    });
    const a = await getCustomerAdvisor({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://c/1');
    expect(a.gid).toBe('gid://shopify/Metaobject/55');
    expect(a.email).toBe('lvega@generandoideas.com');
  });

  it('devuelve gid null cuando el cliente no tiene asesor', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValueOnce({customer: {metafield: null}});
    const a = await getCustomerAdvisor({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://c/1');
    expect(a.gid).toBeNull();
    expect(a.email).toBeNull();
  });
});

describe('setDraftOrderAdvisor', () => {
  beforeEach(() => {
    isStubMode.mockReturnValue(false);
  });

  it('escribe custom.ejecutivo_asignado en la draft order', async () => {
    adminFetch.mockResolvedValueOnce({metafieldsSet: {metafields: [{id: 'm1'}], userErrors: []}});
    await setDraftOrderAdvisor(
      {PRIVATE_ADMIN_API_TOKEN: 't'},
      'gid://shopify/DraftOrder/9',
      'gid://shopify/Metaobject/55',
    );
    const [campo] = adminFetch.mock.calls[0][2].metafields;
    expect(campo).toEqual({
      ownerId: 'gid://shopify/DraftOrder/9',
      namespace: 'custom',
      key: 'ejecutivo_asignado',
      type: 'metaobject_reference',
      value: 'gid://shopify/Metaobject/55',
    });
  });

  it('no llama al Admin API sin draft order o sin asesor', async () => {
    await setDraftOrderAdvisor({PRIVATE_ADMIN_API_TOKEN: 't'}, null, 'gid://m/1');
    await setDraftOrderAdvisor({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://d/1', null);
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('lanza cuando Shopify devuelve userErrors', async () => {
    adminFetch.mockResolvedValueOnce({
      metafieldsSet: {metafields: [], userErrors: [{field: 'value', message: 'mal'}]},
    });
    await expect(
      setDraftOrderAdvisor({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://d/1', 'gid://m/1'),
    ).rejects.toThrow(/setDraftOrderAdvisor userErrors/);
  });
});

describe('getCustomerAdvisor · handle del metaobject', () => {
  it('devuelve el handle, que distingue al respaldo de una persona', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValueOnce({
      customer: {
        metafield: {
          reference: {
            id: 'gid://shopify/Metaobject/9',
            handle: 'marketing',
            fields: [{key: 'correo', value: 'marketing@generandoideas.com'}],
          },
        },
      },
    });
    const a = await getCustomerAdvisor({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://c/1');
    expect(a.handle).toBe('marketing');
  });
});

describe('getCustomerBrandColors', () => {
  it('devuelve el valor crudo del metafield', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValueOnce({
      customer: {metafield: {value: '["Rojo","Negro"]'}},
    });
    const out = await getCustomerBrandColors(
      {PRIVATE_ADMIN_API_TOKEN: 't'},
      'gid://shopify/Customer/9989852135727',
    );
    expect(out).toBe('["Rojo","Negro"]');
    const [, , vars] = adminFetch.mock.calls[0];
    expect(vars.gid).toBe('gid://shopify/Customer/9989852135727');
  });

  it('devuelve null cuando el customer no tiene el metafield', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValueOnce({customer: {metafield: null}});
    expect(await getCustomerBrandColors({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://x')).toBeNull();
  });

  it('devuelve null cuando el customer no existe', async () => {
    isStubMode.mockReturnValue(false);
    adminFetch.mockResolvedValueOnce({customer: null});
    expect(await getCustomerBrandColors({PRIVATE_ADMIN_API_TOKEN: 't'}, 'gid://x')).toBeNull();
  });

  /* Sin token no hay a quién preguntar, y un stub inventado restringiría el
     catálogo en desarrollo sin que nadie entienda por qué. */
  it('no llama a la red en stub mode', async () => {
    isStubMode.mockReturnValue(true);
    expect(await getCustomerBrandColors({}, 'gid://x')).toBeNull();
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('no llama a la red sin gid', async () => {
    isStubMode.mockReturnValue(false);
    expect(await getCustomerBrandColors({PRIVATE_ADMIN_API_TOKEN: 't'}, null)).toBeNull();
    expect(adminFetch).not.toHaveBeenCalled();
  });
});
