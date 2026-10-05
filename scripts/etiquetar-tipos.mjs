// Asigna a los productos de Shopify la etiqueta de tipo (nivel 3) del árbol
// de categorías, para que las colecciones de tipo no estén vacías mientras la
// sincronización con proveedores no las asigne por su cuenta.
//
// Uso:  set -a; . ./.env; set +a; PUBLIC_STORE_DOMAIN=development-gi.myshopify.com \
//         node scripts/etiquetar-tipos.mjs [--dry-run]
//
// Usa la misma regla que documenta docs/catalogo/arbol-de-categorias.md
// (typeTagFor en app/lib/category-tree.js). Sólo AGREGA etiquetas con
// tagsAdd: no quita ni cambia ninguna de las que ya tiene el producto.
// Idempotente: a quien ya tiene su etiqueta no se le vuelve a escribir.
//
// Ojo: si la sincronización reemplaza todas las etiquetas en cada corrida,
// lo que agregue este script se pierde en la siguiente.
import {adminFetch, isStubMode} from '../app/lib/admin/client.js';
import {CATEGORY_TREE, typeTagFor} from '../app/lib/category-tree.js';

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

const PRODUCTOS = `
  query productos($after: String) {
    products(first: 250, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { id title tags }
    }
  }
`;

const AGREGAR = `
  mutation agregarEtiquetas($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors { field message }
    }
  }
`;

// Sólo las subcategorías que tienen tipos con regla de título: los tipos
// "desde etiqueta" ya traen la suya del proveedor.
const SUBCATEGORIAS = CATEGORY_TREE.flatMap((c) => c.children ?? []).filter((s) =>
  (s.children ?? []).some((t) => !t.fromTag),
);

/** Etiquetas de tipo que le faltan a un producto. */
export function etiquetasFaltantes(producto) {
  const faltan = new Set();
  for (const sub of SUBCATEGORIAS) {
    if (!sub.tags.some((t) => producto.tags.includes(t))) continue;
    const tipo = typeTagFor(sub, producto);
    if (tipo && !producto.tags.includes(tipo)) faltan.add(tipo);
  }
  return [...faltan];
}

async function leerProductos() {
  const todos = [];
  let after = null;
  for (;;) {
    const data = await adminFetch(env, PRODUCTOS, {after});
    todos.push(...data.products.nodes);
    if (!data.products.pageInfo.hasNextPage) return todos;
    after = data.products.pageInfo.endCursor;
  }
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* El Admin API limita por costo de consulta. Con un "Throttled" se espera y
   se reintenta en vez de perder la escritura. */
async function agregar(id, tags) {
  for (let intento = 0; intento < 6; intento += 1) {
    try {
      const {tagsAdd} = await adminFetch(env, AGREGAR, {id, tags});
      return tagsAdd.userErrors;
    } catch (error) {
      if (!/throttl/i.test(String(error?.message))) throw error;
      await espera(1000 * (intento + 1));
    }
  }
  throw new Error(`Sin cupo del Admin API para ${id}`);
}

const productos = await leerProductos();
const pendientes = productos
  .map((p) => ({p, tags: etiquetasFaltantes(p)}))
  .filter((x) => x.tags.length);

const porEtiqueta = {};
for (const {tags} of pendientes) for (const t of tags) porEtiqueta[t] = (porEtiqueta[t] || 0) + 1;

console.log(`Productos revisados: ${productos.length}`);
console.log(`Productos a etiquetar: ${pendientes.length}`);
for (const [t, n] of Object.entries(porEtiqueta).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${t}`);
}

if (dryRun || !pendientes.length) process.exit(0);

let hechos = 0;
let errores = 0;
// Pocas a la vez: cada tagsAdd cuesta cupo y el límite es por tienda.
const EN_PARALELO = 4;
for (let i = 0; i < pendientes.length; i += EN_PARALELO) {
  const lote = pendientes.slice(i, i + EN_PARALELO);
  const resultados = await Promise.all(lote.map(({p, tags}) => agregar(p.id, tags)));
  resultados.forEach((errs, j) => {
    if (errs.length) {
      errores += 1;
      console.error(`  ✗ ${lote[j].p.title}: ${errs.map((e) => e.message).join('; ')}`);
    } else {
      hechos += 1;
    }
  });
  if ((i / EN_PARALELO) % 100 === 0) console.log(`  … ${hechos}/${pendientes.length}`);
}
console.log(`\nEtiquetados: ${hechos} · con error: ${errores}`);
