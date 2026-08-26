import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  root,
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      // `server-only` throws by design when imported outside a React Server
      // Component. Under vitest we are importing those modules deliberately, so
      // point it at the package's own no-op build (what Next resolves it to via
      // the "react-server" export condition).
      'server-only': path.resolve(root, 'node_modules/server-only/empty.js'),
    },
  },
  // The project's tsconfig sets jsx:"preserve" for Next to handle; vite cannot
  // parse that, and the contract test imports registry.client.ts, which pulls in
  // every widgets.tsx. Transform JSX here instead. No component is rendered —
  // the tests only read each widget's `def` — so the runtime never needs React.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // e2e/ is Playwright, driven separately by `npm run test:e2e` — it needs a
    // built app and a browser, so it must not be swept up by `npm test`.
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
  },
});
