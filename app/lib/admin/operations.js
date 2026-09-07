// Server-only. Domain operations on top of the Admin GraphQL transport.
// createCustomer is idempotent (TAKEN userError -> look up existing by email and
// reuse its gid). createDraftOrder defines the exact DraftOrderInput-shaped
// mutation (purchasingEntity.customerId + originalUnitPriceWithCurrency); it is
// consumed in Phase 4. env is always passed explicitly.

import {MANAGERS} from '../quotes/managers.js';
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
 * @param {{email: string, firstName?: string, lastName?: string, newsletterOptIn?: boolean, note?: string}} args
 * @returns {Promise<{gid: string}>}
 */
export async function createCustomer(env, {email, firstName, lastName, newsletterOptIn, note}) {
  const input = {email};
  if (firstName != null) input.firstName = firstName;
  if (lastName != null) input.lastName = lastName;
  // Resumen del registro para que marketing decida la asignación sin salir del
  // admin. Sólo se aplica al crear: en la rama de correo ya tomado no se pisa
  // la nota de un cliente que ya existía.
  if (note) input.note = note;
  if (newsletterOptIn) {
    // Espejo del alta al newsletter. La verdad vive en users.newsletter_opt_in;
    // esto es para que marketing pueda segmentar desde Shopify sin pedir un
    // export. En la rama de correo ya tomado no se aplica: ese customer ya
    // existía y su consentimiento no es nuestro que sobrescribir.
    input.emailMarketingConsent = {
      marketingState: 'SUBSCRIBED',
      marketingOptInLevel: 'SINGLE_OPT_IN',
      consentUpdatedAt: new Date().toISOString(),
    };
  }

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
            id
            handle
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
 * @returns {Promise<{email: string|null, gid: string|null, handle: string|null, fields: Record<string, string>}>}
 */
export async function getCustomerAdvisor(env, customerGid) {
  if (isStubMode(env)) {
    return {
      email: STUB_ADVISOR.email,
      gid: 'gid://shopify/Metaobject/STUB-advisor',
      handle: 'asesor-stub',
      fields: {...STUB_ADVISOR.fields},
    };
  }
  if (!customerGid) return {email: null, gid: null, handle: null, fields: {}};

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
  // El gid permite referenciar al asesor desde otros objetos (p. ej. la draft
  // order), sin volver a resolverlo por handle.
  const gid = reference && reference.id ? reference.id : null;
  // El handle distingue a una persona del entry de respaldo `marketing`, que
  // tiene correo pero no es un ejecutivo ni tiene cuenta en el portal.
  const handle = reference && reference.handle ? reference.handle : null;
  return {email, gid, handle, fields};
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

/** Correos de quienes lideran a alguien: no aparecen en el select del registro. */
const LIDERES = new Set(Object.values(MANAGERS).map((c) => c.trim().toLowerCase()));

/* La excepción a esa regla. Se pensó para un piso de ventas donde el líder
   reparte cuentas entre seis, pero en Sonora y Mérida el equipo entero es una
   persona: su Local Sales Manager atiende clientes como cualquiera, y
   excluirlo borraba a media oficina del formulario de registro.
   Se decide por el puesto, que marketing ya mantiene en Shopify, y no por una
   lista de correos aparte: así una promoción o una oficina nueva se reflejan
   sin tocar código. */
const PUESTO_QUE_ATIENDE = 'local sales manager';

/** Compara el puesto sin depender de cómo lo tecleó quien lo capturó. */
function atiendeAunqueLidere(puesto) {
  return (
    String(puesto ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') === PUESTO_QUE_ATIENDE
  );
}

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
    metaobjectByHandle(handle: $handle) {
      id
      handle
      displayName
      fields { key value }
    }
  }
`;

/** Asignación oficial: la escribe marketing al validar. */
const ADVISOR_KEY = 'ejecutiva_de_venta';

/** Lo que el usuario dijo al registrarse. Todavía no es una asignación. */
const REQUESTED_ADVISOR_KEY = 'ejecutiva_solicitada';

const CUSTOMER_ADVISOR_SET = `
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`;

const STUB_ADVISORS = [
  {handle: 'asesor-stub-uno', nombre: 'Asesor Stub Uno', puesto: 'Account Executive', correo: 'stub1@example.com'},
  {handle: 'asesor-stub-dos', nombre: 'Asesor Stub Dos', puesto: 'Inside Sales Executive', correo: 'stub2@example.com'},
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
 * @returns {Promise<Array<{handle: string, nombre: string, puesto: string, correo: string}>>}
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
        correo: (fields.correo || '').trim().toLowerCase(),
      };
    })
    // Un líder no se ofrece como asesor: quien ya eres cliente lo es de alguien
    // de su equipo, no de él. Se deriva de la matriz para que no haya que
    // mantener una lista de nombres aparte. La excepción son las oficinas
    // regionales — ver PUESTO_QUE_ATIENDE.
    .filter((a) => !LIDERES.has(a.correo) || atiendeAunqueLidere(a.puesto))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * Read a single advisor entry by handle: gid plus the fields the signup
 * notification needs. Null when the handle doesn't exist.
 * @param {Record<string, any>} env
 * @param {string|null|undefined} handle
 * @returns {Promise<{gid: string, handle: string, nombre: string, puesto: string, correo: string|null}|null>}
 */
export async function getAdvisorByHandle(env, handle) {
  if (!handle) return null;
  if (isStubMode(env)) {
    return {
      gid: `gid://shopify/Metaobject/STUB-${handle}`,
      handle,
      nombre: STUB_ADVISOR.fields.nombre,
      puesto: 'Account Executive',
      correo: STUB_ADVISOR.email,
    };
  }

  const data = await adminFetch(env, ADVISOR_BY_HANDLE, {
    handle: {type: ADVISOR_TYPE, handle},
  });
  const node = data ? data.metaobjectByHandle : null;
  if (!node || !node.id) return null;

  const fields = {};
  for (const f of node.fields || []) {
    if (f && f.key != null) fields[f.key] = f.value;
  }
  const correo = fields.correo ? String(fields.correo).trim() || null : null;

  return {
    gid: node.id,
    handle: node.handle || handle,
    nombre: fields.nombre || node.displayName || handle,
    puesto: fields.puesto || '',
    correo,
  };
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
  const advisor = await getAdvisorByHandle(env, handle);
  return advisor ? advisor.gid : null;
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
  return setAdvisorMetafield(env, customerGid, advisorGid, {
    key: ADVISOR_KEY,
    label: 'setCustomerAdvisor',
  });
}

