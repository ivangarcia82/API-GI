// Crea un usuario directamente en Turso, YA VERIFICADO y sin enviar correo.
// Usa las mismas funciones que /auth/signup (mismo hash de contraseña), pero
// omite el paso de verificación por correo: escribe email_verified_at = ahora.
//
// Uso:
//   set -a; . ./.env; set +a; \
//   node scripts/create-user.mjs --email alguien@dominio.com --password 'secreta123'
//
// Opciones:
//   --first-name, --last-name, --company, --razon-social, --phone
//   --role <quoter>          rol del usuario (default: quoter)
//   --no-shopify             no crear/enlazar el cliente en Shopify
//   --force                  si el correo ya existe: actualiza contraseña y lo verifica
//
// El enlace con Shopify es best-effort: si falla, el usuario queda creado y el
// gid se reconcilia después (reconcileShopifyCustomer).
import {readFileSync} from 'node:fs';
import {getDb} from '../app/lib/db/client.js';
import {
  createUser,
  findByEmail,
  markEmailVerified,
  updatePassword,
  EmailTakenError,
} from '../app/lib/auth/users.js';
import {linkSignupCustomer} from '../app/lib/auth/signup-link.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

// PUBLIC_STORE_DOMAIN lo inyecta Hydrogen en runtime; fuera de `shopify hydrogen dev`
// no existe, así que lo tomamos de .shopify/project.json para que el enlace con
// Shopify también funcione desde la terminal.
function storeDomainFromProject() {
  try {
    const json = JSON.parse(readFileSync('.shopify/project.json', 'utf8'));
    return json.shop || null;
  } catch {
    return null;
  }
}

const args = parseArgs(process.argv.slice(2));
const email = args.email;
const password = args.password;

if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
  console.error('Faltan --email y/o --password.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres (igual que /auth/signup).');
  process.exit(1);
}

const env = {
  ...process.env,
  PUBLIC_STORE_DOMAIN: process.env.PUBLIC_STORE_DOMAIN || storeDomainFromProject(),
};

const db = getDb(env);

const existing = await findByEmail(db, email);
if (existing && !args.force) {
  console.error(
    `Ese correo ya está registrado (id ${existing.id}, verificado: ${
      existing.emailVerifiedAt ? 'sí' : 'no'
    }). Usa --force para actualizar la contraseña y verificarlo.`,
  );
  process.exit(1);
}

let user;
if (existing) {
  await updatePassword(db, env, existing.id, password);
  if (!existing.emailVerifiedAt) await markEmailVerified(db, existing.id);
  user = await findByEmail(db, email);
  console.log(`Usuario existente actualizado: ${user.email}`);
} else {
  try {
    user = await createUser(db, env, {
      email,
      password,
      firstName: args['first-name'] ?? null,
      lastName: args['last-name'] ?? null,
      company: args.company ?? null,
      razonSocial: args['razon-social'] ?? null,
      phone: args.phone ?? null,
      volume: null,
      needs: null,
      role: args.role ?? 'quoter',
    });
  } catch (err) {
    if (err instanceof EmailTakenError) {
      console.error('Ese correo ya está registrado (carrera con otro alta).');
      process.exit(1);
    }
    throw err;
  }

  // Auto-verificación: sin este paso el login responde 403 y reenvía el correo.
  await markEmailVerified(db, user.id);
  console.log(`Usuario creado: ${user.email}`);
}

if (!args['no-shopify'] && !user.shopifyCustomerGid) {
  if (!env.PUBLIC_STORE_DOMAIN) {
    console.warn('Sin PUBLIC_STORE_DOMAIN: omito el enlace con Shopify (se reconcilia después).');
  } else {
    const gid = await linkSignupCustomer(db, env, user);
    user.shopifyCustomerGid = gid;
  }
}

const final = await findByEmail(db, email);
console.log({
  id: final.id,
  email: final.email,
  role: final.role,
  emailVerifiedAt: final.emailVerifiedAt,
  shopifyCustomerGid: final.shopifyCustomerGid,
});
console.log('Listo. No se envió ningún correo; la cuenta puede iniciar sesión de inmediato.');
