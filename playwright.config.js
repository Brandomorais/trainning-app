import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 45000, reporter: 'list', outputDir: '.test-output',
  use: { baseURL: 'http://127.0.0.1:5173', channel: process.env.CI ? undefined : 'chrome', headless: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/Sao_Paulo', trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/dev-server.js', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
});
