// Alta de cuentas para los ejecutivos de venta.
//
// Uso:  set -a; . ./.env; set +a; node scripts/crear-asesores.mjs [--dry-run]
//
// Lee los ejecutivos publicados del metaobject `ejecutiva_de_venta` y les crea
// una cuenta con rol `asesor`, verificada y con contraseña aleatoria que nadie
// conoce: cada uno entra con "¿Olvidaste tu contraseña?" y pone la suya. Así no
// se inventa un flujo de credenciales — se reusa el que ya está probado.
//
// Idempotente: a quien ya tiene cuenta no la toca, sólo le corrige el rol si
// hiciera falta.
import {isStubMode} from '../app/lib/admin/client.js';
import {getDb} from '../app/lib/db/client.js';
import {listAdvisors, getAdvisorByHandle} from '../app/lib/admin/operations.js';
import {createUser, findByEmail, EmailTakenError} from '../app/lib/auth/users.js';
// Desde roles.js y no desde advisor-guard.js: ese arrastra el guard de
// peticiones, que importa con el alias `~` y Node crudo no lo resuelve.
import {ADVISOR_ROLE} from '../app/lib/auth/roles.js';

const dryRun = process.argv.includes('--dry-run');
const env = process.env;

// Sin token del Admin API, listAdvisors devuelve asesores de PRUEBA
// (stub1@example.com…) y este script los daría de alta como cuentas reales.
// Falla ruidosamente en vez de ensuciar la base.
// Hydrogen inyecta PUBLIC_STORE_DOMAIN en tiempo de ejecución, pero un script
// en Node crudo no la recibe: sin ella adminFetch arma https://undefined/... y
// el fallo llega como un ENOTFOUND críptico.
if (!env.PUBLIC_STORE_DOMAIN) {
  console.error(
    '✗ Falta PUBLIC_STORE_DOMAIN (p. ej. development-gi.myshopify.com).\n' +
      '  Pásala en la llamada:  PUBLIC_STORE_DOMAIN=tu-tienda.myshopify.com npm run crear-asesores',
  );
  process.exit(1);
}

if (isStubMode(env)) {
  console.error(
    '✗ PRIVATE_ADMIN_API_TOKEN no está en el entorno: se leerían asesores de prueba.\n' +
      '  Carga el .env antes de correr:  set -a; . ./.env; set +a; npm run crear-asesores\n' +
      '  Si ya lo cargaste y sigue fallando, revisa que ningún valor del .env tenga\n' +
      '  espacios o < > sin comillas: eso corta la carga a partir de esa línea.',
  );
  process.exit(1);
}

const db = getDb(env);

// Buzones operativos: reciben cotizaciones cuando el cliente no tiene ejecutivo
// (el respaldo `marketing` del metaobject, o `ventas@` cuando no hay metafield).
// Necesitan cuenta porque el correo los manda al portal como a cualquier otro.
const BUZONES = [
  {correo: 'marketing@generandoideas.com', nombre: 'Marketing', puesto: 'Buzón de marketing'},
  {
    correo: (env.SALES_EMAIL || 'ventas@generandoideas.com').trim().toLowerCase(),
    nombre: 'Ventas',
    puesto: 'Buzón de ventas',
  },
];

const advisors = [
  ...(await listAdvisors(env)),
  ...BUZONES.map((b) => ({handle: null, nombre: b.nombre, puesto: b.puesto, correo: b.correo})),
];
console.log(`Ejecutivos publicados en Shopify: ${advisors.length}`);

let creados = 0;
let yaExistian = 0;
let sinCorreo = 0;

for (const a of advisors) {
  // listAdvisors ya trae el correo, pero un entry sin él no puede tener cuenta.
  let correo = a.correo;
  if (!correo && a.handle) {
    const detalle = await getAdvisorByHandle(env, a.handle).catch(() => null);
    correo = detalle && detalle.correo ? detalle.correo.trim().toLowerCase() : '';
  }
  if (!correo) {
    console.warn(`  ✗ ${a.nombre} (${a.handle}) — sin correo, se omite`);
    sinCorreo++;
    continue;
  }

  const existente = await findByEmail(db, correo);
  if (existente) {
    if (existente.role !== ADVISOR_ROLE) {
      if (!dryRun) {
        await db.execute({
          sql: `UPDATE users SET role=?, updated_at=? WHERE id=?`,
          args: [ADVISOR_ROLE, new Date().toISOString(), existente.id],
        });
      }
      console.log(`  ~ ${correo} — ya existía, rol corregido a ${ADVISOR_ROLE}`);
    } else {
      console.log(`  = ${correo} — ya existía`);
    }
    yaExistian++;
    continue;
  }

  if (dryRun) {
    console.log(`  + ${correo} — se crearía (${a.nombre})`);
    creados++;
    continue;
  }

  const [nombre, ...resto] = String(a.nombre || '').split(' ');
  try {
    const u = await createUser(db, env, {
      email: correo,
      // Aleatoria y desechada: se entra por recuperación de contraseña.
      password: crypto.randomUUID() + crypto.randomUUID(),
      firstName: nombre || null,
      lastName: resto.join(' ') || null,
      position: a.puesto || null,
      role: ADVISOR_ROLE,
    });
    // Verificada de origen: el correo es corporativo y lo dio RH, no el usuario.
    await db.execute({
      sql: `UPDATE users SET email_verified_at=? WHERE id=?`,
      args: [new Date().toISOString(), u.id],
    });
    console.log(`  + ${correo} — creado`);
    creados++;
  } catch (err) {
    if (err instanceof EmailTakenError) {
      console.log(`  = ${correo} — ya existía (carrera)`);
      yaExistian++;
    } else {
      console.error(`  ✗ ${correo} — ${err.message}`);
    }
  }
}

console.log(
  `\n${dryRun ? '[dry-run] ' : ''}creados: ${creados} · ya existían: ${yaExistian} · sin correo: ${sinCorreo}`,
);
console.log('Cada ejecutivo debe entrar con "¿Olvidaste tu contraseña?" para fijar la suya.');
