import { defineConfig } from '@playwright/test';
export default defineConfig({
  workers:2,
  testDir: './tests', testMatch: '**/*.spec.ts', timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true, channel: 'chrome' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
});