/**
 * Guardar el ejecutivo que el usuario DIJO tener al registrarse. Va en un
 * campo distinto de la asignación oficial a propósito: mientras marketing no
 * valide, el cliente sigue sin asesor y sus cotizaciones caen en ventas@.
 * Validar consiste en copiar este valor a `ejecutiva_de_venta`.
 *
 * Para que se vea como campo en la ficha del cliente hace falta crear la
 * definición `custom.ejecutiva_solicitada` (metaobject_reference validado
 * contra `ejecutiva_de_venta`) en Configuración → Datos personalizados.
 *
 * @param {Record<string, any>} env
 * @param {string|null|undefined} customerGid
 * @param {string|null|undefined} advisorGid
 * @returns {Promise<void>}
 */
export async function setCustomerRequestedAdvisor(env, customerGid, advisorGid) {
  return setAdvisorMetafield(env, customerGid, advisorGid, {
    key: REQUESTED_ADVISOR_KEY,
    label: 'setCustomerRequestedAdvisor',
  });
}

/** Escritura compartida: mismo shape, distinta llave. */
async function setAdvisorMetafield(env, customerGid, advisorGid, {key, label}) {
  if (!customerGid || !advisorGid) return;
  if (isStubMode(env)) return;

  const data = await adminFetch(env, CUSTOMER_ADVISOR_SET, {
    metafields: [
      {
        ownerId: customerGid,
        namespace: 'custom',
        key,
        type: 'metaobject_reference',
        value: advisorGid,
      },
    ],
  });
  const result = data ? data.metafieldsSet : null;
  if (result && result.userErrors && result.userErrors.length) {
    throw new Error(
      `${label} userErrors: ${result.userErrors.map((e) => e.message).join('; ')}`,
    );
  }
}

