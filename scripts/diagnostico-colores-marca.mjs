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
import {adminFetch} from '../app/lib/admin/client.js';
import {COLOR_FAMILIES, colorFamilyOf} from '../app/lib/filters.js';

const env = process.env;

if (!env.PUBLIC_STORE_DOMAIN || !env.PRIVATE_ADMIN_API_TOKEN) {
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

// La guarda de arriba exige PRIVATE_ADMIN_API_TOKEN, así que adminFetch nunca
// cae en stub mode aquí: siempre pega a la Admin API real.
async function pedir(cursor) {
  const data = await adminFetch(env, QUERY, {cursor});
  return data.products;
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
