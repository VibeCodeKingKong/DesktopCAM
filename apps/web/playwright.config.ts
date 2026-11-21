import { defineConfig, devices } from '@playwright/test';

/**
 * Webbläsartester av huvudflödena (pnpm test:e2e). Kör mot det byggda
 * programmet (pnpm build först). Första gången: npx playwright install chromium.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4175', trace: 'off', locale: 'sv-SE' },
  webServer: { command: 'npx vite preview --port 4175 --strictPort', port: 4175, reuseExistingServer: true },
  projects: [
    { name: 'dator', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testMatch: /desktop\.spec\.ts/ },
    { name: 'telefon', use: { ...devices['iPhone 13'], browserName: 'chromium' }, testMatch: /phone\.spec\.ts/ },
  ],
});
