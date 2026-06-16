# Phase 9: Assigned advisor (ejecutiva de venta) resolution + quote notification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the sales advisor (ejecutiva de venta) assigned to a Shopify customer, email her a notification when a quote is submitted, and show the advisor to the customer in their account.

**Architecture:** A new server-only Admin operation `getCustomerAdvisor(env, customerGid)` reads the customer's `custom.ejecutiva_de_venta` metafield, which is a Metaobject reference of type `ejecutiva_de_venta`; its fields are flattened to a plain object and the advisor email is taken from the `correo` field. A pure helper builds the notification email payload. `api.quote.submit.jsx` resolves the advisor after creating the draft order and sends a best-effort Resend email (Phase 8 `sendEmail`). The account quote-detail loader resolves the advisor read-only and renders a "Tu asesor" block.

**Tech Stack:** Shopify Admin GraphQL (`adminFetch`, API version 2026-04), Resend transactional email (`sendEmail`, Phase 8), libSQL/Turso, React Router 7 on Oxygen/workerd, Vitest with in-memory libSQL via the NODE build (`import {createClient} from "@libsql/client"`, url `:memory:`).

**Depends on:** Phase 8 (`app/lib/email/resend.js` `sendEmail`) and Phase 4 (`app/routes/api.quote.submit.jsx`) — both available.

**Admin scopes:** resolving the advisor requires `read_customers` and (because the metafield reference is a Metaobject) `read_metaobjects` on the real Admin token. Stub mode needs nothing.

---

### Task 1: `getCustomerAdvisor` Admin operation (parsing + stub)

**Files:**
- Modify: `app/lib/admin/operations.js` (add query + export `getCustomerAdvisor`)
- Test: `app/lib/admin/operations.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `app/lib/admin/operations.test.js`:

```js
import {describe, it, expect, vi} from 'vitest';

// adminFetch + isStubMode are mocked so the test exercises only parsing/stub branching.
vi.mock('./client.js', () => ({
  adminFetch: vi.fn(),
  isStubMode: vi.fn(),
}));

import {adminFetch, isStubMode} from './client.js';
import {getCustomerAdvisor} from './operations.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/admin/operations.test.js`
Expected: FAIL with "getCustomerAdvisor is not a function" (or import error).

- [ ] **Step 3: Write minimal implementation**

In `app/lib/admin/operations.js`, change the import line to also bring in `isStubMode`:

```js
import {adminFetch, isStubMode} from './client.js';
```

Then add the query constant and the exported function (append at the end of the file):

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/admin/operations.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Make the stub `adminFetch` branch null-safe for the advisor query**

The stub `operationName`/`stubResponse` in `app/lib/admin/client.js` do not recognize the advisor query. They will never be hit because `getCustomerAdvisor` short-circuits in stub mode before calling `adminFetch` — but harden `operationName` so a future direct call does not mis-route. In `app/lib/admin/client.js`, add a branch to `operationName` before the final `return 'unknown';`:

```js
  if (/customerAdvisor/.test(query)) return 'customerAdvisor';
```

And add a case to `stubResponse` before the `default:` case:

```js
    case 'customerAdvisor':
      return {customer: {metafield: null}};
```

- [ ] **Step 6: Run the admin tests again to confirm no regression**

Run: `npx vitest run app/lib/admin/operations.test.js`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add app/lib/admin/operations.js app/lib/admin/operations.test.js app/lib/admin/client.js
git commit -m "$(cat <<'EOF'
feat(admin): add getCustomerAdvisor resolving custom.ejecutiva_de_venta metaobject

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Pure notification payload builder

**Files:**
- Create: `app/lib/quotes/advisorEmail.js`
- Test: `app/lib/quotes/advisorEmail.test.js`

- [ ] **Step 1: Write the failing test**

Create `app/lib/quotes/advisorEmail.test.js`:

