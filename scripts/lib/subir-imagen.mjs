// Sube una imagen local a Files de Shopify y devuelve su URL del CDN. La usan
// scripts/campanas.mjs (banners) y scripts/imagen-coleccion.mjs.
//
// La imagen de una colección no acepta directo el resourceUrl de una subida
// ("Error updating collection with this image"): primero se registra como
// archivo de Shopify y se usa la URL del CDN que le asigna.
import fs from 'node:fs';
import path from 'node:path';

const SUBIDA = `
  mutation subida($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }
`;

const ARCHIVO = `
  mutation archivo($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files { id }
      userErrors { field message }
    }
  }
`;

const LISTO = `
  query listo($id: ID!) {
    node(id: $id) { ... on MediaImage { fileStatus image { url } } }
  }
`;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {(query: string, variables?: object) => Promise<any>} admin
 *   cliente del Admin API (con reintento por cupo)
 * @param {string} archivo ruta de un .jpg local
 * @returns {Promise<string>} URL del CDN de Shopify
 */
export async function subirImagen(admin, archivo) {
  const datos = fs.readFileSync(archivo);
  const {stagedUploadsCreate} = await admin(SUBIDA, {
    input: [
      {
        resource: 'IMAGE',
        filename: path.basename(archivo),
        mimeType: 'image/jpeg',
        httpMethod: 'POST',
        fileSize: String(datos.length),
      },
    ],
  });
  if (stagedUploadsCreate.userErrors.length) {
    throw new Error(
      stagedUploadsCreate.userErrors.map((e) => e.message).join('; '),
    );
  }
  const destino = stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const p of destino.parameters) form.append(p.name, p.value);
  form.append(
    'file',
    new Blob([datos], {type: 'image/jpeg'}),
    path.basename(archivo),
  );
  const res = await fetch(destino.url, {method: 'POST', body: form});
  if (!res.ok) throw new Error(`Subida rechazada: ${res.status}`);

  const {fileCreate} = await admin(ARCHIVO, {
    files: [
      {
        originalSource: destino.resourceUrl,
        contentType: 'IMAGE',
        alt: path.basename(archivo),
      },
    ],
  });
  if (fileCreate.userErrors.length) {
    throw new Error(fileCreate.userErrors.map((e) => e.message).join('; '));
  }
  for (let i = 0; i < 20; i += 1) {
    const {node} = await admin(LISTO, {id: fileCreate.files[0].id});
    if (node?.fileStatus === 'READY' && node.image?.url) return node.image.url;
    if (node?.fileStatus === 'FAILED')
      throw new Error('Shopify no pudo procesar la imagen');
    await espera(1500);
  }
  throw new Error('La imagen no terminó de procesarse');
}
