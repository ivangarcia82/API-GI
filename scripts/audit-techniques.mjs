// Audit which products use decoration techniques NOT in PRICE_MATRIX.
// Usage:  set -a; . ./.env; set +a; node scripts/audit-techniques.mjs
// Needs PUBLIC_STORE_DOMAIN + PUBLIC_STOREFRONT_API_TOKEN (npx shopify hydrogen env pull).
import {readFileSync, writeFileSync} from 'fs';
import {getTechniques, resolveTechniqueKey} from '../app/lib/decoration/engine.js';

const DOMAIN = process.env.PUBLIC_STORE_DOMAIN;
const TOKEN = process.env.PUBLIC_STOREFRONT_API_TOKEN;
const VERSION = process.env.PUBLIC_STOREFRONT_API_VERSION || '2026-04';
const DOC = 'docs/decoration-nonstandard-techniques.md';

if (!DOMAIN || !TOKEN) {
  console.error(
    'Missing PUBLIC_STORE_DOMAIN / PUBLIC_STOREFRONT_API_TOKEN.\n' +
      'Run `npx shopify hydrogen env pull` (or add them to .env), then re-run.',
  );
  process.exit(1);
}

const ENDPOINT = `https://${DOMAIN}/api/${VERSION}/graphql.json`;
const QUERY = `
  query Products($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        title
        handle
        metafield(namespace: "custom", key: "tecnicas_de_impresion") { value }
      }
    }
  }`;

async function page(cursor) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN},
    body: JSON.stringify({query: QUERY, variables: {cursor}}),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data.products;
}

const rows = [];
let cursor = null;
do {
  const p = await page(cursor);
  for (const n of p.nodes) {
    const val = n.metafield?.value;
    if (!val) continue;
    const nonStd = getTechniques(val).filter((t) => !resolveTechniqueKey(t));
    if (nonStd.length) rows.push({title: n.title, handle: n.handle, nonStd});
  }
  cursor = p.pageInfo.hasNextPage ? p.pageInfo.endCursor : null;
} while (cursor);

const table = rows.length
  ? ['| Producto | Handle | Técnicas no estandarizadas |', '|---|---|---|']
      .concat(rows.map((r) => `| ${r.title} | ${r.handle} | ${r.nonStd.join(', ')} |`))
      .join('\n')
  : '_No se encontraron productos con técnicas no estandarizadas. 🎉_';

const stamp = new Date().toISOString().slice(0, 10);
const block = `<!-- AUDIT:START -->\n### Auditoría automática (${stamp}) — ${rows.length} producto(s)\n\n${table}\n<!-- AUDIT:END -->`;
const doc = readFileSync(DOC, 'utf8').replace(/<!-- AUDIT:START -->[\s\S]*<!-- AUDIT:END -->/, block);
writeFileSync(DOC, doc);
console.log(`Done. ${rows.length} product(s) with non-standard techniques written to ${DOC}.`);
