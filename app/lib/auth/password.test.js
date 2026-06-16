import {describe, it, expect} from 'vitest';
import {hashPassword, verifyPassword, hashPasswordWithIterations} from './password.js';

const env = {AUTH_PEPPER: 'unit-test-pepper-value'};

describe('password', () => {
  it('round-trips: a hashed password verifies true', async () => {
    const rec = await hashPassword('Sup3r-Secret!', env);
    expect(rec.iterations).toBe(100000);
    expect(typeof rec.hash).toBe('string');
    expect(typeof rec.salt).toBe('string');
    // base64 of 32 bytes -> 44 chars; base64 of 16 bytes -> 24 chars
    expect(rec.hash.length).toBe(44);
    expect(rec.salt.length).toBe(24);
    const ok = await verifyPassword('Sup3r-Secret!', rec, env);
    expect(ok).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const rec = await hashPassword('Sup3r-Secret!', env);
    const ok = await verifyPassword('wrong-password', rec, env);
    expect(ok).toBe(false);
  });

  it('rejects when the pepper differs (HMAC pepper is applied)', async () => {
    const rec = await hashPassword('Sup3r-Secret!', env);
    const ok = await verifyPassword('Sup3r-Secret!', rec, {AUTH_PEPPER: 'other'});
    expect(ok).toBe(false);
  });

  it('verifies using the stored iteration count, not the default (upgrade path)', async () => {
    const rec = await hashPassword('Sup3r-Secret!', env);
    // Simulate a legacy record stored with fewer iterations.
    const legacy = await hashPasswordWithIterations('Sup3r-Secret!', env, 50000);
    expect(legacy.iterations).toBe(50000);
    const ok = await verifyPassword('Sup3r-Secret!', legacy, env);
    expect(ok).toBe(true);
    // And the modern record still verifies.
    expect(await verifyPassword('Sup3r-Secret!', rec, env)).toBe(true);
  });

  it('returns false (never throws) on malformed records', async () => {
    expect(await verifyPassword('x', null, env)).toBe(false);
    expect(await verifyPassword('x', {}, env)).toBe(false);
    expect(await verifyPassword('x', {hash: '', salt: '', iterations: 0}, env)).toBe(false);
    expect(await verifyPassword('x', {hash: '!!!', salt: '!!!', iterations: 100000}, env)).toBe(false);
  });
});
