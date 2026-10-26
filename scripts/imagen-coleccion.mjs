// Pone (o reemplaza) la imagen de colecciones de Shopify. Las tarjetas de
// categoría del home y de /collections la toman de ahí, así que el cambio se
// ve en el sitio sin deploy.
//
// Uso:  set -a; . ./.env; set +a; PUBLIC_STORE_DOMAIN=development-gi.myshopify.com \
//         node scripts/imagen-coleccion.mjs <handle>=<archivo.jpg> [...] [--dry-run]
//
// Ejemplo: node scripts/imagen-coleccion.mjs hogar=~/Downloads/Hogar.jpg
//
// La imagen se reduce a 1200 px de ancho (JPEG) antes de subirla: las
// originales de Diseño pesan más de 1 MB y la tarjeta más grande mide ~500 px.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {adminFetch, isStubMode} from '../app/lib/admin/client.js';
import {subirImagen} from './lib/subir-imagen.mjs';

const env = process.env;
const dryRun = process.argv.includes('--dry-run');
const pares = process.argv.slice(2).filter((a) => a.includes('='));

if (!env.PUBLIC_STORE_DOMAIN || isStubMode(env)) {
  console.error('✗ Carga el .env y define PUBLIC_STORE_DOMAIN antes de correr.');
  process.exit(1);
}
if (!pares.length) {
  console.error('✗ Uso: node scripts/imagen-coleccion.mjs <handle>=<archivo.jpg> [...]');
  process.exit(1);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
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

const COLECCION = `
  query coleccion($h: String!) { collectionByHandle(handle: $h) { id title } }
`;
const IMAGEN = `
  mutation imagen($input: CollectionInput!) {
    collectionUpdate(input: $input) { userErrors { field message } }
  }
`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'imagen-coleccion-'));

for (const par of pares) {
  const [handle, ruta] = par.split('=');
  const archivo = ruta.replace(/^~(?=\/)/, os.homedir());
  if (!fs.existsSync(archivo)) {
    console.error(`  ✗ ${handle}: no existe ${archivo}`);
    continue;
  }
  const {collectionByHandle: c} = await admin(COLECCION, {h: handle});
  if (!c) {
    console.error(`  ✗ ${handle}: no hay colección con ese handle`);
    continue;
  }
  if (dryRun) {
    console.log(`  · ${c.title} (${handle}) ← ${path.basename(archivo)}`);
    continue;
  }
  // sips viene con macOS; se reescala sin tocar el original.
  const reducida = path.join(tmp, `${handle}.jpg`);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '--resampleWidth', '1200', archivo, '--out', reducida], {stdio: 'ignore'});
  const src = await subirImagen(admin, reducida);
  const {collectionUpdate} = await admin(IMAGEN, {input: {id: c.id, image: {src, altText: c.title}}});
  if (collectionUpdate.userErrors.length) {
    console.error(`  ✗ ${handle}: ${collectionUpdate.userErrors.map((e) => e.message).join('; ')}`);
    continue;
  }
  console.log(`  ✓ ${c.title} (${handle}) ← ${path.basename(archivo)}`);
}

fs.rmSync(tmp, {recursive: true, force: true});
