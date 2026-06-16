// Server-only. Per-request libSQL/web HTTP client.
// MUST import from '@libsql/client/web' (bare '@libsql/client' breaks the workerd bundle).
// Never create at module scope: workerd I/O objects do not cross requests.
import {createClient} from '@libsql/client/web';

export function getDb(env) {
  const url = env.TURSO_DATABASE_URL;
  if (!url || !/^https:\/\//.test(url)) {
    throw new Error('TURSO_DATABASE_URL must be set and use https:// (Hrana-over-HTTP).');
  }
  return createClient({
    url,
    authToken: env.TURSO_AUTH_TOKEN,
  });
}
