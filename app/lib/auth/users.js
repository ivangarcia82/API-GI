// Server-only. User repository over libSQL. User shape:
// {id,email,firstName,lastName,company,razonSocial,role,shopifyCustomerGid,
//  sessionVersion,emailVerifiedAt,createdAt,updatedAt}
import {hashPassword} from './password.js';

export class EmailTakenError extends Error {
  constructor(message = 'Email already registered') {
    super(message);
    this.name = 'EmailTakenError';
  }
}

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase().normalize('NFKC');
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    company: row.company ?? null,
    razonSocial: row.razon_social ?? null,
    phone: row.phone ?? null,
    volume: row.volume ?? null,
    needs: row.needs ?? null,
    role: row.role,
    shopifyCustomerGid: row.shopify_customer_gid ?? null,
    sessionVersion: Number(row.session_version),
    emailVerifiedAt: row.email_verified_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS = `id, email, first_name, last_name, company, razon_social, phone, volume, needs, role,
  shopify_customer_gid, session_version, email_verified_at, created_at, updated_at`;

// Detects the libSQL UNIQUE-constraint violation surfaced by Turso.
function isUniqueViolation(err) {
  const msg = String(err?.message ?? '').toUpperCase();
  return msg.includes('UNIQUE') || msg.includes('CONSTRAINT');
}

export async function createUser(db, env, {email, password, firstName, lastName, company, razonSocial, phone, volume, needs, role}) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(email);
  const rec = await hashPassword(password, env);
  try {
    await db.execute({
      sql: `INSERT INTO users
        (id, email, password_hash, password_salt, password_iterations,
         session_version, first_name, last_name, company, razon_social, phone, volume, needs, role,
         shopify_customer_gid, email_verified_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      args: [
        id,
        normalizedEmail,
        rec.hash,
        rec.salt,
        rec.iterations,
        firstName ?? null,
        lastName ?? null,
        company ?? null,
        razonSocial ?? null,
        phone ?? null,
        volume ?? null,
        needs ?? null,
        role ?? 'quoter',
        now,
        now,
      ],
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new EmailTakenError();
    throw err;
  }
  return {
    id,
    email: normalizedEmail,
    firstName: firstName ?? null,
    lastName: lastName ?? null,
    company: company ?? null,
    razonSocial: razonSocial ?? null,
    phone: phone ?? null,
    volume: volume ?? null,
    needs: needs ?? null,
    role: role ?? 'quoter',
    shopifyCustomerGid: null,
    sessionVersion: 1,
    emailVerifiedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function findByEmail(db, email) {
  const res = await db.execute({
    sql: `SELECT ${SELECT_COLS} FROM users WHERE email = ?`,
    args: [normalizeEmail(email)],
  });
  return rowToUser(res.rows[0]);
}

export async function findById(db, id) {
  const res = await db.execute({
    sql: `SELECT ${SELECT_COLS} FROM users WHERE id = ?`,
    args: [id],
  });
  return rowToUser(res.rows[0]);
}

export async function updateProfile(db, id, {firstName, lastName, company, razonSocial}) {
  await db.execute({
    sql: `UPDATE users SET first_name = ?, last_name = ?, company = ?, razon_social = ?, updated_at = ?
          WHERE id = ?`,
    args: [
      firstName ?? null,
      lastName ?? null,
      company ?? null,
      razonSocial ?? null,
      new Date().toISOString(),
      id,
    ],
  });
}

export async function setShopifyGid(db, id, gid) {
  await db.execute({
    sql: `UPDATE users SET shopify_customer_gid = ?, updated_at = ? WHERE id = ?`,
    args: [gid, new Date().toISOString(), id],
  });
}

// Reads the user's current session_version (null if the user no longer exists).
// Used by requireUser to validate a cookie snapshot against the live record.
export async function getSessionVersion(db, id) {
  const res = await db.execute({
    sql: `SELECT session_version FROM users WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0];
  return row ? Number(row.session_version) : null;
}

export async function bumpSessionVersion(db, id) {
  await db.execute({
    sql: `UPDATE users SET session_version = session_version + 1, updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), id],
  });
  const res = await db.execute({
    sql: `SELECT session_version FROM users WHERE id = ?`,
    args: [id],
  });
  return Number(res.rows[0]?.session_version);
}

export async function markEmailVerified(db, id) {
  await db.execute({
    sql: `UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), new Date().toISOString(), id],
  });
}

// Sets a new password hash AND invalidates other sessions (session_version++).
export async function updatePassword(db, env, id, newPassword) {
  const rec = await hashPassword(newPassword, env);
  await db.execute({
    sql: `UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ?
          WHERE id = ?`,
    args: [rec.hash, rec.salt, rec.iterations, new Date().toISOString(), id],
  });
  return bumpSessionVersion(db, id);
}

// Lee las columnas secretas de la contraseña. Devuelve exactamente la forma que
// verifyPassword espera, o null si el usuario no existe. Vive aquí y no en las
// rutas para que todo el SQL de `users` quede en un solo lugar.
export async function getPasswordRecord(db, id) {
  const res = await db.execute({
    sql: `SELECT password_hash, password_salt, password_iterations FROM users WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0];
  if (!row) return null;
  return {
    hash: row.password_hash,
    salt: row.password_salt,
    iterations: Number(row.password_iterations),
  };
}