```js
import {describe, it, expect} from 'vitest';
import {buildAdvisorEmail} from './advisorEmail.js';

const QUOTE = {id: 'q-123', notes: 'Entrega urgente'};
const USER = {
  email: 'cliente@empresa.mx',
  firstName: 'Juan',
  lastName: 'Pérez',
  company: 'Empresa SA',
};
const ITEMS = [
  {title: 'Taza clásica', qty: 300, technique: 'SERIGRAFÍA', size: '4 x 4', effectiveUnitPrice: 29.97},
  {title: 'Pluma', qty: 50, technique: 'Sin decorado', size: null, effectiveUnitPrice: 12},
];

describe('buildAdvisorEmail', () => {
  it('builds subject containing the folio', () => {
    const msg = buildAdvisorEmail({
      advisorEmail: 'maria@generandoideas.com',
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      invoiceUrl: 'https://shop/invoice/1',
    });
    expect(msg.to).toBe('maria@generandoideas.com');
    expect(msg.subject).toContain('q-123');
  });

  it('includes customer identity, items summary and the invoice link in the html', () => {
    const msg = buildAdvisorEmail({
      advisorEmail: 'maria@generandoideas.com',
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      invoiceUrl: 'https://shop/invoice/1',
    });
    expect(msg.html).toContain('Juan Pérez');
    expect(msg.html).toContain('Empresa SA');
    expect(msg.html).toContain('cliente@empresa.mx');
    expect(msg.html).toContain('Taza clásica');
    expect(msg.html).toContain('SERIGRAFÍA 4 x 4');
    expect(msg.html).toContain('300');
    expect(msg.html).toContain('Pluma');
    expect(msg.html).toContain('https://shop/invoice/1');
    // total = 300*29.97 + 50*12 = 9591.00
    expect(msg.html).toContain('9,591.00');
  });

  it('escapes HTML in user-supplied values', () => {
    const msg = buildAdvisorEmail({
      advisorEmail: 'maria@generandoideas.com',
      quote: {id: 'q-1', notes: '<script>alert(1)</script>'},
      user: {...USER, company: 'A & B <Co>'},
      items: ITEMS,
      invoiceUrl: null,
    });
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('&lt;script&gt;');
    expect(msg.html).toContain('A &amp; B &lt;Co&gt;');
  });

  it('omits the invoice link block when invoiceUrl is null', () => {
    const msg = buildAdvisorEmail({
      advisorEmail: 'maria@generandoideas.com',
      quote: QUOTE,
      user: USER,
      items: ITEMS,
      invoiceUrl: null,
    });
    expect(msg.html).not.toContain('href');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/lib/quotes/advisorEmail.test.js`
Expected: FAIL with "buildAdvisorEmail is not a function".

- [ ] **Step 3: Write minimal implementation**

Create `app/lib/quotes/advisorEmail.js`:

