// Server-only. Idempotent CREATE TABLE/INDEX IF NOT EXISTS for every table in
// the spec, so later phases (wishlist, quotes) can use them without new migrations.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id                   TEXT PRIMARY KEY,
    email                TEXT NOT NULL,
    password_hash        TEXT NOT NULL,
    password_salt        TEXT NOT NULL,
    password_iterations  INTEGER NOT NULL,
    session_version      INTEGER NOT NULL DEFAULT 1,
    first_name           TEXT,
    last_name            TEXT,
    company              TEXT,
    rfc                  TEXT,
    role                 TEXT NOT NULL DEFAULT 'quoter',
    shopify_customer_gid TEXT,
    email_verified_at    TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`,

  `CREATE TABLE IF NOT EXISTS login_attempts (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    ip          TEXT NOT NULL,
    success     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip, created_at)`,

  `CREATE TABLE IF NOT EXISTS quotes (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users(id),
    status                  TEXT NOT NULL DEFAULT 'draft',
    notes                   TEXT,
    deadline                TEXT,
    shopify_draft_order_gid TEXT,
    shopify_invoice_url     TEXT,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_one_draft_per_user ON quotes(user_id) WHERE status='draft'`,
  `CREATE TABLE IF NOT EXISTS quote_items (
    id                   TEXT PRIMARY KEY,
    quote_id             TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    variant_id           TEXT NOT NULL,
    product_handle       TEXT,
    title                TEXT,
    qty                  INTEGER NOT NULL CHECK (qty >= 1),
    base_unit_price      REAL NOT NULL,
    technique            TEXT,
    surface              TEXT,
    size                 TEXT,
    decoration_total     REAL NOT NULL DEFAULT 0,
    effective_unit_price REAL NOT NULL,
    created_at           TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id)`,

  `CREATE TABLE IF NOT EXISTS wishlist (
    user_id    TEXT NOT NULL REFERENCES users(id),
    product_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, product_id)
  )`,

  `CREATE TABLE IF NOT EXISTS email_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    type        TEXT NOT NULL CHECK (type IN ('verify','reset')),
    token_hash  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    used_at     TEXT,
    created_at  TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_email_tokens_hash ON email_tokens(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id, type)`,
];

export async function migrate(db) {
  for (const sql of STATEMENTS) {
    await db.execute(sql);
  }
}
