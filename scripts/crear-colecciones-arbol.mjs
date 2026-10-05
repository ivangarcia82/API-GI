// Crea en Shopify las colecciones del árbol de categorías que todavía no existen.
//
// Uso:  set -a; . ./.env; set +a; PUBLIC_STORE_DOMAIN=development-gi.myshopify.com \
//         node scripts/crear-colecciones-arbol.mjs [--dry-run]
//
// El árbol vive en app/lib/category-tree.js. Cada nodo es una colección
// automática: incluye un producto si tiene CUALQUIERA de sus etiquetas. Las
// nuevas se publican en los mismos canales que las existentes (Online Store y
// la tienda de Hydrogen), para que el sitio las pueda leer.
//
// Idempotente y conservador: una colección que ya existe no se toca. Si sus
// reglas no coinciden con el árbol sólo se avisa, porque cambiarlas mueve
// productos que hoy ve el cliente.
import {adminFetch, isStubMode} from '../app/lib/admin/client.js';
import {flattenTree} from '../app/lib/category-tree.js';

const dryRun = process.argv.includes('--dry-run');
const env = process.env;

if (!env.PUBLIC_STORE_DOMAIN) {
  console.error('✗ Falta PUBLIC_STORE_DOMAIN (p. ej. development-gi.myshopify.com).');
  process.exit(1);
}
if (isStubMode(env)) {
  console.error('✗ PRIVATE_ADMIN_API_TOKEN no está en el entorno. Carga el .env antes de correr.');
  process.exit(1);
}

const EXISTENTES = `
  query coleccionesExistentes($after: String) {
    collections(first: 250, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        ruleSet { appliedDisjunctively rules { column relation condition } }
      }
    }
    publications(first: 20) { nodes { id name } }
  }
`;

const CREAR = `
  mutation crearColeccion($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection { id handle }
      userErrors { field message }
    }
  }
`;

const PUBLICAR = `
  mutation publicarColeccion($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors { field message }
    }
  }
`;

async function leerExistentes() {
  const porHandle = new Map();
  let after = null;
  let publicaciones = [];
  for (;;) {
    const data = await adminFetch(env, EXISTENTES, {after});
    publicaciones = data.publications.nodes;
    for (const c of data.collections.nodes) porHandle.set(c.handle, c);
    if (!data.collections.pageInfo.hasNextPage) break;
    after = data.collections.pageInfo.endCursor;
  }
  return {porHandle, publicaciones};
}

/** Las etiquetas que hoy filtra una colección automática, o null si es manual. */
function etiquetasDe(coleccion) {
  const reglas = coleccion.ruleSet?.rules ?? [];
  if (!coleccion.ruleSet || reglas.some((r) => r.column !== 'TAG' || r.relation !== 'EQUALS')) return null;
  if (reglas.length > 1 && !coleccion.ruleSet.appliedDisjunctively) return null;
  return reglas.map((r) => r.condition).sort();
}

const {porHandle, publicaciones} = await leerExistentes();
const canales = publicaciones.filter((p) => ['Online Store', 'API GI'].includes(p.name));
if (canales.length !== 2) {
  console.error(`✗ No encontré los canales Online Store y API GI (hay: ${publicaciones.map((p) => p.name).join(', ')}).`);
  process.exit(1);
}

let creadas = 0;
let existentes = 0;
const avisos = [];

for (const nodo of flattenTree()) {
  const ya = porHandle.get(nodo.handle);
  if (ya) {
    existentes += 1;
    const actuales = etiquetasDe(ya);
    const esperadas = [...nodo.tags].sort();
    if (!actuales || actuales.join('|') !== esperadas.join('|')) {
      avisos.push(`  ! ${nodo.handle}: hoy filtra ${actuales ? actuales.join(' / ') : 'a mano'}; el árbol espera ${esperadas.join(' / ')}`);
    }
    continue;
  }

  const input = {
    title: nodo.title,
    handle: nodo.handle,
    ruleSet: {
      appliedDisjunctively: true,
      rules: nodo.tags.map((tag) => ({column: 'TAG', relation: 'EQUALS', condition: tag})),
    },
  };

  if (dryRun) {
    console.log(`  + crearía ${nodo.handle} (nivel ${nodo.level}) ← ${nodo.tags.join(' / ')}`);
    creadas += 1;
    continue;
  }

  const {collectionCreate} = await adminFetch(env, CREAR, {input});
  if (collectionCreate.userErrors.length) {
    console.error(`  ✗ ${nodo.handle}: ${collectionCreate.userErrors.map((e) => e.message).join('; ')}`);
    continue;
  }
  const {publishablePublish} = await adminFetch(env, PUBLICAR, {
    id: collectionCreate.collection.id,
    input: canales.map((c) => ({publicationId: c.id})),
  });
  if (publishablePublish.userErrors.length) {
    console.error(`  ✗ ${nodo.handle} creada pero sin publicar: ${publishablePublish.userErrors.map((e) => e.message).join('; ')}`);
  }
  console.log(`  + ${nodo.handle} (nivel ${nodo.level}) ← ${nodo.tags.join(' / ')}`);
  creadas += 1;
}

console.log(`\n${dryRun ? 'Se crearían' : 'Creadas'}: ${creadas} · ya existían: ${existentes}`);
if (avisos.length) {
  console.log('\nColecciones existentes cuyas reglas no coinciden con el árbol (no se tocaron):');
  console.log(avisos.join('\n'));
}
