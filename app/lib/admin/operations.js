// Server-only. PHASE 1 STUB. Real implementation lands in Phase 2 (Admin GraphQL).
// Frozen signature: createCustomer(env, {email, firstName, lastName}) -> { gid }.
// Stub returns a deterministic-format STUB gid. createDraftOrder is declared here
// (frozen signature) but Phase 1 never calls it.

export async function createCustomer(env, {email, firstName, lastName}) {
  // Phase 1 always runs in stub mode (no PRIVATE_ADMIN_API_TOKEN handling yet).
  void email;
  void firstName;
  void lastName;
  return {gid: 'gid://shopify/Customer/STUB-' + crypto.randomUUID()};
}

export async function createDraftOrder(env, input) {
  void env;
  void input;
  throw new Error('createDraftOrder is not implemented until Phase 4.');
}
