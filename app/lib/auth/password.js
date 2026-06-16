// Server-only. Password hashing with WebCrypto: HMAC-SHA256 pepper -> PBKDF2-SHA256.
// 100000 iterations is the hard cap in workerd (>100k throws NotSupportedError).
// Never import from client components.

const DEFAULT_ITERATIONS = 100000;
const SALT_BYTES = 16;
const DERIVED_BITS = 256; // 32 bytes

function toBase64(bytes) {
  let binary = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// HMAC-SHA256(password, pepper) -> Uint8Array(32). Pepper is the HMAC key.
async function pepper(plain, env) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(env.AUTH_PEPPER ?? '')),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(plain)));
  return new Uint8Array(sig);
}

async function deriveBits(pepperedBytes, salt, iterations) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    pepperedBytes,
    {name: 'PBKDF2'},
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {name: 'PBKDF2', hash: 'SHA-256', salt, iterations},
    baseKey,
    DERIVED_BITS,
  );
  return new Uint8Array(bits);
}

// Internal: hash with an explicit iteration count (used by hashPassword and tests).
export async function hashPasswordWithIterations(plain, env, iterations) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const peppered = await pepper(plain, env);
  const derived = await deriveBits(peppered, salt, iterations);
  return {hash: toBase64(derived), salt: toBase64(salt), iterations};
}

export async function hashPassword(plain, env) {
  return hashPasswordWithIterations(plain, env, DEFAULT_ITERATIONS);
}

// Constant-time compare: fixed-length XOR accumulator; the length mismatch
// itself feeds the accumulator (no early return), so timing does not leak.
function constantTimeEqual(a, b) {
  let diff = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export async function verifyPassword(plain, rec, env) {
  try {
    if (!rec || typeof rec.hash !== 'string' || typeof rec.salt !== 'string') {
      return false;
    }
    const iterations = Number(rec.iterations);
    if (!Number.isInteger(iterations) || iterations <= 0) return false;
    if (rec.hash.length === 0 || rec.salt.length === 0) return false;
    const expected = fromBase64(rec.hash);
    const salt = fromBase64(rec.salt);
    const peppered = await pepper(plain, env);
    const derived = await deriveBits(peppered, salt, iterations);
    return constantTimeEqual(derived, expected);
  } catch {
    return false;
  }
}