```js
// Pure helper: build the advisor notification email payload (no I/O).
// Returns {to, subject, html} ready for Phase 8 sendEmail.

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(amount) {
  return Number(amount || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function decorationLabel(item) {
  if (item.technique && item.technique !== 'Sin decorado') {
    return [item.technique, item.size].filter(Boolean).join(' ');
  }
  return 'Sin decorado';
}

/**
 * @param {{
 *   advisorEmail: string,
 *   quote: {id: string, notes?: string|null},
 *   user: {email: string, firstName?: string, lastName?: string, company?: string},
 *   items: Array<{title: string, qty: number, technique?: string, size?: string, effectiveUnitPrice: number}>,
 *   invoiceUrl: string|null,
 * }} args
 * @returns {{to: string, subject: string, html: string}}
 */
export function buildAdvisorEmail({advisorEmail, quote, user, items, invoiceUrl}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const total = items.reduce((s, i) => s + Number(i.effectiveUnitPrice) * i.qty, 0);

  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(i.title)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(decorationLabel(i))}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${i.qty}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">$${money(i.effectiveUnitPrice)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">$${money(Number(i.effectiveUnitPrice) * i.qty)}</td>
      </tr>`,
    )
    .join('');

  const invoiceBlock = invoiceUrl
    ? `<p><a href="${escapeHtml(invoiceUrl)}">Ver / pagar cotización en Shopify</a></p>`
    : '';

  const notesBlock = quote.notes
    ? `<p><strong>Notas del cliente:</strong> ${escapeHtml(quote.notes)}</p>`
    : '';

  const html = `
    <div style="font-family:Arial,sans-serif;color:#1a1a1a">
      <h2>Nueva cotización ${escapeHtml(quote.id)}</h2>
      <p>
        <strong>Cliente:</strong> ${escapeHtml(fullName || user.email)}<br/>
        <strong>Empresa:</strong> ${escapeHtml(user.company || '—')}<br/>
        <strong>Correo:</strong> ${escapeHtml(user.email)}
      </p>
      ${notesBlock}
      <table style="border-collapse:collapse;width:100%;margin-top:12px">
        <thead>
          <tr style="text-align:left">
            <th style="padding:6px 10px;border-bottom:2px solid #ddd">Producto</th>
            <th style="padding:6px 10px;border-bottom:2px solid #ddd">Decorado</th>
            <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:right">Cant.</th>
            <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:right">Unitario</th>
            <th style="padding:6px 10px;border-bottom:2px solid #ddd;text-align:right">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="padding:10px;text-align:right;font-weight:bold">Total</td>
            <td style="padding:10px;text-align:right;font-weight:bold">$${money(total)}</td>
          </tr>
        </tfoot>
      </table>
      ${invoiceBlock}
    </div>`;

  return {
    to: advisorEmail,
    subject: `Nueva cotización ${quote.id} — ${fullName || user.email}`,
    html,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/lib/quotes/advisorEmail.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/lib/quotes/advisorEmail.js app/lib/quotes/advisorEmail.test.js
git commit -m "$(cat <<'EOF'
feat(quotes): add buildAdvisorEmail payload helper for advisor notifications

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire advisor notification into quote submit (best-effort)

**Files:**
- Modify: `app/routes/api.quote.submit.jsx`

This route runs on workerd only — VERIFY MANUALLY (no integration test). The notification is best-effort: submit MUST still succeed if advisor resolution or email send throws.

- [ ] **Step 1: Add imports**

In `app/routes/api.quote.submit.jsx`, after the existing
`import {createCustomer, createDraftOrder} from '~/lib/admin/operations';`
line, change it to also import `getCustomerAdvisor`, and add the two new imports below it:

```js
import {createCustomer, createDraftOrder, getCustomerAdvisor} from '~/lib/admin/operations';
import {buildAdvisorEmail} from '~/lib/quotes/advisorEmail';
import {sendEmail} from '~/lib/email/resend';
```

- [ ] **Step 2: Resolve the advisor and send the notification after the draft order is created**

In `app/routes/api.quote.submit.jsx`, locate the block that writes the submitted status:

```js
  // Collapse the status write + any bookkeeping into one libSQL round-trip.
  await db.batch(
    [
      {
        sql: `UPDATE quotes
              SET status='submitted', shopify_draft_order_gid=?, shopify_invoice_url=?, updated_at=?
              WHERE id=?`,
        args: [gid ?? null, invoiceUrl ?? null, new Date().toISOString(), quote.id],
      },
    ],
    'write',
  );
```

Immediately AFTER that `await db.batch(...)` call (and BEFORE the `const safeInvoiceUrl = ...` line), insert the best-effort notification block:

```js
  // Best-effort advisor notification. The quote is already submitted and
  // persisted; failures here must NOT fail the submit. Resolve the advisor from
  // the Shopify customer's custom.ejecutiva_de_venta metaobject (key "correo").
  try {
    const advisor = await getCustomerAdvisor(env, customerGid);
    if (advisor.email) {
      const message = buildAdvisorEmail({
        advisorEmail: advisor.email,
        quote: {id: quote.id, notes: quote.notes},
        user,
        items,
        invoiceUrl, // raw url; advisor is internal staff, may see stub url in dev
      });
      await sendEmail(env, message);
    }
  } catch (err) {
    console.error('[quote.submit] advisor notification failed (non-fatal):', err);
  }
```

Note: `customerGid`, `quote`, `items`, `user`, `invoiceUrl`, and `env` are all already in scope from earlier in the action. Server-recompute integrity is untouched — this block only reads already-persisted data.

- [ ] **Step 3: Verify the build typechecks/lints**

Run: `npm run lint`
Expected: no new errors in `app/routes/api.quote.submit.jsx`.

- [ ] **Step 4: MANUAL verification**

Start the dev server (`npm run dev`), log in, add an item to a quote, and submit from `/cotizacion`.
Expected (stub mode, no `PRIVATE_ADMIN_API_TOKEN`): the submit returns `{folio, draftOrderGid, invoiceUrl:null}` and the server log shows a `[admin][STUB]` warning is NOT emitted for the advisor (stub short-circuits), and `sendEmail` is invoked with `to: "asesor-stub@example.com"`. Confirm submit still returns 200 even if `RESEND_API_KEY` is unset (the catch swallows the error and logs it).
Confirm: the quote row is `status='submitted'` regardless of email outcome.

- [ ] **Step 5: Commit**

```bash
git add app/routes/api.quote.submit.jsx
git commit -m "$(cat <<'EOF'
feat(quotes): notify assigned advisor by email on quote submit (best-effort)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Show "Tu asesor" block on the quote detail page

**Files:**
- Modify: `app/routes/account.cotizaciones.$id.jsx`

This route loader runs on workerd only — VERIFY MANUALLY. The advisor is resolved read-only and must degrade gracefully (no block when there is no advisor).

- [ ] **Step 1: Add imports and resolve the advisor in the loader**

In `app/routes/account.cotizaciones.$id.jsx`, add imports for the user lookup and advisor resolution. Change the import block at the top to:

```js
import {useLoaderData, Link, data} from 'react-router';
import {requireUser} from '~/lib/auth/guard';
import {getDb} from '~/lib/db/client';
import {getQuoteWithItems} from '~/lib/quotes/repo';
import {findById} from '~/lib/auth/users';
import {getCustomerAdvisor} from '~/lib/admin/operations';
import {formatPrice} from '~/lib/gi';
```

Then replace the existing `loader` function:

```js
export async function loader({params, context}) {
  const sessionUser = await requireUser(context);
  const db = getDb(context.env);
  const {quote, items} = await getQuoteWithItems(db, params.id);
  // Ownership check: never leak another user's quote.
  if (!quote || quote.userId !== sessionUser.userId) {
    throw data({error: 'No encontrada'}, {status: 404});
  }
  // Resolve the assigned advisor read-only; degrade gracefully on failure.
  let advisor = {email: null, fields: {}};
  try {
    const user = await findById(db, sessionUser.userId);
    advisor = await getCustomerAdvisor(context.env, user.shopifyCustomerGid);
  } catch (err) {
    console.error('[cotizacion] advisor lookup failed (non-fatal):', err);
  }
  return {quote, items, advisor};
}
```

- [ ] **Step 2: Render the "Tu asesor" block**

In `app/routes/account.cotizaciones.$id.jsx`, change the component signature to read `advisor`:

```js
export default function CotizacionDetail() {
  const {quote, items, advisor} = useLoaderData();
```

Then, immediately after the `<p>Estado · ...</p>` line and before the `{quote.shopifyInvoiceUrl && (` block, insert the advisor block:

```jsx
      {advisor.email && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-lg)',
          }}
        >
          <div style={{fontWeight: 700, marginBottom: 4}}>Tu asesor</div>
          {advisor.fields.nombre && <div>{advisor.fields.nombre}</div>}
          <div>
            <a href={`mailto:${advisor.email}`}>{advisor.email}</a>
          </div>
          {advisor.fields.telefono && (
            <div style={{color: 'var(--ink-3)'}}>{advisor.fields.telefono}</div>
          )}
        </div>
      )}
