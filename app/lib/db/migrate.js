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
    razon_social         TEXT,
    phone                TEXT,
    volume               TEXT,
    needs                TEXT,
    position             TEXT,
    area                 TEXT,
    heard_about          TEXT,
    location             TEXT,
    es_cliente           TEXT,
    advisor_handle       TEXT,
    privacy_accepted_at  TEXT,
    terms_accepted_at    TEXT,
    newsletter_opt_in    INTEGER,
    newsletter_opt_in_at TEXT,
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
    image                TEXT,
    created_at           TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id)`,

  // Consecutivo del folio de cotización, una fila por serie y año. El conteo
  // reinicia cada año, así que el año forma parte de la llave.
  `CREATE TABLE IF NOT EXISTS folio_counters (
    serie TEXT NOT NULL,
    year  INTEGER NOT NULL,
    last  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (serie, year)
  )`,

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
  // Idempotent column additions for databases created before the column
  // existed (CREATE TABLE IF NOT EXISTS won't alter an existing table).
  await addColumnIfMissing(db, 'quote_items', 'image', 'TEXT');
  // Folio legible; NULL en las cotizaciones anteriores al cambio, que siguen
  // mostrando su UUID. No se numeran hacia atrás: ya circularon así.
  await addColumnIfMissing(db, 'quotes', 'folio', 'TEXT');
  await addColumnIfMissing(db, 'users', 'phone', 'TEXT');
  await addColumnIfMissing(db, 'users', 'volume', 'TEXT');
  await addColumnIfMissing(db, 'users', 'needs', 'TEXT');
  // Perfil ampliado, consentimiento legal y newsletter (reunión 2026-08-30).
  // Todas nullable: las filas anteriores se quedan vacías y nadie las rellena.
  for (const [col, tipo] of [
    ['position', 'TEXT'],
    ['area', 'TEXT'],
    ['heard_about', 'TEXT'],
    ['location', 'TEXT'],
    ['es_cliente', 'TEXT'],
    ['advisor_handle', 'TEXT'],
    ['privacy_accepted_at', 'TEXT'],
    ['terms_accepted_at', 'TEXT'],
    ['newsletter_opt_in', 'INTEGER'],
    ['newsletter_opt_in_at', 'TEXT'],
  ]) {
    await addColumnIfMissing(db, 'users', col, tipo);
  }
  // Idempotent rename for databases created before the column was renamed
  // from `rfc` to `razon_social`. No-op on new databases (rfc never existed).
  await renameColumnIfPresent(db, 'users', 'rfc', 'razon_social');
}

async function addColumnIfMissing(db, table, column, type) {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (err) {
    const msg = String(err && (err.message || err));
    // Ignore "duplicate column name" — the column already exists.
    if (!/duplicate column name/i.test(msg)) throw err;
  }
}

async function renameColumnIfPresent(db, table, from, to) {
  const info = await db.execute(`PRAGMA table_info(${table})`);
  const cols = info.rows.map((r) => r.name);
  if (cols.includes(from) && !cols.includes(to)) {
    await db.execute(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
  }
}
