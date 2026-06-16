import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // Pure-function modules (password, decoration engine) run under Node.
    // Node 20+ exposes globalThis.crypto.subtle, so PBKDF2/HMAC work here.
    environment: 'node',
    include: ['app/**/*.test.{js,jsx}'],
    globals: false,
  },
});
