// Server-only. Domain operations on top of the Admin GraphQL transport.
// createCustomer is idempotent (TAKEN userError -> look up existing by email and
// reuse its gid). createDraftOrder defines the exact DraftOrderInput-shaped
// mutation (purchasingEntity.customerId + originalUnitPriceWithCurrency); it is
// consumed in Phase 4. env is always passed explicitly.

import {adminFetch, isStubMode} from './client.js';

const CUSTOMER_CREATE = `
  mutation customerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

const CUSTOMERS_BY_EMAIL = `
  query customers($q: String!) {
    customers(first: 1, query: $q) {
      edges { node { id } }
    }
  }
`;

const DRAFT_ORDER_CREATE = `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id invoiceUrl customer { id } }
      userErrors { field message }
    }
  }
`;

/**
 * @param {Array<{message: string}>} userErrors
 * @returns {boolean}
 */
function isTakenError(userErrors) {
  return userErrors.some((e) => /has already been taken/i.test(e.message));
}

/**
 * Create (or reuse) a Shopify customer. Idempotent: on a TAKEN userError it
 * looks up the existing customer by email and returns its gid.
 * @param {Record<string, any>} env
 * @param {{email: string, firstName?: string, lastName?: string}} args
 * @returns {Promise<{gid: string}>}
 */
export async function createCustomer(env, {email, firstName, lastName}) {
  const input = {email};
  if (firstName != null) input.firstName = firstName;
  if (lastName != null) input.lastName = lastName;

  const data = await adminFetch(env, CUSTOMER_CREATE, {input});
  const result = data.customerCreate;

  if (result.userErrors && result.userErrors.length) {
    if (isTakenError(result.userErrors)) {
      const lookup = await adminFetch(env, CUSTOMERS_BY_EMAIL, {
        // Double-quote the email: Shopify's search tokenizes on "@" and ".", so
        // an unquoted address (email:foo@bar.com) often fails to match. Double
        // quotes are the documented way to match an exact value (single quotes
        // are treated literally).
        q: `email:"${email}"`,
      });
      const node = lookup.customers.edges[0] && lookup.customers.edges[0].node;
      if (node && node.id) return {gid: node.id};
      throw new Error(
        `createCustomer: email taken but lookup found no customer for ${email}`,
      );
    }
    throw new Error(
      `createCustomer userErrors: ${result.userErrors
        .map((e) => e.message)
        .join('; ')}`,
    );
  }

  return {gid: result.customer.id};
}

/**
 * Create a Shopify draft order. `input` must already be a shaped DraftOrderInput
 * (purchasingEntity.customerId, presentmentCurrencyCode: MXN, lineItems with
 * originalUnitPriceWithCurrency {amount, currencyCode: "MXN"}). Used in Phase 4.
 * @param {Record<string, any>} env
 * @param {Record<string, any>} input
 * @returns {Promise<{gid: string, invoiceUrl: string}>}
 */
export async function createDraftOrder(env, input) {
  const data = await adminFetch(env, DRAFT_ORDER_CREATE, {input});
  const result = data.draftOrderCreate;
  if (result.userErrors && result.userErrors.length) {
    throw new Error(
      `createDraftOrder userErrors: ${result.userErrors
        .map((e) => e.message)
        .join('; ')}`,
    );
  }
  return {
    gid: result.draftOrder.id,
    invoiceUrl: result.draftOrder.invoiceUrl,
    // The customer Shopify linked to the draft (by purchasingEntity or by
    // email). Lets the caller persist a real gid for the advisor lookup.
    customerGid: result.draftOrder.customer ? result.draftOrder.customer.id : null,
  };
}

const CUSTOMER_ADVISOR = `
  query customerAdvisor($gid: ID!) {
    customer(id: $gid) {
      metafield(namespace: "custom", key: "ejecutiva_de_venta") {
        reference {
          ... on Metaobject {
            type
            fields { key value }
          }
        }
      }
    }
  }
`;

const STUB_ADVISOR = {
  email: 'asesor-stub@example.com',
  fields: {
    nombre: 'Asesor Stub',
    correo: 'asesor-stub@example.com',
    telefono: '00 0000 0000',
  },
};

/**
 * Resolve the sales advisor (ejecutiva de venta) assigned to a Shopify customer.
 * The advisor lives on the CUSTOMER in metafield custom.ejecutiva_de_venta, a
 * Metaobject reference of type "ejecutiva_de_venta"; the email field key is "correo".
 * Null-safe: returns {email:null, fields:{}} when absent. In stub mode returns a
 * deterministic test advisor. Requires Admin scopes read_customers + read_metaobjects.
 * @param {Record<string, any>} env
 * @param {string|null|undefined} customerGid
 * @returns {Promise<{email: string|null, fields: Record<string, string>}>}
 */
export async function getCustomerAdvisor(env, customerGid) {
  if (isStubMode(env)) {
    return {email: STUB_ADVISOR.email, fields: {...STUB_ADVISOR.fields}};
  }
  if (!customerGid) return {email: null, fields: {}};

  const data = await adminFetch(env, CUSTOMER_ADVISOR, {gid: customerGid});
  const reference =
    data && data.customer && data.customer.metafield
      ? data.customer.metafield.reference
      : null;
  const rawFields =
    reference && Array.isArray(reference.fields) ? reference.fields : [];

  const fields = {};
  for (const f of rawFields) {
    if (f && f.key != null) fields[f.key] = f.value;
  }

  const email = fields.correo ? String(fields.correo).trim() || null : null;
  return {email, fields};
}

const VARIANT_INVENTORY = `
  query variantInventory($id: ID!) {
    node(id: $id) {
      ... on ProductVariant { inventoryQuantity }
    }
  }