const CUSTOMER_TAGS_ADD = `
  mutation tagsAdd($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors { field message }
    }
  }
`;

/**
 * Añadir etiquetas a un customer. Es la forma en que el alta marca un lead como
 * pendiente de que marketing le asigne ejecutivo: marketing filtra por el tag
 * en el admin de Shopify. No-op sin gid, sin etiquetas o en modo stub.
 * Requiere write_customers.
 * @param {Record<string, any>} env
 * @param {string|null|undefined} customerGid
 * @param {string[]} tags
 * @returns {Promise<void>}
 */
export async function addCustomerTags(env, customerGid, tags) {
  if (!customerGid || !Array.isArray(tags) || tags.length === 0) return;
  if (isStubMode(env)) return;

  const data = await adminFetch(env, CUSTOMER_TAGS_ADD, {id: customerGid, tags});
  const result = data ? data.tagsAdd : null;
  if (result && result.userErrors && result.userErrors.length) {
    throw new Error(
      `addCustomerTags userErrors: ${result.userErrors.map((e) => e.message).join('; ')}`,
    );
  }
}

const DRAFT_ORDER_ADVISOR_KEY = 'ejecutivo_asignado';

/**
 * Marcar la draft order con el ejecutivo que la atiende, para poder filtrar las
 * órdenes por asesor en el admin de Shopify.
 *
 * Requiere crear la definición `custom.ejecutivo_asignado` sobre Draft orders
 * (metaobject_reference validado contra `ejecutiva_de_venta`) en Configuración
 * → Datos personalizados; sin ella el valor se escribe pero el admin no lo
 * muestra ni lo ofrece como filtro.
 *
 * @param {Record<string, any>} env
 * @param {string|null|undefined} draftOrderGid
 * @param {string|null|undefined} advisorGid
 * @returns {Promise<void>}
 */
export async function setDraftOrderAdvisor(env, draftOrderGid, advisorGid) {
  if (!draftOrderGid || !advisorGid) return;
  if (isStubMode(env)) return;

  const data = await adminFetch(env, CUSTOMER_ADVISOR_SET, {
    metafields: [
      {
        ownerId: draftOrderGid,
        namespace: 'custom',
        key: DRAFT_ORDER_ADVISOR_KEY,
        type: 'metaobject_reference',
        value: advisorGid,
      },
    ],
  });
  const result = data ? data.metafieldsSet : null;
  if (result && result.userErrors && result.userErrors.length) {
    throw new Error(
      `setDraftOrderAdvisor userErrors: ${result.userErrors.map((e) => e.message).join('; ')}`,
    );
  }
}

const CUSTOMER_BRAND_COLORS = `
  query customerBrandColors($gid: ID!) {
    customer(id: $gid) {
      metafield(namespace: "custom", key: "colores") { value }
    }
  }
`;

/**
 * Lee la paleta de marca del cliente: el metafield de customer
 * `custom.colores`, un list.single_line_text_field cuyo valor es un JSON como
 * `["Rojo","Negro"]`. Devuelve la cadena cruda —el parseo vive en
 * brand-colors.js, que es puro y testeable sin red.
 *
 * Null-safe por diseño: sin token, sin gid, sin customer o sin metafield
 * devuelve null, que aguas arriba significa "no filtres". Requiere el scope
 * read_customers, el mismo que ya usa getCustomerAdvisor.
 * @param {Record<string, any>} env
 * @param {string|null|undefined} customerGid
 * @returns {Promise<string|null>}
 */
export async function getCustomerBrandColors(env, customerGid) {
  if (isStubMode(env) || !customerGid) return null;
  const data = await adminFetch(env, CUSTOMER_BRAND_COLORS, {gid: customerGid});
  return data?.customer?.metafield?.value ?? null;
}
