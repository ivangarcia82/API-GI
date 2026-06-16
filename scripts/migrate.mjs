// One-off / repeatable migration runner for Turso.
// Usage:  set -a; . ./.env; set +a; node scripts/migrate.mjs
// Idempotent (CREATE ... IF NOT EXISTS), safe to run multiple times.
import {getDb} from '../app/lib/db/client.js';
import {migrate} from '../app/lib/db/migrate.js';

const db = getDb(process.env);
await migrate(db);
const r = await db.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
);
console.log('OK — tables:', r.rows.map((x) => x.name).join(', '));
