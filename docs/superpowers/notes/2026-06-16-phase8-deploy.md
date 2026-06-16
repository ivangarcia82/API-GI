# Phase 8 deployment — email verification + password reset (Resend)

## After merging to the live environment

1. **Migrate the live DB** to create `email_tokens`:
   ```bash
   set -a; . ./.env; set +a; node scripts/migrate.mjs
   ```
   Confirm `email_tokens` appears in the printed table list. The migration is
   idempotent (`CREATE ... IF NOT EXISTS`), so it is safe to re-run.

2. **Set Oxygen secrets** (not committed):
   ```bash
   npx shopify hydrogen env push   # or set via the Shopify admin / Oxygen UI:
   #   RESEND_API_KEY = <resend key>
   #   EMAIL_FROM     = Generando Ideas <no-reply@notificaciones.generandoideas.com>
   ```
   With `RESEND_API_KEY` unset, the email client runs as a loud no-op stub and
   no mail is sent (forgot/verify still return success; ops sees `[email][STUB]`).

## Verify in production
- Trigger a password reset for a known account; confirm the email arrives and the
  reset link logs you in and invalidates the old password.
- Register a new account; confirm the verification email arrives and the link sets
  `email_verified_at`.
