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
      draftOrder { id invoiceUrl }
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
        q: `email:${email}`,
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
  return {gid: result.draftOrder.id, invoiceUrl: result.draftOrder.invoiceUrl};
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
