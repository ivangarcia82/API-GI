# GI Implementation Plans — Index & Execution Order

This index ties together the GI phase plans derived from the design spec:
[2026-06-16-gi-auth-decoration-quotes-design.md](../specs/2026-06-16-gi-auth-decoration-quotes-design.md).

> **Read this first.** Phase *numbers* are NOT the execution order. Phases must be
> executed in the order below because of cross-phase code dependencies (the
> decoration engine, the auth stub→signup handoff, and the AppContext/server
> wiring that depends on everything before it).

## MANDATORY EXECUTION ORDER

Execute the phases strictly in this sequence:

1. **Phase 1 — Auth infrastructure** (also migrates account routes off OAuth + admin reset).
   _Rationale: everything authenticated depends on the new auth layer; ships first so later phases build on real sessions/roles._
2. **Phase 2 — Shopify Admin stub + signup link.**
   _Rationale: replaces Phase 1's stub `createCustomer` with the real signup customer-create; must follow the auth infra it plugs into._
3. **Phase 5 — Pure decoration engine + selector.**
   _Rationale: the engine must exist before quotes can recompute against it; built pure/standalone so Phase 4 can import it._
4. **Phase 4 — Quotes repo + draft orders** (imports the engine).
   _Rationale: consumes the Phase 5 decoration engine to recompute quotes and create draft orders; cannot start until the engine is in place._
5. **Phase 3 — Wishlist** (independent).
   _Rationale: self-contained feature with no dependency on quotes/decoration; slotted here once the heavier chain is underway._
6. **Phase 6 — Remove MOQ / ranges.**
   _Rationale: cleanup of legacy pricing constraints; safe only after the quote/decoration model is settled._
7. **Phase 7 — AppContext role (read-only) + quote server fetchers + PDP/cotizacion wiring** (runs last).
   _Rationale: wires the UI/context to all prior pieces (roles, quotes, decoration); depends on every earlier phase, so it must run last._

## Cross-phase contracts & gotchas

- **Signup customer-create lives ONLY in Phase 2.** Phase 1 ships a **stub-bodied
  `createCustomer`**; Phase 2 **replaces the signup block** with the real
  implementation. Do **not** duplicate the signup customer-create in both phases —
  there is exactly one real implementation, and it belongs to Phase 2.
- **Decoration engine is built in Phase 5, before Phase 4 consumes it.** Phase 4
  imports the engine; the engine must be pure and complete first so quote
  recomputation has a stable contract.
- **`cotizacion.jsx` stepper edit is owned by Phase 4.** No other phase should
  touch the stepper logic.
- **`account.jsx`, `account._index`, and `account.profile` are migrated in Phase 1**
  (off OAuth, plus admin reset).
- **AppContext role/quote wiring is owned by Phase 7** (role is read-only in
  AppContext; quote server fetchers + PDP/cotizacion wiring also land here).
- **Favs (wishlist) wiring is owned by Phase 3.**

## Phase files & goals

| Exec order | Phase file | One-line goal |
|---|---|---|
| 1 | `2026-06-16-gi-phase1-auth-infra.md` | Stand up auth infrastructure; migrate account routes off OAuth + add admin reset; ship stub `createCustomer`. |
| 2 | `2026-06-16-gi-phase2-shopify-link.md` | Add Shopify Admin stub + signup link; replace the signup block with the real customer-create. |
| 3 | `2026-06-16-gi-phase5-decoration-engine.md` | Build the pure decoration engine + selector (engine must exist before quotes recompute). |
| 4 | `2026-06-16-gi-phase4-quotes-draft-orders.md` | Quotes repo + draft orders; import the decoration engine; own the `cotizacion.jsx` stepper edit. |
| 5 | `2026-06-16-gi-phase3-wishlist.md` | Build the independent wishlist (favs) feature and its wiring. |
| 6 | `2026-06-16-gi-phase6-remove-moq.md` | Remove MOQ / pricing ranges from the product/quote model. |
| 7 | `2026-06-16-gi-phase7-appcontext-ui-wiring.md` | AppContext role (read-only) + quote server fetchers + PDP/cotizacion wiring; runs last. |

## Execution mechanism

Each plan is executed via **`superpowers:subagent-driven-development`** (for
in-session, independent-task execution) or **`superpowers:executing-plans`** (for
separate-session execution with review checkpoints).
