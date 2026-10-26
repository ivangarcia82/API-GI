// Arma en Shopify las campañas por temporada a partir del Excel de SKUs.
//
// Uso:  set -a; . ./.env; set +a; PUBLIC_STORE_DOMAIN=development-gi.myshopify.com \
//         node scripts/campanas.mjs [--dry-run] [--solo octubre-rosa]
//
// Por cada campaña de app/lib/campanas.js:
//   1. Busca cada SKU de scripts/campanas/skus.json y le agrega al producto la
//      etiqueta de la campaña (tagsAdd: no quita ni cambia ninguna otra).
//   2. Crea la colección automática (cualquiera de las etiquetas de la
//      campaña) si no existe, con el texto de DESCRIPCIONES, y la publica en
//      Online Store y API GI. Si ya existe, sólo le pone el texto si no tiene
//      ninguno y le suma las etiquetas que le falten: lo demás lo edita
//      mercadotecnia.
//   3. Si hay banner en scripts/campanas/<handle>-banner.jpg y la colección no
//      tiene imagen, lo sube como imagen de la colección.
//   4. Escribe app/lib/campanas-variantes.js con la variante que fija cada
//      SKU con sufijo (A2148.05 → el color .05), para que la landing enseñe
//      ese color.
//
// Idempotente. Ojo: si la sincronización con proveedores reemplaza todas las
// etiquetas en cada corrida, la de campaña se pierde en la siguiente.
import fs from 'node:fs';
import path from 'node:path';
import {adminFetch, isStubMode} from '../app/lib/admin/client.js';
import {CAMPANAS, etiquetasDe} from '../app/lib/campanas.js';
import {subirImagen} from './lib/subir-imagen.mjs';
import VARIANTES_ACTUALES from '../app/lib/campanas-variantes.js';

const dryRun = process.argv.includes('--dry-run');
const soloIdx = process.argv.indexOf('--solo');
const solo = soloIdx > -1 ? process.argv[soloIdx + 1] : null;
const env = process.env;
const RAIZ = path.resolve(import.meta.dirname, '..');
const SALIDA = path.join(RAIZ, 'app/lib/campanas-variantes.js');

/* El texto inicial de cada colección. Después manda el que tenga Shopify. */
const DESCRIPCIONES = {
  'octubre-rosa':
    'Porque cuidarnos también es un acto de amor. Una colección que se suma para crear conciencia y promover la prevención y la detección oportuna.',
  navidad:
    'Una temporada para celebrar lo que nos une. Una colección que celebra el espíritu de compartir, agradecer y disfrutar juntos.',
  'ano-nuevo':
    'Un nuevo año, nuevas posibilidades. Una colección que celebra los nuevos comienzos, los propósitos y todo lo que está por venir.',
  'agendas-2027':
    'Ideas, planes y nuevos objetivos. Encuentra la agenda ideal para organizar tu 2027.',
};

if (!env.PUBLIC_STORE_DOMAIN) {
  console.error(
    '✗ Falta PUBLIC_STORE_DOMAIN (p. ej. development-gi.myshopify.com).',
  );
  process.exit(1);
}
if (isStubMode(env)) {
  console.error(
    '✗ PRIVATE_ADMIN_API_TOKEN no está en el entorno. Carga el .env antes de correr.',
  );
  process.exit(1);
}

const VARIANTES = `
  query variantes($q: String!) {
    productVariants(first: 50, query: $q) {
      nodes {
        id
        sku
        selectedOptions { name value }
        media(first: 1) { nodes { ... on MediaImage { image { url } } } }
        product { id handle title tags featuredMedia { preview { image { url } } } }
      }
    }
  }
`;

const COLECCION = `
  query coleccion($q: String!) {
    collections(first: 1, query: $q) {
      nodes {
        id handle descriptionHtml image { url }
        ruleSet { rules { condition } }
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
    publishablePublish(id: $id, input: $input) { userErrors { field message } }
  }
`;

