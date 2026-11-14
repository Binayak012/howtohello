import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  testDir: './website/tests', testMatch: '**/*.spec.ts', timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4174', headless: true, channel: 'chrome' },
  webServer: {
    command: 'node ../node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174 --strictPort',
    cwd: fileURLToPath(new URL('./website', import.meta.url)),
    url: 'http://127.0.0.1:4174', reuseExistingServer: false,
  },
});
