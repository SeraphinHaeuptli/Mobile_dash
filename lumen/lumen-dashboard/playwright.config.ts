import { defineConfig, devices } from '@playwright/test';

/**
 * e2e smoke flow (PLAN.md Phase 6 step 3). Kept separate from `npm test`
 * (vitest) because it needs a built app and a browser.
 *
 * Run with `npm run test:e2e`. It builds and serves the app itself via
 * `webServer`, and writes `data/layout.json` (gitignored) as it goes — that
 * file IS the persistence being tested.
 *
 * Browsers are not downloaded: PLAYWRIGHT_BROWSERS_PATH points at a preinstalled
 * Chromium. If a machine has none, `npx playwright install chromium` first.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run start -- --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
