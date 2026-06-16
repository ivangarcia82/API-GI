const DEFAULT_API_VERSION = '2026-04';

/**
 * @param {Record<string, any>} env
 * @returns {boolean} true when running against the stub (no real Admin token)
 */
export function isStubMode(env) {
  const hasToken = Boolean(env && env.PRIVATE_ADMIN_API_TOKEN);
  if (!hasToken && env && env.ENVIRONMENT === 'production') {
    throw new Error(
      'Admin API is in stub mode but ENVIRONMENT=production. Set PRIVATE_ADMIN_API_TOKEN before deploying.',
    );
  }
  return !hasToken;
}

/**
 * Parse the operation name from a GraphQL document so the stub can branch.
 * @param {string} query
 * @returns {string}
 */
function operationName(query) {
  if (/customerCreate/.test(query)) return 'customerCreate';
  if (/draftOrderCreate/.test(query)) return 'draftOrderCreate';
  if (/customerAdvisor/.test(query)) return 'customerAdvisor';
  if (/\bcustomers\b/.test(query)) return 'customers';
  return 'unknown';
}

/**
 * Deterministic, side-effect-free stub responses (logs loudly).
 * @param {string} query
 * @returns {any}
 */
function stubResponse(query) {
  switch (operationName(query)) {
    case 'customerCreate':
      return {
        customerCreate: {
          customer: {
            id: `gid://shopify/Customer/STUB-${crypto.randomUUID()}`,
          },
          userErrors: [],
        },
      };
    case 'draftOrderCreate':
      return {
        draftOrderCreate: {
          draftOrder: {
            id: `gid://shopify/DraftOrder/STUB-${crypto.randomUUID()}`,
            invoiceUrl: `stub://draft-order/${crypto.randomUUID()}`,
          },
          userErrors: [],
        },
      };
    case 'customers':
      return {customers: {edges: []}};
    case 'customerAdvisor':
      return {customer: {metafield: null}};
    default:
      return {};
  }
}

/**
 * Execute an Admin GraphQL operation. Real when PRIVATE_ADMIN_API_TOKEN is set,
 * stub otherwise. Returns the `data` payload.
 * @param {Record<string, any>} env
 * @param {string} query
 * @param {Record<string, any>} [variables]
 * @returns {Promise<any>}
 */
export async function adminFetch(env, query, variables = {}) {
  if (isStubMode(env)) {
    console.warn(
      '[admin][STUB] Admin API stub invoked (no PRIVATE_ADMIN_API_TOKEN). ' +
        `op=${operationName(query)} — DO NOT use stub data in production.`,
    );
    return stubResponse(query);
  }

  const version = env.SHOPIFY_ADMIN_API_VERSION || DEFAULT_API_VERSION;
  const url = `https://${env.PUBLIC_STORE_DOMAIN}/admin/api/${version}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': env.PRIVATE_ADMIN_API_TOKEN,
    },
    body: JSON.stringify({query, variables}),
  });
  const json = await res.json();
  if (json.errors && json.errors.length) {
    throw new Error(
      `Admin API error: ${json.errors.map((e) => e.message).join('; ')}`,
    );
  }
  return json.data;
}