`;

/**
 * Best-effort total available inventory for a variant, via the Admin API
 * (the Hydrogen-managed Storefront token can't get the inventory scope).
 * Returns null in stub mode, when there's no variant, or on any error (e.g.
 * the Admin app is missing the `read_inventory` scope) — never throws.
 * @param {Record<string, any>} env
 * @param {string|null|undefined} variantId
 * @returns {Promise<number|null>}
 */
export async function getVariantInventory(env, variantId) {
  if (isStubMode(env) || !variantId) return null;
  try {
    const data = await adminFetch(env, VARIANT_INVENTORY, {id: variantId});
    const q = data && data.node ? data.node.inventoryQuantity : null;
    return typeof q === 'number' ? q : null;
  } catch (err) {
    console.warn('[admin] inventory read failed (needs read_inventory scope):', err && err.message);
    return null;
  }
}

// --- Asignación de ejecutiva de venta en el registro -------------------------
// El asesor vive en el CUSTOMER, en custom.ejecutiva_de_venta (metaobject_reference
// validado contra la definición ejecutiva_de_venta). `listAdvisors` alimenta el
// select del registro y `setCustomerAdvisor` escribe la elección. El entry
// `marketing` es el respaldo: nunca se ofrece, solo se asigna.

const ADVISOR_TYPE = 'ejecutiva_de_venta';

/** Handle del entry de respaldo; se filtra de la lista seleccionable. */
const ADVISOR_FALLBACK_HANDLE = 'marketing';

const ADVISORS_LIST = `
  query advisors($type: String!) {
    metaobjects(type: $type, first: 250, sortKey: "display_name") {
      nodes {
        handle
        displayName
        capabilities { publishable { status } }
        fields { key value }
      }
    }
  }
`;

const ADVISOR_BY_HANDLE = `
  query metaobjectByHandle($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) { id }
  }
`;

const CUSTOMER_ADVISOR_SET = `
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`;

const STUB_ADVISORS = [
  {handle: 'asesor-stub-uno', nombre: 'Asesor Stub Uno', puesto: 'Account Executive'},
  {handle: 'asesor-stub-dos', nombre: 'Asesor Stub Dos', puesto: 'Inside Sales Executive'},
];

/**
 * Advisors the customer may pick during signup: published entries only, with the
 * `marketing` fallback removed. Sorted by name with Spanish collation so accents
 * land where a Spanish speaker expects them.
 *
 * Note: Shopify's `metaobjects(query:)` has no `status` field — passing
 * "status:active" is silently ignored and returns drafts too, so the DRAFT
 * filter has to happen here. An entry with no publishable capability keeps its
 * place rather than disappearing.
 *
 * @param {Record<string, any>} env
 * @returns {Promise<Array<{handle: string, nombre: string, puesto: string}>>}
 */
export async function listAdvisors(env) {
  if (isStubMode(env)) return STUB_ADVISORS.map((a) => ({...a}));

  const data = await adminFetch(env, ADVISORS_LIST, {type: ADVISOR_TYPE});
  const nodes =
    data && data.metaobjects && Array.isArray(data.metaobjects.nodes)
      ? data.metaobjects.nodes
      : [];

  return nodes
    .filter((node) => {
      if (!node || !node.handle) return false;
      if (node.handle === ADVISOR_FALLBACK_HANDLE) return false;
      const status =
        node.capabilities && node.capabilities.publishable
          ? node.capabilities.publishable.status
          : null;
      return status !== 'DRAFT';
    })
    .map((node) => {
      const fields = {};
      for (const f of node.fields || []) {
        if (f && f.key != null) fields[f.key] = f.value;
      }
      return {
        handle: node.handle,
        nombre: fields.nombre || node.displayName || node.handle,
        puesto: fields.puesto || '',
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * Resolve an advisor handle to its metaobject gid. The signup action only ever
 * receives a handle from the browser and resolves it here, so a tampered form
 * can't point the metafield at an arbitrary object.
 * @param {Record<string, any>} env
 * @param {string|null|undefined} handle
 * @returns {Promise<string|null>}
 */
export async function resolveAdvisorGid(env, handle) {
  if (!handle) return null;
  if (isStubMode(env)) return `gid://shopify/Metaobject/STUB-${handle}`;

  const data = await adminFetch(env, ADVISOR_BY_HANDLE, {
    handle: {type: ADVISOR_TYPE, handle},
  });
  const node = data ? data.metaobjectByHandle : null;
  return node && node.id ? node.id : null;
}

/**
 * Point a customer's custom.ejecutiva_de_venta at an advisor metaobject.
 * No-op when either gid is missing or in stub mode. Requires write_customers.
 * @param {Record<string, any>} env
 * @param {string|null|undefined} customerGid
 * @param {string|null|undefined} advisorGid
 * @returns {Promise<void>}
 */
export async function setCustomerAdvisor(env, customerGid, advisorGid) {
  if (!customerGid || !advisorGid) return;
  if (isStubMode(env)) return;

  const data = await adminFetch(env, CUSTOMER_ADVISOR_SET, {
    metafields: [
      {
        ownerId: customerGid,
        namespace: 'custom',
        key: 'ejecutiva_de_venta',
        type: 'metaobject_reference',
        value: advisorGid,
      },
    ],
  });
  const result = data ? data.metafieldsSet : null;
  if (result && result.userErrors && result.userErrors.length) {
    throw new Error(
      `setCustomerAdvisor userErrors: ${result.userErrors
        .map((e) => e.message)
        .join('; ')}`,
    );
  }
}
