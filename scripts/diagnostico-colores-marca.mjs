// scripts/diagnostico-colores-marca.mjs
//
// Uso:  set -a; . ./.env; set +a; PUBLIC_STORE_DOMAIN=development-gi.myshopify.com \
//         node scripts/diagnostico-colores-marca.mjs
//
// Mide cuánto catálogo le queda a un cliente según los colores de su marca,
// antes de encender el filtro. Responde a dos preguntas:
//   1. Por cada familia de color, ¿cuántos productos activos sobreviven?
//   2. ¿Cuántos productos no tienen NINGÚN tono clasificable (UNICO,
//      TRANSPARENTE, MARMOLEADO)? Ésos desaparecen para todos los clientes
//      con paleta, y son el riesgo real de la decisión que tomamos.
import {COLOR_FAMILIES, colorFamilyOf} from '../app/lib/filters.js';

const env = process.env;
const dominio = env.PUBLIC_STORE_DOMAIN;
const token = env.PRIVATE_ADMIN_API_TOKEN;
const version = env.SHOPIFY_ADMIN_API_VERSION || '2026-04';

if (!dominio || !token) {
  console.error(
    '✗ Faltan PUBLIC_STORE_DOMAIN y/o PRIVATE_ADMIN_API_TOKEN.\n' +
      '  set -a; . ./.env; set +a; PUBLIC_STORE_DOMAIN=development-gi.myshopify.com \\\n' +
      '    node scripts/diagnostico-colores-marca.mjs',
  );
  process.exit(1);
}

const QUERY = `
  query productosConColor($cursor: String) {
    products(first: 250, after: $cursor, query: "status:active") {
      nodes { id options { name optionValues { name } } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

async function pedir(cursor) {
  const res = await fetch(`https://${dominio}/admin/api/${version}/graphql.json`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Shopify-Access-Token': token},
    body: JSON.stringify({query: QUERY, variables: {cursor}}),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(`Admin API: ${JSON.stringify(json.errors ?? res.status)}`);
  }
  return json.data.products;
}

const porFamilia = new Map(COLOR_FAMILIES.map((f) => [f.id, 0]));
let total = 0;
let sinNingunTono = 0;
const tonosNoReconocidos = new Map();

let cursor = null;
do {
  const page = await pedir(cursor);
  for (const p of page.nodes) {
    total += 1;
    const opcion = (p.options || []).find((o) => /color/i.test(o.name));
    const tonos = (opcion?.optionValues || []).map((v) => v.name);
    const familias = new Set();
    for (const t of tonos) {
      const fam = colorFamilyOf(t);
      if (fam) familias.add(fam);
      else tonosNoReconocidos.set(t, (tonosNoReconocidos.get(t) || 0) + 1);
    }
    if (familias.size === 0) sinNingunTono += 1;
    for (const f of familias) porFamilia.set(f, porFamilia.get(f) + 1);
  }
  cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  process.stderr.write(`\r  leídos ${total}…`);
} while (cursor);
process.stderr.write('\n\n');

const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;
console.log(`Productos activos analizados: ${total}\n`);
console.log('Catálogo que le queda a una marca de UN SOLO color:');
for (const fam of COLOR_FAMILIES) {
  const n = porFamilia.get(fam.id);
  console.log(`  ${fam.label.padEnd(12)} ${String(n).padStart(6)}  ${pct(n).padStart(7)}`);
}
console.log(
  `\nProductos sin ningún tono clasificable: ${sinNingunTono} (${pct(sinNingunTono)})`,
);
console.log('  → desaparecen para TODOS los clientes con paleta.\n');
console.log('Valores de color que no se reconocen (top 20):');
for (const [tono, n] of [...tonosNoReconocidos].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${String(n).padStart(5)}  ${tono}`);
}
