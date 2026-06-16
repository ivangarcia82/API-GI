import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirror the `~` -> ./app alias from vite.config.js so components that
    // import `~/lib/...` (e.g. DecorationSelector) resolve under Vitest too.
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    // Pure-function modules (password, decoration engine) run under Node.
    // Node 20+ exposes globalThis.crypto.subtle, so PBKDF2/HMAC work here.
    // Per-file `// @vitest-environment jsdom` opts component tests into a DOM.
    environment: 'node',
    include: ['app/**/*.test.{js,jsx}'],
    globals: false,
  },
});