const ETIQUETAR = `
  mutation agregarEtiquetas($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) { userErrors { field message } }
  }
`;

const IMAGEN = `
  mutation imagen($input: CollectionInput!) {
    collectionUpdate(input: $input) { userErrors { field message } }
  }
`;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* El Admin API limita por costo. Con "Throttled" se espera y se reintenta. */
async function admin(query, variables) {
  for (let intento = 0; intento < 6; intento += 1) {
    try {
      return await adminFetch(env, query, variables);
    } catch (error) {
      if (!/throttl/i.test(String(error?.message))) throw error;
      await espera(1000 * (intento + 1));
    }
  }
  throw new Error('Sin cupo del Admin API');
}

const base = (sku) => sku.split('.')[0];

/**
 * El producto de un SKU del Excel. Con sufijo (A2148.05) se busca esa variante
 * exacta; sin él, cualquier variante cuya clave base coincida. Si la base sólo
 * existe con una letra pegada (A2113 → A2113A), se acepta y se avisa.
 */
export function elegir(sku, nodos) {
  const exacta = nodos.find((n) => n.sku === sku);
  if (exacta)
    return {
      variante: sku.includes('.') ? exacta : null,
      producto: exacta.product,
      aproximado: false,
    };
  const misma = nodos.find((n) => base(n.sku) === base(sku));
  if (misma)
    return {
      variante: null,
      producto: misma.product,
      aproximado: sku.includes('.'),
    };
  const parecida = nodos.find((n) =>
    new RegExp(`^${base(sku)}[A-Z]\\b`).test(base(n.sku)),
  );
  if (parecida)
    return {variante: null, producto: parecida.product, aproximado: true};
  return null;
}

async function resolver(skus) {
  const productos = new Map();
  const variantes = {};
  const faltan = [];
  const avisos = [];
  for (const sku of skus) {
    const {productVariants} = await admin(VARIANTES, {q: `sku:${base(sku)}*`});
    const r = elegir(sku, productVariants.nodes);
    if (!r) {
      faltan.push(sku);
      continue;
    }
    if (r.aproximado) avisos.push(`  ≈ ${sku} → ${r.producto.handle}`);
    productos.set(r.producto.id, r.producto);
    if (r.variante) {
      const v = r.variante;
      variantes[r.producto.handle] = {
        sku: v.sku,
        variantId: v.id,
        opciones: v.selectedOptions.filter((o) => o.name !== 'Title'),
        imagen: v.media.nodes[0]?.image?.url ?? null,
      };
    }
  }
  return {productos: [...productos.values()], variantes, faltan, avisos};
}


const skus = JSON.parse(
  fs.readFileSync(path.join(RAIZ, 'scripts/campanas/skus.json'), 'utf8'),
);
const salida = {...VARIANTES_ACTUALES};