```

- [ ] **Step 3: Verify lint**

Run: `npm run lint`
Expected: no new errors in `app/routes/account.cotizaciones.$id.jsx`.

- [ ] **Step 4: MANUAL verification**

Start the dev server, log in, open a submitted quote at `/account/cotizaciones/<folio>`.
Expected (stub mode): a "Tu asesor" block renders with name "Asesor Stub", email `asesor-stub@example.com` (a `mailto:` link), and phone `00 0000 0000`. Confirm that if `getCustomerAdvisor` returned `{email:null}` (real mode, no advisor assigned) the block is absent and the page still renders the items table.

- [ ] **Step 5: Commit**

```bash
git add app/routes/account.cotizaciones.$id.jsx
git commit -m "$(cat <<'EOF'
feat(account): show assigned advisor block on quote detail

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Full test suite green

**Files:** none (verification only)

- [ ] **Step 1: Run the new unit tests together**

Run: `npx vitest run app/lib/admin/operations.test.js app/lib/quotes/advisorEmail.test.js`
Expected: PASS (10 tests total: 6 + 4).

- [ ] **Step 2: Run the full suite to confirm no regression**

Run: `npx vitest run`
Expected: PASS (all prior tests plus the two new files).

- [ ] **Step 3: Final lint**

Run: `npm run lint`
Expected: clean (no new errors).