for (const campana of CAMPANAS.filter((c) => !solo || c.handle === solo)) {
  const lista = [...new Set(skus[campana.handle] || [])];
  console.log(
    `\n# ${campana.titulo} (${campana.handle}) · ${lista.length} SKUs`,
  );
  const {productos, variantes, faltan, avisos} = await resolver(lista);
  const porEtiquetar = productos.filter((p) => !p.tags.includes(campana.tag));
  console.log(
    `  productos: ${productos.length} · por etiquetar: ${porEtiquetar.length} · con color fijado: ${Object.keys(variantes).length}`,
  );
  if (faltan.length)
    console.log(`  ✗ no están en Shopify: ${faltan.join(', ')}`);
  if (avisos.length) console.log(avisos.join('\n'));

  const {collections, publications} = await admin(COLECCION, {
    q: `handle:${campana.handle}`,
  });
  let coleccion = collections.nodes.find((c) => c.handle === campana.handle);
  const banner = path.join(
    RAIZ,
    `scripts/campanas/${campana.handle}-banner.jpg`,
  );
  const subirBanner = fs.existsSync(banner) && !coleccion?.image;
  const etiquetas = etiquetasDe(campana);
  const reglas = (etiquetasLista) => ({
    appliedDisjunctively: true,
    rules: etiquetasLista.map((condition) => ({column: 'TAG', relation: 'EQUALS', condition})),
  });
  const actuales = (coleccion?.ruleSet?.rules ?? []).map((r) => r.condition);
  const faltanEtiquetas = coleccion ? etiquetas.filter((t) => !actuales.includes(t)) : [];
  const ponerTexto = Boolean(coleccion && !coleccion.descriptionHtml && DESCRIPCIONES[campana.handle]);
  console.log(
    `  colección: ${coleccion ? 'ya existe' : 'se crea'}${subirBanner ? ' · se sube el banner' : ''}${ponerTexto ? ' · se pone el texto' : ''}${faltanEtiquetas.length ? ` · se suman ${faltanEtiquetas.join(', ')}` : ''}`,
  );

  if (dryRun) continue;

  for (const p of porEtiquetar) {
    const {tagsAdd} = await admin(ETIQUETAR, {id: p.id, tags: [campana.tag]});
    if (tagsAdd.userErrors.length)
      console.error(
        `  ✗ ${p.handle}: ${tagsAdd.userErrors.map((e) => e.message).join('; ')}`,
      );
  }

  if (!coleccion) {
    const {collectionCreate} = await admin(CREAR, {
      input: {
        title: campana.titulo,
        handle: campana.handle,
        descriptionHtml: DESCRIPCIONES[campana.handle]
          ? `<p>${DESCRIPCIONES[campana.handle]}</p>`
          : '',
        ruleSet: reglas(etiquetas),
      },
    });
    if (collectionCreate.userErrors.length) {
      console.error(
        `  ✗ colección: ${collectionCreate.userErrors.map((e) => e.message).join('; ')}`,
      );
      continue;
    }
    coleccion = collectionCreate.collection;
    const canales = publications.nodes.filter((p) =>
      ['Online Store', 'API GI'].includes(p.name),
    );
    const {publishablePublish} = await admin(PUBLICAR, {
      id: coleccion.id,
      input: canales.map((c) => ({publicationId: c.id})),
    });
    if (publishablePublish.userErrors.length) {
      console.error(
        `  ✗ sin publicar: ${publishablePublish.userErrors.map((e) => e.message).join('; ')}`,
      );
    }
  }

  if (ponerTexto || faltanEtiquetas.length) {
    const input = {id: coleccion.id};
    if (ponerTexto) input.descriptionHtml = `<p>${DESCRIPCIONES[campana.handle]}</p>`;
    // Suma, nunca quita: las que ya tenía se quedan.
    if (faltanEtiquetas.length) input.ruleSet = reglas([...actuales, ...faltanEtiquetas]);
    const {collectionUpdate} = await admin(IMAGEN, {input});
    if (collectionUpdate.userErrors.length) {
      console.error(
        `  ✗ texto o etiquetas: ${collectionUpdate.userErrors.map((e) => e.message).join('; ')}`,
      );
    }
  }

  if (subirBanner) {
    const src = await subirImagen(admin, banner);
    const {collectionUpdate} = await admin(IMAGEN, {
      input: {id: coleccion.id, image: {src, altText: campana.titulo}},
    });
    if (collectionUpdate.userErrors.length) {
      console.error(
        `  ✗ banner: ${collectionUpdate.userErrors.map((e) => e.message).join('; ')}`,
      );
    }
  }

  salida[campana.handle] = variantes;
  console.log('  ✓ listo');
}

if (!dryRun) {
  fs.writeFileSync(
    SALIDA,
    `// Generado por scripts/campanas.mjs: no se edita a mano.\n// {campaña: {handle del producto: variante que fija su SKU}}\nexport default ${JSON.stringify(salida, null, 2)};\n`,
  );
  console.log(`\nVariantes escritas en ${path.relative(RAIZ, SALIDA)}`);
}
